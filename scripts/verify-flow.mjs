import { spawn } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { verifyLiveFlow } from './verify-live-flow.mjs';
import { verifyMediaFlow } from './verify-media-flow.mjs';
fs.mkdirSync('.tmp', { recursive: true });
const base = 'http://127.0.0.1:3187';
const production = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3187'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
production.stdout.on('data', data => { logs += data; });
production.stderr.on('data', data => { logs += data; });
let browser;
(async () => {
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { const result = await fetch(base); if (result.ok) { ready = true; break; } } catch {}
      if (production.exitCode !== null) throw new Error(logs);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Workspace should serve without sign-in');
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['camera', 'microphone'], acceptDownloads: true });
    await context.addCookies([{ name: 'session', value: 'old-project-cookie', domain: '127.0.0.1', path: '/' }]);
    await context.addInitScript(() => {
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, speak(utterance) { setTimeout(() => utterance.onstart?.(), 0); } } });
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: undefined });
      Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: undefined });
    });
    const page = await context.newPage();
    const pageErrors = [], external = [], payloads = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url()); });
    let retried = false;
    const questions = ['Explain how you would design a reliable feature.', 'What tradeoff would you make in that design?', 'How would you test the edge cases?', 'How would you measure the result?', 'What would you improve after receiving feedback?'];
    await page.route('**/api/interview/turn', async route => {
      const data = route.request().postDataJSON();
      payloads.push(data);
      if (data.turns.at(-1)?.answer.includes('RETRY') && !retried) { retried = true; await route.fulfill({ status: 429, json: { error: 'Test quota reached. Please retry your answer.' } }); return; }
      const complete = data.action === 'finish' || data.turns.length >= data.questionCount;
      const answered = data.turns.length;
      const score = Math.round(85 * answered / data.questionCount);
      const report = complete ? { score, verdict: score >= 70 ? 'SELECTED' : 'REJECTED', summary: answered ? 'You supported your approach with clear reasoning and concrete examples.' : 'No answers were submitted.', scores: { knowledge: score, reasoning: score, communication: score, roleFit: score }, strengths: answered ? ['Clear examples and reasoning.'] : [], improvements: ['Discuss failure cases in more detail.'], answered, total: data.questionCount } : null;
      await route.fulfill({ status: 200, json: { reply: data.action === 'start' ? 'Welcome to your role-based mock interview.' : 'You explained your approach. Let us explore the next tradeoff.', nextQuestion: complete ? '' : questions[answered % questions.length], complete, report } });
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.interview-card').first().waitFor();
    assert.match(await page.title(), /PrepWise/);
    assert.equal(await page.locator('.interview-card').count(), 10);
    await page.screenshot({ path: '.tmp/dashboard-desktop.png', fullPage: true });
    for (const company of ['NVIDIA', 'Oracle', 'Zomato', 'SpaceX', 'Swiggy', 'Apple', 'Google', 'Microsoft', 'Amazon', 'Netflix']) {
      await page.getByLabel('Search interviews').fill(company);
      assert.equal(await page.locator('.interview-card').count(), 1, company);
      await page.getByRole('img', { name: company + ' logo', exact: true }).waitFor();
      await page.getByRole('img', { name: company + ' logo', exact: true }).evaluate(image => image.decode());
      await page.getByRole('link', { name: 'Start practice', exact: true }).click();
      await page.getByRole('button', { name: 'Start video interview', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Start video interview', exact: true }).isEnabled(), false);
      await page.getByRole('button', { name: 'Enable camera & microphone', exact: true }).click();
      await page.getByRole('button', { name: 'Start video interview', exact: true }).click();
      await page.getByLabel('Your answer', { exact: false }).waitFor();
      assert.ok((await page.locator('h1').innerText()).includes(payloads.at(-1).role), company + ' role context');
      await page.getByRole('link', { name: 'Overview', exact: true }).click();
      await page.getByLabel('Search interviews').fill('');
    }
    console.log('Verified video-room entry and role context for all 10 company samples.');
    await page.getByRole('link', { name: 'Create interview', exact: true }).click();
    await page.getByLabel('What role are you preparing for?').fill('QA Engineer');
    await page.getByLabel('Experience level').selectOption('Senior');
    await page.getByLabel('Question complexity').selectOption('Hard');
    await page.getByLabel('Skills & technologies').fill('Playwright, API testing');
    await page.screenshot({ path: '.tmp/create-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Create interview', exact: true }).click();
    await page.getByRole('button', { name: 'Start video interview', exact: true }).waitFor();
    const interviewUrl = page.url();
    await page.screenshot({ path: '.tmp/video-room-ready.png', fullPage: true });
    assert.equal(await page.getByRole('button', { name: 'Start video interview', exact: true }).isEnabled(), false);
      await page.getByRole('button', { name: 'Enable camera & microphone', exact: true }).click();
      await page.getByRole('button', { name: 'Start video interview', exact: true }).click();
    await page.getByLabel('Your answer', { exact: false }).waitFor();
    assert.equal(payloads.at(-1).difficulty, 'Hard');
    assert.equal(payloads.at(-1).role, 'QA Engineer');
    await page.waitForFunction(() => document.querySelector('.candidate-video')?.srcObject !== null);
    await page.getByRole('button', { name: 'Stop interviewer audio', exact: true }).click();
    await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    assert.ok(await page.evaluate(() => document.querySelector('.candidate-video').srcObject.getAudioTracks().every(track => !track.enabled)));
    await page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Speech recognition' }).waitFor();
    const answer = page.getByLabel('Your answer', { exact: false });
    await answer.fill('RETRY: I isolate the system boundary, test failure cases, and compare the result with a baseline.');
    await page.getByRole('button', { name: 'Send answer', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Test quota' }).waitFor();
    assert.ok((await answer.inputValue()).includes('RETRY'));
    await page.getByRole('button', { name: 'Send answer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.ai-answer textarea')?.value === '');
    await page.screenshot({ path: '.tmp/video-room-active.png', fullPage: true });
    for (let index = 1; index < 5; index++) {
      await answer.fill('I would test the requirement with concrete examples, handle edge cases, and measure the outcome ' + index + '.');
      await page.getByRole('button', { name: 'Send answer', exact: true }).click();
      if (index < 4) await page.waitForFunction(() => document.querySelector('.ai-answer textarea')?.value === '');
    }
    await page.getByRole('heading', { name: /^Selected/ }).waitFor();
    assert.equal(await page.evaluate(() => document.querySelector('.candidate-video').srcObject === null), true);
    await page.screenshot({ path: '.tmp/result-desktop.png', fullPage: true });
    const reportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download report', exact: true }).click();
    const reportFile = await reportDownload;
    await reportFile.saveAs('.tmp/test-result.json');
    const report = JSON.parse(fs.readFileSync('.tmp/test-result.json', 'utf8'));
    assert.equal(report.verdict, 'SELECTED');
    assert.equal(report.transcript.length, 5);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Result mobile overflow');
    await page.screenshot({ path: '.tmp/result-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Interview again', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Start video interview', exact: true }).isEnabled(), false);
    await page.getByRole('button', { name: 'Enable camera & microphone', exact: true }).click();
    await page.getByRole('button', { name: 'Start video interview', exact: true }).click();
    await answer.waitFor();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'End interview', exact: true }).click();
    await page.getByRole('heading', { name: /^Rejected/ }).waitFor();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^My interviews/ }).click();
    assert.equal(await page.locator('.interview-card').count(), 1);
    assert.ok((await page.locator('.outcome-badge').innerText()).includes('Rejected'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^My interviews/ }).click();
    assert.equal(await page.locator('.interview-card').count(), 1);
    const backupDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export library', exact: true }).click();
    await (await backupDownload).saveAs('.tmp/library-backup.json');
    assert.equal(JSON.parse(fs.readFileSync('.tmp/library-backup.json', 'utf8')).length, 1);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete QA Engineer interview', exact: true }).click();
    assert.equal(await page.locator('.interview-card').count(), 0);
    await page.getByLabel('Import library backup').setInputFiles('.tmp/library-backup.json');
    await page.locator('.interview-card').waitFor();
    await page.goto(interviewUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Solo practice', exact: true }).click();
    await page.getByRole('button', { name: 'Start free practice', exact: true }).click();
    await page.getByLabel('Your answer or notes').fill('My practice notes.');
    await page.getByRole('button', { name: 'Next question', exact: true }).click();
    assert.match(await page.locator('.free-question .eyebrow').innerText(), /02/);
    for (const route of ['/', '/interview', '/guide', '/interview/starter-google']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + route, { waitUntil: 'networkidle' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' mobile overflow');
      await page.screenshot({ path: '.tmp/' + (route === '/' ? 'dashboard' : route === '/guide' ? 'guide' : route === '/interview' ? 'create' : 'video-room') + '-mobile.png', fullPage: true });
    }
    await page.goto(base + '/guide', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.guide-card').count(), 6);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '.tmp/guide-desktop.png', fullPage: true });
    for (const path of ['/sign-in', '/sign-up']) {
      const response = await page.request.get(base + path, { maxRedirects: 0 });
      assert.equal(response.status(), 307);
      assert.equal(response.headers().location, '/');
    }
    const legacyApi = await page.request.post(base + '/api/vapi/generate', { data: {} });
    assert.equal(legacyApi.status(), 401);
    const denied = await context.newPage();
    await denied.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); }; });
    await denied.goto(base + '/interview/starter-google', { waitUntil: 'networkidle' });
    assert.equal(await denied.getByRole('button', { name: 'Start video interview', exact: true }).isEnabled(), false);
    await denied.getByRole('button', { name: 'Enable camera & microphone', exact: true }).click();
    await denied.getByRole('status').filter({ hasText: 'Allow both camera and microphone' }).waitFor();
    assert.equal(await denied.getByRole('button', { name: 'Start video interview', exact: true }).isEnabled(), false);
    await denied.close();
    await verifyMediaFlow(browser, base);
    if (process.argv.includes('--live')) await verifyLiveFlow(browser, base);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(external, []);
    assert.ok(!logs.includes('incorrect "aud"'));
    console.log('Passed: no-sign-in entry with stale cookie, 10 company video samples, role/complexity, camera preview and cleanup, microphone fallback, answer retry, Selected and Rejected outcomes, saved results, export/import/delete, solo mode, six-step guide, branding, desktop/mobile layouts.');
    console.log(process.argv.includes('--live')
      ? 'Controlled cases used mocked AI; the additional five-answer interview used real Groq responses. Speech playback was simulated and camera/microphone used Chrome synthetic media. No real camera recording or cloud records were used.'
      : 'AI responses and speech playback were mocked; camera used Chrome synthetic media. No provider generation credits, real camera recordings, or cloud records were used.');
  } catch (error) {
    console.error(error.stack);
    console.error(logs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    production.kill();
  }
})();
