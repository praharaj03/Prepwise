# PrepWise

A dark interview-practice workspace built with Next.js 16 and React 19. No sign-in is required. Interviews and results save in the current browser.

## Run

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Solo practice and the 10 sample interviews work without any environment variables. For the adaptive AI video interview, copy `.env.example` to `.env.local` and set the server-only `GROQ_API_KEY`. Credentials are not included in the repository.

## Interview flow

1. Choose a sample interview or create one for a role, experience level, question complexity, and skills.
2. Open **AI video interview**, select **Enable camera & microphone**, and allow both devices. The **Start video interview** button becomes enabled once both are ready.
3. The bot asks one role-specific question at a time. Use **Mute microphone / Unmute microphone** during the interview; muting stops recognition and disables the microphone track while keeping camera preview and typed answers available. Your webcam is a local preview; the interviewer is an animated bot avatar.
4. Answer through the microphone or type and select **Send answer**. Spoken answers are sent after the browser finishes recognizing the turn. The bot gives feedback and asks an adaptive next question.
5. The final report shows **Selected** or **Rejected**, a score, category breakdown, strengths, and improvements. Results save locally and can be downloaded with the transcript.

The result is a mock-interview outcome, not a hiring decision by a real company. The server uses a threshold of 70/100. Ending early counts unanswered questions as zero. The model evaluates text answers, not camera footage or personal appearance.

## Free and optional features

- Browser camera preview, read-aloud, optional browser speech recognition, local storage, and solo practice do not use Vapi credits.
- AI replies use Groq’s `openai/gpt-oss-20b` by default. A working key and available account quota are required. The model appears in Groq’s free-plan limits; usage is not unlimited. Set `GROQ_INTERVIEW_MODEL` only to override the default. [Groq limits](https://console.groq.com/docs/rate-limits).
- The free solo mode uses a curated question bank and has no AI scoring.
- Ten independent company-themed sample sets include locally bundled logos for NVIDIA, Oracle, Zomato, SpaceX, Swiggy, Apple, Google, Microsoft, Amazon, and Netflix. These are not official company questions.

Video is not uploaded or recorded. Text answers are sent to Groq for AI evaluation. Browser dictation may use the browser vendor’s speech service. Voice features depend on browser support; typing remains available. [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).

## Your data

Libraries and mock reports use localStorage for this browser and site address. They do not sync between devices or ports. Use **Export library** and **Import backup** to move or protect them. Clearing browser data removes the local library. Solo answer notes are session-only until downloaded; AI reports save locally.

## Checks

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
```

The repeatable browser-flow check uses installed Google Chrome with synthetic camera and microphone devices:

```sh
npm run build
npm run test:e2e
```

It covers all 10 company samples, device permissions, microphone controls, recognition callbacks, both mock outcomes, browser persistence, backups, and desktop/mobile layouts. AI replies are mocked by default. To also run a real five-answer interview through the browser and Groq, use `npm run test:e2e -- --live`; this needs the configured server key and uses its quota. Screenshots and downloaded test artifacts stay in the ignored `.tmp` folder. `PLAYWRIGHT_CHANNEL` can override the default `chrome` channel.

Fonts and logos are bundled locally. Builds do not download Google Fonts. The app can build with all service settings blank; AI calls then return an explicit setup error and solo practice remains usable.

## Optional legacy cloud integration

The authenticated Firebase/Groq endpoint at `/api/vapi/generate` and Vapi voice component are retained for optional integrations. The default UI does not use them. Firebase SDK instances and session cookies are project-scoped; old project cookies do not gate the current workspace. `.env.local` and service-account JSON remain ignored by Git. Private credentials must never use a `NEXT_PUBLIC_` prefix.

See [SETUP.md](SETUP.md) for setup, [VERIFICATION.md](VERIFICATION.md) for tested flows and remaining findings, and [logo sources](public/companies/SOURCES.md) for attribution.
