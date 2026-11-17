export function getSessionCookieName() {
  return "prepwise-session" + (process.env.FIREBASE_PROJECT_ID ? "-" + process.env.FIREBASE_PROJECT_ID : "");
}
