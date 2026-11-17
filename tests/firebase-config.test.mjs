import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./load-module.mjs";

function configure(t, values) {
  for (const name of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID", "STORAGE_BUCKET", "MESSAGING_SENDER_ID"]) {
    const key = "NEXT_PUBLIC_FIREBASE_" + name;
    const previous = process.env[key];
    process.env[key] = values[name] || "";
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

function fixture() {
  let app;
  const configurations = [];
  const client = loadModule("firebase/client.ts", {
    "firebase/app": {
      getApps: () => app ? [app] : [],
      getApp: () => app,
      initializeApp: (config, name) => { configurations.push(config); app = { config, name }; return app; },
    },
    "firebase/auth": { getAuth: (instance) => ({ app: instance }) },
    "firebase/firestore": { getFirestore: (instance) => ({ app: instance }) },
  });
  return { client, configurations };
}

test("missing Firebase web settings do not initialize on import or crash page rendering", (t) => {
  configure(t, {});
  const { client, configurations } = fixture();
  assert.equal(configurations.length, 0);
  assert.throws(() => client.getClientAuth(), /Firebase sign-in is not configured/);
  assert.equal(configurations.length, 0);
});

test("Firebase uses the configured web project and shares one app for auth and data", (t) => {
  configure(t, { API_KEY: "test-public-key", AUTH_DOMAIN: "new-project.firebaseapp.com", PROJECT_ID: "new-project", APP_ID: "test-app" });
  const { client, configurations } = fixture();
  const auth = client.getClientAuth();
  const db = client.getClientDb();
  assert.equal(configurations.length, 1);
  assert.equal(configurations[0].projectId, "new-project");
  assert.equal(configurations[0].apiKey, "test-public-key");
  assert.equal(auth.app, db.app);
});
