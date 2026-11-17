import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./load-module.mjs";

const { createInterviewReport } = loadModule("lib/interview-bot.ts");
const base = { action: "start", role: "Frontend Developer", level: "Junior", difficulty: "Medium", focus: "Technical", skills: ["React"], questionCount: 5, turns: [] };
const output = { reply: "You explained the tradeoff clearly.", nextQuestion: "How would you test your solution?", scores: { knowledge: 80, reasoning: 80, communication: 80, roleFit: 80 }, strengths: ["Explained a concrete example."], improvements: ["Discuss edge cases."] };

function configure(t, key) {
  const previous = process.env.GROQ_API_KEY;
  const previousModel = process.env.GROQ_INTERVIEW_MODEL;
  process.env.GROQ_API_KEY = key;
  process.env.GROQ_INTERVIEW_MODEL = "";
  t.after(() => {
    if (previous === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previous;
    if (previousModel === undefined) delete process.env.GROQ_INTERVIEW_MODEL; else process.env.GROQ_INTERVIEW_MODEL = previousModel;
  });
}

function fixture({ answer = output, answers, failure } = {}) {
  const calls = [], models = [];
  const route = loadModule("app/api/interview/turn/route.ts", {
    "@ai-sdk/groq": { createGroq: () => (name) => { models.push(name); return "test-model"; } },
    ai: { Output: { object: (value) => value }, generateText: async (options) => {
      calls.push(options);
      if (failure) throw failure;
      return { output: answers?.[calls.length - 1] ?? answer };
    } },
  });
  return { ...route, calls, models };
}
const request = (body, origin) => new Request("http://localhost/api/interview/turn", { method: "POST", headers: origin ? { origin } : {}, body: JSON.stringify(body) });

test("selection uses the threshold and counts unanswered questions as zero", () => {
  assert.equal(createInterviewReport(output, 5, 5).verdict, "SELECTED");
  const partial = createInterviewReport(output, 2, 5);
  assert.equal(partial.verdict, "REJECTED");
  assert.equal(partial.score, 32);
  assert.match(partial.summary, /2 of 5/);
  const weak = { ...output, scores: { knowledge: 60, reasoning: 60, communication: 60, roleFit: 60 } };
  assert.equal(createInterviewReport(weak, 5, 5).verdict, "REJECTED");
});

test("starting forwards role and complexity and returns one question", async (t) => {
  configure(t, "test-key");
  const route = fixture();
  const response = await route.POST(request(base));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.nextQuestion, output.nextQuestion);
  assert.equal(data.report, null);
  assert.equal(data.complete, false);
  assert.equal(route.models[0], "openai/gpt-oss-20b");
  assert.notEqual(route.calls[0].providerOptions.groq.structuredOutputs, false);
  assert.ok(route.calls[0].maxOutputTokens >= 3000);
  assert.equal(JSON.parse(route.calls[0].prompt).difficulty, "Medium");
  assert.equal(JSON.parse(route.calls[0].prompt).role, "Frontend Developer");
});

test("the final answer returns a mock outcome and no next question", async (t) => {
  configure(t, "test-key");
  const route = fixture();
  const response = await route.POST(request({ ...base, action: "answer", questionCount: 1, turns: [{ question: "Explain your approach.", answer: "I isolate state and test edge cases." }] }));
  const result = await response.json();
  assert.equal(result.complete, true);
  assert.equal(result.nextQuestion, "");
  assert.equal(result.report.verdict, "SELECTED");
  assert.equal(result.report.score, 80);
  assert.equal(result.report.answered, 1);
});

test("invalid sessions and cross-origin requests never reach the model", async (t) => {
  configure(t, "test-key");
  const route = fixture();
  for (const body of [{ ...base, difficulty: "Extreme" }, { ...base, role: "" }, { ...base, action: "answer" }, { ...base, questionCount: 0 }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal((await route.POST(request(base, "https://other.example"))).status, 403);
  assert.equal(route.calls.length, 0);
});

test("missing configuration and quota failures do not fabricate results", async (t) => {
  configure(t, "");
  const disabled = fixture();
  assert.equal((await disabled.POST(request(base))).status, 503);
  assert.equal(disabled.calls.length, 0);
  process.env.GROQ_API_KEY = "test-key";
  t.mock.method(console, "error", () => {});
  const route = fixture({ failure: Object.assign(new Error("private-provider-details"), { statusCode: 429 }) });
  const response = await route.POST(request(base));
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.report, undefined);
  assert.ok(!JSON.stringify(body).includes("private-provider-details"));
});

test("same-origin checks retain the browser host when Next normalizes loopback URLs", async (t) => {
  configure(t, "test-key");
  const route = fixture();
  const normalizedRequest = (origin) => new Request("http://localhost:3187/api/interview/turn", {
    method: "POST",
    headers: { host: "127.0.0.1:3187", origin },
    body: JSON.stringify(base),
  });
  assert.equal((await route.POST(normalizedRequest("http://127.0.0.1:3187"))).status, 200);
  for (const origin of ["http://127.0.0.1:3188", "http://localhost:3187", "https://other.example", "null"]) {
    assert.equal((await route.POST(normalizedRequest(origin))).status, 403);
  }
  assert.equal(route.calls.length, 1);
});

test("ending without an answer returns zero without spending model tokens", async (t) => {
  configure(t, "test-key");
  const route = fixture();
  const response = await route.POST(request({ ...base, action: "finish" }));
  const body = await response.json();
  assert.equal(body.report.verdict, "REJECTED");
  assert.equal(body.report.score, 0);
  assert.equal(route.calls.length, 0);
});

test("a repeated question is replaced once without losing the candidate answer", async (t) => {
  configure(t, "test-key");
  const route = fixture({ answers: [{ ...output, nextQuestion: "EXPLAIN your approach!" }, output] });
  const body = { ...base, action: "answer", turns: [{ question: "Explain your approach.", answer: "I isolate state and test edge cases." }] };
  const response = await route.POST(request(body));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).nextQuestion, output.nextQuestion);
  assert.equal(route.calls.length, 2);
  assert.deepEqual(JSON.parse(route.calls[1].prompt).turns, body.turns);
  assert.equal(route.calls[1].abortSignal, route.calls[0].abortSignal);
});

test("persistent question repetition fails safely after one correction", async (t) => {
  configure(t, "test-key");
  t.mock.method(console, "error", () => {});
  const route = fixture({ answer: { ...output, nextQuestion: "Explain your approach." } });
  const response = await route.POST(request({ ...base, action: "answer", turns: [{ question: "Explain your approach.", answer: "I test edge cases." }] }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /retry/);
  assert.equal(route.calls.length, 2);
});

test("extra generated feedback bullets are capped without rejecting the final evaluation", async (t) => {
  configure(t, "test-key");
  const extended = { ...output, strengths: ["One", "Two", "Three", "Four"], improvements: ["First", "Second", "Third", "Fourth"] };
  const route = fixture({ answer: extended });
  const response = await route.POST(request({ ...base, action: "answer", questionCount: 1, turns: [{ question: "Explain your approach.", answer: "I isolate state and test edge cases." }] }));
  assert.equal(response.status, 200);
  const { report } = await response.json();
  assert.deepEqual(report.strengths, extended.strengths.slice(0, 3));
  assert.deepEqual(report.improvements, extended.improvements.slice(0, 3));
  assert.equal(route.calls[0].output.schema.safeParse(extended).success, true);
  assert.equal(report.verdict, "SELECTED");
});
