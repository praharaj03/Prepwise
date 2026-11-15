import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { loadModule } from "./load-module.mjs";

function authFixture({ claims = {}, profile, rejected = false, session } = {}) {
  const profiles = new Map(profile ? [["verified-user", profile]] : []);
  const writtenCookies = [];
  let tokenChecks = 0;
  const decoded = {
    uid: "verified-user", email: "user@example.com", name: "Test User",
    auth_time: Math.floor(Date.now() / 1000), ...claims,
  };
  const actions = loadModule("lib/actions/auth.action.ts", {
    "@/firebase/admin": {
      auth: {
        verifyIdToken: async () => {
          tokenChecks++;
          if (rejected) throw new Error("Invalid token");
          return decoded;
        },
        verifySessionCookie: async () => decoded,
        createSessionCookie: async () => "signed-cookie",
      },
      db: {
        collection: () => ({ doc: (id) => ({
          id, get: async () => ({ id, exists: profiles.has(id), data: () => profiles.get(id) }),
        }) }),
        runTransaction: async (operation) => operation({
          get: (ref) => ref.get(),
          set: (ref, value) => profiles.set(ref.id, value),
        }),
      },
    },
    "next/headers": { cookies: async () => ({
      get: () => session ? { value: session } : undefined,
      set: (...args) => writtenCookies.push(args),
    }) },
  });
  return { actions, profiles, writtenCookies, tokenChecks: () => tokenChecks };
}

test("signup uses verified identity and is safe to retry", async () => {
  const { actions, profiles } = authFixture();
  const params = { idToken: "valid", name: "  Candidate  ", uid: "victim", email: "victim@example.com" };
  assert.equal((await actions.signUp(params)).success, true);
  assert.deepEqual(profiles.get("verified-user"), { name: "Candidate", email: "user@example.com" });
  assert.equal(profiles.has("victim"), false);
  assert.equal((await actions.signUp({ ...params, name: "Replacement" })).success, true);
  assert.equal(profiles.get("verified-user").name, "Candidate");
});

test("signup rejects requests without proof of identity", async (t) => {
  t.mock.method(console, "error", () => {});
  const { actions, profiles, tokenChecks } = authFixture();
  assert.equal((await actions.signUp({ uid: "victim", name: "Candidate" })).success, false);
  assert.equal(profiles.size, 0);
  assert.equal(tokenChecks(), 0);
});

test("sign-in rejects a token for a different email without setting a cookie", async () => {
  const { actions, writtenCookies, profiles } = authFixture();
  assert.equal((await actions.signIn({ email: "victim@example.com", idToken: "valid" })).success, false);
  assert.equal(writtenCookies.length, 0);
  assert.equal(profiles.size, 0);
});

test("sign-in recovers a missing profile and creates an HTTP-only session", async () => {
  const { actions, profiles, writtenCookies } = authFixture();
  assert.equal((await actions.signIn({ email: "user@example.com", idToken: "valid" })).success, true);
  assert.equal(profiles.get("verified-user").name, "Test User");
  assert.equal(writtenCookies[0][0], "session");
  assert.equal(writtenCookies[0][2].httpOnly, true);
  assert.equal(writtenCookies[0][2].maxAge, 604800);
});

test("session creation rejects old authentication", async () => {
  const { actions, writtenCookies } = authFixture({ claims: { auth_time: 1 } });
  await assert.rejects(actions.setSessionCookie("valid"), /sign in again/);
  assert.equal(writtenCookies.length, 0);
});

test("missing sessions return null without token verification", async () => {
  const { actions, tokenChecks } = authFixture();
  assert.equal(await actions.getCurrentUser(), null);
  assert.equal(tokenChecks(), 0);
});

function routeFixture({ user = null, invalidToken = false, output, generationError } = {}) {
  const writes = [];
  const generations = [];
  const route = loadModule("app/api/vapi/generate/route.ts", {
    "@/firebase/admin": {
      auth: { verifyIdToken: async () => {
        if (invalidToken) throw new Error("Invalid token");
        return { uid: "verified-user" };
      } },
      db: { collection: () => ({ add: async (document) => {
        writes.push(document);
        return { id: "new-interview" };
      } }) },
    },
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/lib/utils": { getRandomInterviewCover: () => "/covers/adobe.png" },
    "@ai-sdk/groq": { createGroq: () => () => "existing-model" },
    ai: {
      Output: { object: (options) => options },
      generateText: async (options) => {
        generations.push(options);
        if (generationError) throw generationError;
        return { output: output ?? { questions: ["Explain React.", "Describe testing."] } };
      },
    },
  });
  return { ...route, writes, generations };
}

const validBody = { role: "Frontend", type: "Technical", level: "Junior", techstack: " React, TypeScript, ", amount: "2", userid: "verified-user" };
const request = (body, authorization = "Bearer valid") => new Request("http://localhost/api/vapi/generate", {
  method: "POST", headers: authorization ? { authorization } : {},
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("generation requires authentication before calling AI or writing data", async () => {
  const route = routeFixture();
  assert.equal((await route.POST(request(validBody, null))).status, 401);
  assert.equal(route.generations.length, 0);
  assert.equal(route.writes.length, 0);
});

test("generation rejects invalid bearer tokens", async () => {
  const route = routeFixture({ invalidToken: true });
  assert.equal((await route.POST(request(validBody))).status, 401);
  assert.equal(route.generations.length, 0);
});

test("generation returns 400 for malformed JSON", async () => {
  const route = routeFixture();
  assert.equal((await route.POST(request("{"))).status, 400);
  assert.equal(route.generations.length, 0);
});

test("generation validates question limits and required fields", async () => {
  const route = routeFixture();
  for (const body of [null, {}, { ...validBody, amount: 0 }, { ...validBody, amount: 21 },
    { ...validBody, amount: true }, { ...validBody, amount: 2.5 }, { ...validBody, techstack: ", ," }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal(route.generations.length, 0);
});

test("generation rejects attempts to write interviews for another user", async () => {
  const route = routeFixture();
  assert.equal((await route.POST(request({ ...validBody, userid: "victim" }))).status, 403);
  assert.equal(route.writes.length, 0);
});

test("generation persists validated questions, trimmed tech names, and verified identity", async () => {
  const route = routeFixture();
  const response = await route.POST(request(validBody));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, interviewId: "new-interview" });
  assert.equal(route.writes[0].userId, "verified-user");
  assert.deepEqual(route.writes[0].techstack, ["React", "TypeScript"]);
  assert.equal(route.writes[0].questions.length, 2);
});

test("generation also accepts an authenticated browser session", async () => {
  const route = routeFixture({ user: { id: "verified-user" } });
  assert.equal((await route.POST(request(validBody, null))).status, 200);
});

test("invalid AI output never reaches Firestore or leaks errors to the client", async (t) => {
  t.mock.method(console, "error", () => {});
  const route = routeFixture({ output: { questions: ["Only one question"] } });
  const response = await route.POST(request(validBody));
  assert.equal(response.status, 500);
  assert.equal(route.writes.length, 0);
  assert.equal((await response.json()).error, "Failed to generate the interview. Please try again.");
});

test("missing interview documents return null; existing documents include their actual ID", async () => {
  const load = (exists) => loadModule("lib/actions/general.action.ts", {
    "server-only": {},
    "@/firebase/admin": { db: { collection: () => ({ doc: () => ({
      get: async () => ({ exists, id: "actual-id", data: () => ({ id: "stale-id", role: "Frontend" }) }),
    }) }) } },
  });
  assert.equal(await load(false).getInterviewById("missing"), null);
  assert.deepEqual(await load(true).getInterviewById("actual-id"), { id: "actual-id", role: "Frontend" });
});

test("form fields associate labels and validation messages with the correct input", () => {
  // Share one module cache so the wrapper and field use the same React context.
  const cache = new Map();
  const { Form } = loadModule("components/ui/form.tsx", {}, cache);
  const { default: FormField } = loadModule("components/FormField.tsx", {}, cache);
  function Example() {
    const form = useForm({ defaultValues: { email: "" }, errors: { email: { type: "required", message: "Email is required" } } });
    return React.createElement(Form, { ...form }, React.createElement(FormField, {
      control: form.control, name: "email", label: "Email", type: "email",
    }));
  }
  const html = renderToStaticMarkup(React.createElement(Example));
  const inputId = /<input[^>]*\bid="([^"]+)"/.exec(html)?.[1];
  assert.ok(inputId);
  assert.ok(html.includes(`for="${inputId}"`));
  assert.ok(html.includes("Email is required"));
  assert.ok(html.includes('aria-invalid="true"'));
});
