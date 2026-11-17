import assert from "node:assert/strict";

function answerFor(question) {
  const text = question.toLowerCase();
  if (/useeffect|effect hook|side effect|fetch|request|api|async/.test(text)) return "I use an effect for synchronization with an external system, not to duplicate derived state. I declare the values it reads as dependencies and return cleanup for subscriptions or an AbortController for fetches. I model loading, success, and error states, handle non-success responses, and prevent a stale response from replacing newer data. I would test unmounting, rapid parameter changes, empty responses, and network failures.";
  if (/state|context|usestate|usereducer|redux|prop/.test(text)) return "I keep state with its closest owner and lift it to the nearest common parent when siblings share it. I pass values and callbacks through props, use context for genuinely shared low-frequency data, and use a reducer when transitions become complex. I keep updates immutable, use functional updates when depending on the previous value, and derive values rather than storing duplicate state. I profile before introducing memoization.";
  if (/accessib|html|form|keyboard|aria|semantic/.test(text)) return "I start with semantic HTML and native controls. Each input has a real label and validation messages linked with aria-describedby. The interface must work with a keyboard, maintain visible focus, and move focus predictably after dialogs or errors. I test headings, landmarks, contrast, and screen-reader output, then add ARIA only where native semantics are insufficient.";
  if (/performance|render|memo|virtual|optim/.test(text)) return "I reproduce the slow interaction and measure it using browser performance tools and React Profiler. I separate network, JavaScript, and rendering costs. I keep state local, avoid duplicate derived state, split unnecessarily large components, and memoize only measured expensive work or stable props. For long lists I consider virtualization, and I compare the same interaction before and after the change.";
  if (/typescript|type|generic|union/.test(text)) return "TypeScript checks the shapes of values before runtime. I type component props and use discriminated unions to represent mutually exclusive loading, success, and failure states. I narrow unknown input with guards or runtime schemas, because types do not validate external JSON. I use generics for reusable relationships rather than replacing useful constraints with any.";
  if (/css|layout|responsive|grid|flex/.test(text)) return "I build the layout mobile first, use flexible widths and appropriate flex or grid layouts, then add breakpoints where the content requires them. I avoid fixed widths that cause overflow, preserve readable text and useful touch targets, and test keyboard focus and long content at several viewport sizes. I verify the result in a real browser instead of relying only on a screenshot.";
  if (/closure|scope|javascript|event loop|promise/.test(text)) return "JavaScript closures retain access to their lexical environment. In React an event handler or asynchronous callback can capture a value from an earlier render, so I use functional state updates when an update depends on previous state and keep effect dependencies accurate. Promise callbacks run as microtasks after the current stack; I avoid blocking the main thread and test asynchronous failure paths.";
  if (/test|debug|bug|error/.test(text)) return "I first reproduce the behavior and define the expected outcome. I narrow the failing boundary using logs, browser tools, and a minimal example, then test the fix at that boundary. I cover the successful path, invalid input, asynchronous failure, and cleanup, and add a regression test that would fail before the change. I rerun the affected tests and the production build.";
  return "I would clarify the expected behavior and constraints, choose the simplest implementation that meets them, and explain the alternatives and tradeoffs. In a React interface I keep components focused, state immutable and close to its owner, and external data validated at the boundary. I cover loading and error states, test accessibility and edge cases, and use measurements and user feedback to decide what to improve.";
}

export async function verifyLiveFlow(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["camera", "microphone"] });
  try {
    await context.addInitScript(() => {
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [], cancel() {}, speak(utterance) { setTimeout(() => utterance.onstart?.(), 0); } } });
      Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
      Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
    });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", error => browserErrors.push(error.message));
    const availability = await page.request.get(base + "/api/interview/turn");
    assert.equal((await availability.json()).available, true, "The live run needs a configured GROQ_API_KEY");
    await page.goto(base + "/interview", { waitUntil: "networkidle" });
    await page.getByLabel("What role are you preparing for?").fill("Frontend Developer");
    await page.getByLabel("Experience level").selectOption("Junior");
    await page.getByLabel("Question complexity").selectOption("Easy");
    await page.getByLabel("Skills & technologies").fill("React, TypeScript, HTML, CSS");
    await page.getByRole("button", { name: "Create interview", exact: true }).click();
    await page.getByRole("button", { name: "Enable camera & microphone", exact: true }).click();

    async function sendAndRead(click) {
      const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/interview/turn") && response.request().method() === "POST", { timeout: 50_000 });
      await click();
      const response = await responsePromise;
      const data = await response.json();
      assert.equal(response.status(), 200, data.error || "Live interviewer returned an error");
      return data;
    }

    let data = await sendAndRead(() => page.getByRole("button", { name: "Start video interview", exact: true }).click());
    assert.ok(data.nextQuestion);
    assert.equal(data.report, null);
    const asked = new Set([data.nextQuestion]);
    await page.getByRole("button", { name: "Mute microphone", exact: true }).click();
    console.log("Live AI: opening question returned successfully.");
    for (let index = 0; index < 5; index++) {
      // Pace synthetic answers so the free-tier token budget is not flooded.
      await new Promise(resolve => setTimeout(resolve, 13_000));
      const draft = page.getByLabel("Your answer", { exact: false });
      await draft.fill(answerFor(data.nextQuestion));
      data = await sendAndRead(() => page.getByRole("button", { name: "Send answer", exact: true }).click());
      if (index < 4) {
        assert.ok(data.nextQuestion);
        assert.equal(data.complete, false);
        assert.ok(!asked.has(data.nextQuestion), "The interviewer must not repeat a question verbatim");
        asked.add(data.nextQuestion);
      }
      console.log("Live AI: answer " + (index + 1) + "/5 evaluated successfully.");
    }
    assert.equal(data.complete, true);
    assert.ok(["SELECTED", "REJECTED"].includes(data.report.verdict));
    assert.ok(data.report.score >= 0 && data.report.score <= 100);
    assert.equal(data.report.verdict, data.report.score >= 70 ? "SELECTED" : "REJECTED");
    assert.equal(data.report.answered, 5);
    assert.equal(data.report.total, 5);
    await page.locator(".interview-result").waitFor();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("prepwise:interviews:v1")));
    assert.deepEqual(stored[0].lastResult, data.report);
    assert.equal(await page.evaluate(() => document.querySelector(".candidate-video").srcObject), null);
    assert.deepEqual(browserErrors, []);
    await page.screenshot({ path: ".tmp/live-result.png", fullPage: true });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("prepwise:interviews:v1"))))[0].lastResult.score, data.report.score);
    console.log("Live AI: full five-answer browser interview and saved result passed (" + data.report.verdict + ", " + data.report.score + "/100).");
  } finally { await context.close(); }
}
