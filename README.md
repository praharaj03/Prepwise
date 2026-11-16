# PrepWise

AI interview practice built with Next.js 16, Firebase Authentication / Firestore, Vapi, and the Vercel AI SDK with Groq.

## Local development

```sh
npm ci
npm run dev
```

Create `.env.local` with these variables:

```dotenv
NEXT_PUBLIC_VAPI_WEB_TOKEN=your-vapi-public-key
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your-interview-generation-assistant-id
GROQ_API_KEY=your-groq-api-key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-service-account-email
FIREBASE_PRIVATE_KEY="your-private-key-with-escaped-newlines"
```

The browser Firebase configuration is in `firebase/client.ts`. It must point to the same project as the Admin SDK. Enable Email/Password authentication and authorize the application domain in Firebase Authentication.

Keep service-account JSON files and `.env.local` out of version control. The application reads Admin credentials from the environment; it does not need a JSON key file in the repository.

## Vercel deployment

Import this repository with the repository root (`.`) as the Root Directory and add the environment variables above to the Production environment. `vercel.json` pins the Next.js framework preset, `npm run build`, and the `.next` output directory so Vercel packages the server routes correctly.

After changing build settings, create a new deployment. A successful `next build` alone is not enough if Vercel is configured to publish the app as a generic static site; that can result in a platform `404 NOT_FOUND` for every route.

## Firestore indexes

The dashboard works without manually created composite indexes. When Firebase reports a missing index, it falls back to single-field queries: your interviews are sorted on the server, and available interviews are read in chronological pages and filtered until the requested count is reached.

For larger collections, the two composite indexes in `firestore.indexes.json` make those reads more efficient. Optionally deploy them using a Firebase account with index-management permission:

```sh
npx firebase-tools deploy --only firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
```

Once the indexes are ready, the dashboard automatically uses the indexed queries. A service account with only application data access cannot create indexes. Other database errors, such as denied access or connection failures, still surface normally.

## Vapi generation tool

The generation assistant must call the public application URL at `POST /api/vapi/generate` with this JSON body:

```json
{
  "type": "Technical",
  "role": "Frontend Developer",
  "level": "Junior",
  "techstack": "React, TypeScript",
  "amount": 5,
  "userid": "{{userId}}"
}
```

Configure the tool's request headers as:

```text
Content-Type: application/json
Authorization: Bearer {{idToken}}
```

The browser supplies `userName`, `userId`, `userid`, and `idToken` through Vapi's assistant variable overrides when starting the call. Bind `userid` and the Authorization header to those variables directly; do not ask the model to invent them or include the token in the assistant's conversational prompt. The server verifies the token and rejects mismatched user IDs. Requests made directly from the app may instead use its authenticated session cookie.

The endpoint accepts between 1 and 20 questions, validates model output before saving, and returns `{ "success": true, "interviewId": "..." }`. Calls need microphone permission and a configured Vapi account. Voice practice uses the questions from the selected interview. Feedback scoring and persistence are not implemented yet.

## Checks

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
```

The regression suite mocks Firebase and AI service boundaries; it does not create accounts or spend generation credits. The production build downloads Geist fonts from Google Fonts and needs network access.
