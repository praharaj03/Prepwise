# Make PrepWise usable

No sign-in is required. Open `http://localhost:3000` after running `npm run dev`.

## AI video interviews

1. Copy `.env.example` to `.env.local` and set a working `GROQ_API_KEY`. Keep any existing local credentials when updating an installed copy. Restart the dev server after changing it. No Vapi public key or wallet credits are needed for this flow.
2. Choose a sample or create an interview. Select the role, experience level, **Easy / Medium / Hard** complexity, focus, skills, and number of questions.
3. Open the interview and select **Enable camera & microphone**. Allow both devices. Only then can you select **Start video interview**.
4. The bot asks a question and listens for your answer. You can also type and select **Send answer**. It reacts to your answer and chooses the next question according to your performance.
5. Finish the questions to see **Selected / Rejected**, score, strengths, and improvements. Download the report if you want to keep the full transcript.

This is an AI mock interview. The bot is an animated avatar, while your camera is a local video preview. Video is not uploaded or recorded. Evaluation uses the text of your answers. A score of at least 70/100 produces Selected; unattempted questions count as zero if you end early.

The default model is `openai/gpt-oss-20b`, listed in [Groq’s free-plan limits](https://console.groq.com/docs/rate-limits). AI calls require network access and available quota. They are not unlimited. The configured key and native structured responses were verified with synthetic interview requests. If the provider fails, the app keeps your answer for retry and does not fabricate a result.

## Without an AI key

Choose **Solo practice**. Curated questions, browser read-aloud, optional dictation, typed notes, and downloads work without provider keys or sign-in. Solo mode does not produce an AI selection score.

## Keep your work

Interviews and AI reports save in this browser, not in Firebase. Export your library before clearing browser data. Import backups to restore or merge them. Different domains, ports, and browsers use separate storage. No cloud account is required.

## Deployment

Use the repository root and Next.js preset, with `npm run build`. For AI interviews, add `GROQ_API_KEY` as a server-only environment variable on the host. Use HTTPS for camera and microphone access; localhost also supports development. Hosting quotas and plan terms apply separately.

The existing Firebase project and Vapi integrations are optional. No Firebase billing plan was changed, and they are not required for the main no-sign-in flow.
