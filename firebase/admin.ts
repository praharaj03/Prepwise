import "server-only";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Auth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
function initFirebaseAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Optional Firebase cloud features are not configured.");
  const name = "prepwise-" + projectId;
  let app = getApps().find((candidate) => candidate.name === name);

  if (!app) {
    app = initializeApp({
      projectId,
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace newlines in the private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    }, name);
  }

  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

// Legacy cloud endpoints stay optional; the local app needs no credentials.
function lazyClient<T extends object>(getClient: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const client = getClient();
      const value = Reflect.get(client, property);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

export const auth = lazyClient<Auth>(() => initFirebaseAdmin().auth);
export const db = lazyClient<Firestore>(() => initFirebaseAdmin().db);
