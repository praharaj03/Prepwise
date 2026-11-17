# PrepWise flow verification

Verified on 17 November 2026 using the production build, Next.js 16.4.6, React 19.2.9, and installed Google Chrome.

## Checks

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npx tsc --noEmit --incremental false` | Passed |
| `npm test` | 47 tests passed |
| `npm run build` | Passed; all application routes built |
| `npm run test:e2e -- --live` | Passed |
| Staged credential scan | No Groq keys or private-key blocks; local env and test artifacts excluded |

## Complete user flow

| Boundary | Evidence |
| --- | --- |
| Entry without an account | Dashboard loads with a stale legacy session cookie; sign-in/sign-up redirect home without the Firebase audience error. |
| Samples and creation | All 10 company logos decode; each sample starts the shared video room with its own role. Custom role, experience, skills, and Hard complexity reach the API. |
| Device setup | Start stays disabled until both camera and microphone are enabled. Denied permissions keep it disabled. A required device disconnect disables Start and releases capture. |
| Conversation | Synthetic media preview, mute/unmute, recognition cancellation, one-time answer submission, stale callback protection, and independent camera controls pass. A simulated quota failure preserves the draft for retry. |
| API and real model | A Frontend Developer interview completes five answer turns through the browser and the real Groq model, with distinct questions and validated responses. |
| Report and storage | The live report returns REJECTED at 34/100, consistently with the 70-point threshold. It is displayed, matches browser storage, and survives reload. Controlled cases separately exercise both Selected and Rejected outcomes. |
| Library | Report download, library export, deletion, backup import, and reload persistence pass. |
| Other routes | Solo practice, the six-step guide, branding, and desktop/mobile layouts pass. No page exceptions or unexpected external asset requests occur in the controlled flow. |

## Issues fixed during verification

- Release camera and microphone capture and disable Start when a required track ends.
- Compare the browser origin with the incoming Host because NextRequest normalizes loopback URLs to localhost.
- Reject repeated questions, request one replacement within the existing timeout, and fail safely if the replacement also repeats.
- Avoid Groq rejecting a final evaluation for generating a fourth feedback bullet: accept the generated list length and enforce the three-item report limit on the server.
- Wait for navigation before asserting capture cleanup in the browser test.
- Upgrade Next.js, React, and compatible dependencies; use the updated error-boundary retry API.

## Limits and remaining findings

The browser uses Chrome's synthetic camera/microphone. Speech playback and recognition callbacks are simulated; physical devices, actual spoken-word accuracy, and audible voice quality still need a human check. The live run uses real model responses and synthetic typed answers, not recorded personal audio/video. The default browser suite mocks AI; `--live` additionally uses configured Groq quota.

`npm audit` reports **0 critical, 5 high, and 11 moderate** findings after compatible updates. Remaining dependency chains include Firebase, Firebase Admin, and shadcn. Several offered fixes require major upgrades or downgrades; those were not forced. This is a passing functional verification, not a clean dependency audit.

Production hosting must supply its own server-only `GROQ_API_KEY` and HTTPS. Local credentials are intentionally excluded from Git. This run verifies the local production server; it does not claim a deployed-site check or exercise optional Firebase/Vapi integrations against live accounts.

Screenshots, downloaded reports, and test logs are in the ignored `.tmp` directory. Repeat the browser run using the commands in [README.md](README.md).
