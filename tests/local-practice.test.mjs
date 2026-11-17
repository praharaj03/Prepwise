import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { loadModule } from "./load-module.mjs";

const { practiceDetailsSchema, createPracticeQuestions } = loadModule("lib/practice-questions.ts");
const { interviewTemplates } = loadModule("lib/interview-templates.ts");

function storageFixture(t) {
  const values = new Map();
  const previous = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  }, dispatchEvent() {} };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const library = loadModule("lib/local-interviews.ts");
  return { library, values };
}

const details = { role: "Frontend Developer", type: "Technical", level: "Junior", techstack: "React, TypeScript", amount: 20 };

test("all question counts and focus types produce unique curated questions without a provider", () => {
  for (const type of ["Technical", "Behavioral", "Mixed"]) {
    for (const amount of [1, 5, 10, 20]) {
      const input = practiceDetailsSchema.parse({ ...details, type, amount });
      const questions = createPracticeQuestions(input);
      assert.equal(questions.length, amount);
      assert.equal(new Set(questions).size, amount);
    }
  }
  assert.equal(practiceDetailsSchema.safeParse({ ...details, amount: 21 }).success, false);
  assert.equal(practiceDetailsSchema.safeParse({ ...details, companyLogo: "https://untrusted.example/logo.svg" }).success, false);
});

test("the 10 sample interviews include requested companies and locally bundled logos", () => {
  assert.equal(interviewTemplates.length, 10);
  assert.equal(new Set(interviewTemplates.map((item) => item.id)).size, 10);
  for (const company of ["NVIDIA", "Oracle", "Zomato", "SpaceX", "Swiggy", "Apple", "Google"]) {
    assert.ok(interviewTemplates.some((item) => item.company === company));
  }
  for (const interview of interviewTemplates) {
    assert.equal(interview.questions.length, 5);
    assert.ok(existsSync("public" + interview.companyLogo), interview.company);
  }
});

test("creation persists validated interviews locally and import preserves existing records", (t) => {
  const { library, values } = storageFixture(t);
  const first = library.saveInterview(details);
  const saved = values.get(library.INTERVIEW_STORAGE_KEY);
  assert.equal(JSON.parse(saved)[0].id, first.id);
  assert.equal(JSON.parse(saved)[0].questions.length, 20);
  const second = { ...first, id: "imported-interview", role: "Backend Developer", company: "Oracle", companyLogo: "/companies/oracle.svg" };
  library.importLibrary(JSON.stringify([{ ...first, role: "Changed externally" }, second]));
  const records = library.parseSavedInterviews(values.get(library.INTERVIEW_STORAGE_KEY));
  assert.equal(records.length, 2);
  assert.equal(records.find((record) => record.id === first.id).role, details.role);
  assert.equal(records.find((record) => record.id === second.id).company, "Oracle");
  library.removeInterview(first.id);
  assert.equal(library.parseSavedInterviews(values.get(library.INTERVIEW_STORAGE_KEY)).length, 1);
});

test("malformed storage and invalid backups never overwrite the existing library", (t) => {
  const { library, values } = storageFixture(t);
  library.saveInterview(details);
  const before = values.get(library.INTERVIEW_STORAGE_KEY);
  assert.throws(() => library.importLibrary("not json"), /valid PrepWise/);
  assert.equal(values.get(library.INTERVIEW_STORAGE_KEY), before);
  assert.throws(() => library.importLibrary(JSON.stringify([{ id: "invalid" }])));
  assert.equal(values.get(library.INTERVIEW_STORAGE_KEY), before);
  values.set(library.INTERVIEW_STORAGE_KEY, "corrupted");
  assert.throws(() => library.saveInterview(details), /valid PrepWise/);
  assert.equal(values.get(library.INTERVIEW_STORAGE_KEY), "corrupted");
});
