import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { loadModule } from "./load-module.mjs";

function setEnvironment(t, values) {
  for (const [name, value] of Object.entries(values)) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
}

function callFixture() {
  const calls = [];
  const fallback = { name: "Built-in interviewer" };
  const { default: Agent } = loadModule("components/Agent.tsx", {
    react: {
      ...React,
      useState: (value) => [value, () => {}],
      useRef: (value) => ({ current: value }),
      useEffect: (effect) => { effect(); },
    },
    "next/image": { default: () => null },
    "next/navigation": { useRouter: () => ({ push() {}, refresh() {} }) },
    sonner: { toast: { error: (message) => { throw new Error(message); } } },
    "@/lib/utils": { cn: () => "" },
    "@/lib/vapi.sdk": { vapi: {
      on() {},
      start: async (...args) => { calls.push(args); return { id: "call" }; },
    } },
    "@/constants": { interviewer: fallback },
    "@/firebase/client": { getClientAuth: () => ({
      authStateReady: async () => {},
      currentUser: { uid: "candidate", getIdToken: async () => "verified-token" },
    }) },
  });
  const start = async (type) => {
    const tree = Agent({ userName: "Candidate", userId: "candidate", type, questions: ["First?", "Second?"] });
    function findStartButton(node) {
      if (!node || typeof node !== "object") return null;
      if (node.props?.["aria-label"] === "Start voice call") return node;
      for (const child of React.Children.toArray(node.props?.children)) {
        const found = findStartButton(child);
        if (found) return found;
      }
      return null;
    }
    const button = findStartButton(tree);
    assert.ok(button, "Voice room should include a start-call control");
    await button.props.onClick();
  };
  return { calls, fallback, start };
}

test("practice uses the configured assistant with matching name and question variables", async (t) => {
  setEnvironment(t, {
    NEXT_PUBLIC_VAPI_WEB_TOKEN: "public-key",
    NEXT_PUBLIC_VAPI_INTERVIEW_ASSISTANT_ID: "practice-assistant",
    NEXT_PUBLIC_VAPI_GENERATION_ASSISTANT_ID: "generation-assistant",
  });
  const { calls, start } = callFixture();
  await start("interview");
  assert.deepEqual(calls, [["practice-assistant", {
    variableValues: { username: "Candidate", userName: "Candidate", questions: "First?\nSecond?" },
  }]]);
  await start("generate");
  assert.deepEqual(calls[1], ["generation-assistant", {
    variableValues: { userName: "Candidate", userId: "candidate", userid: "candidate", idToken: "verified-token" },
  }]);
});

test("practice retains the built-in interviewer when no practice assistant is configured", async (t) => {
  setEnvironment(t, {
    NEXT_PUBLIC_VAPI_WEB_TOKEN: "public-key",
    NEXT_PUBLIC_VAPI_INTERVIEW_ASSISTANT_ID: "",
  });
  const { calls, fallback, start } = callFixture();
  await start("interview");
  assert.equal(calls[0][0], fallback);
});
