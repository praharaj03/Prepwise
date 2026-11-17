import assert from "node:assert/strict";

export async function verifyMediaFlow(browser, base) {
  const context = await browser.newContext({ permissions: ["camera", "microphone"] });
  try {
    await context.addInitScript(() => {
      window.__streams = [];
      window.__recognitions = [];
      const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => {
        const stream = await capture(constraints);
        window.__streams.push(stream);
        return stream;
      };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [], cancel() {}, speak(utterance) { setTimeout(() => utterance.onstart?.(), 0); } } });
      window.SpeechRecognition = class {
        constructor() { window.__recognitions.push(this); }
        start() { this.started = true; }
        stop() { this.onend?.(); }
        abort() { this.aborted = true; this.onend?.(); }
      };
    });
    const page = await context.newPage();
    const requests = [];
    await page.route("**/api/interview/turn", async route => {
      const data = route.request().postDataJSON();
      requests.push(data);
      await route.fulfill({ json: { reply: "Let us discuss your approach.", nextQuestion: "Explain your design decision " + (data.turns.length + 1) + ".", complete: false, report: null } });
    });
    await page.goto(base + "/interview/starter-google", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Enable camera & microphone", exact: true }).click();
    await page.getByRole("button", { name: "Start video interview", exact: true }).click();
    await page.getByLabel("Your answer", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Stop interviewer audio", exact: true }).click();
    await page.getByRole("button", { name: "Answer by voice", exact: true }).click();
    await page.evaluate(() => window.__recognitions.at(-1).onresult({ results: [{ isFinal: true, 0: { transcript: "I keep state close to its owner." } }] }));
    await page.getByRole("button", { name: "Mute microphone", exact: true }).click();
    assert.equal(requests.length, 1, "Muting must not submit a partial answer");
    assert.equal(await page.evaluate(() => window.__recognitions[0].aborted), true);
    assert.equal(await page.evaluate(() => window.__streams.at(-1).getAudioTracks().every(track => !track.enabled)), true);
    await page.getByRole("button", { name: "Unmute microphone", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__streams.at(-1).getAudioTracks().every(track => track.enabled)), true);
    const submitted = page.waitForRequest(request => request.url().endsWith("/api/interview/turn") && request.method() === "POST");
    await page.evaluate(() => {
      const recognition = window.__recognitions.at(-1);
      recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "Then I lift shared state to the nearest common parent." } }] });
      recognition.onend();
    });
    const payload = (await submitted).postDataJSON();
    assert.equal(payload.turns.length, 1);
    assert.match(payload.turns[0].answer, /close to its owner/);
    assert.match(payload.turns[0].answer, /nearest common parent/);
    await page.waitForFunction(() => document.querySelector(".bot-conversation h2")?.textContent.includes("decision 2"));
    await page.evaluate(() => window.__recognitions[0].onend?.());
    assert.equal(requests.length, 2, "A stale recognition callback must not submit again");
    await page.getByRole("button", { name: "Turn camera off", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__streams.at(-1).getVideoTracks().every(track => !track.enabled)), true);
    assert.equal(await page.evaluate(() => window.__streams.at(-1).getAudioTracks().every(track => track.enabled)), true);
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page.waitForURL(base + "/");
    await page.waitForFunction(() => window.__streams.every(stream => stream.getTracks().every(track => track.readyState === "ended")), undefined, { timeout: 3000 });
    assert.equal(await page.evaluate(() => window.__streams.every(stream => stream.getTracks().every(track => track.readyState === "ended"))), true);
    console.log("Media: recognized answers, mute cancellation, unmute, stale callbacks, camera toggle, and navigation cleanup passed.");

    await page.goto(base + "/interview/starter-google", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Enable camera & microphone", exact: true }).click();
    const start = page.getByRole("button", { name: "Start video interview", exact: true });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.includes("Start video interview") && !button.disabled));
    await page.evaluate(() => window.__streams.at(-1).getAudioTracks()[0].dispatchEvent(new Event("ended")));
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.includes("Start video interview") && button.disabled), undefined, { timeout: 3000 });
    assert.equal(await start.isEnabled(), false, "Start must become unavailable when a required device disconnects");
    assert.equal(await page.evaluate(() => window.__streams.at(-1).getTracks().every(track => track.readyState === "ended")), true);
    console.log("Media: required-device disconnection disables Start and releases capture.");
  } finally { await context.close(); }
}
