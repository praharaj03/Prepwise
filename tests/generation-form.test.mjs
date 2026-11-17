import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { loadModule } from "./load-module.mjs";

const fields = { role: "Frontend Developer", level: "Junior", type: "Technical", techstack: "React, TypeScript", amount: "5" };
function fixture(t, storageError) {
  const saved = [], navigations = [], states = [];
  t.mock.method(globalThis, "FormData", function () { return new Map(Object.entries(fields)); });
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Free creation must not make network requests"); });
  const { default: GenerationForm } = loadModule("components/GenerationForm.tsx", {
    react: { ...React, useState: (initial) => [initial, (value) => states.push(value)] },
    "next/navigation": { useRouter: () => ({ push: (path) => navigations.push(path) }) },
    "@/lib/local-interviews": { saveInterview: (input) => { if (storageError) throw storageError; saved.push(input); return { id: "prepared-interview" }; } },
  });
  const form = GenerationForm().props.children[0];
  return { saved, navigations, states, fetch, submit: () => form.props.onSubmit({ preventDefault() {}, currentTarget: {} }) };
}

test("free creation saves locally and opens the interview without a network request", async (t) => {
  const { submit, saved, navigations, fetch } = fixture(t);
  await submit();
  assert.deepEqual(saved, [fields]);
  assert.deepEqual(navigations, ["/interview/prepared-interview"]);
  assert.equal(fetch.mock.callCount(), 0);
});

test("unavailable storage displays the error and preserves the form", async (t) => {
  const { submit, states, navigations } = fixture(t, new Error("Browser storage is unavailable or full."));
  await submit();
  assert.ok(states.includes("Browser storage is unavailable or full."));
  assert.equal(navigations.length, 0);
  assert.equal(states.at(-1), false);
});
