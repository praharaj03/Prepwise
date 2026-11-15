"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";
import { z } from "zod";

const ONE_WEEK = 60 * 60 * 24 * 7;

export async function signUp(params: SignUpParams) {
  try {
    const { idToken, name } = z.object({
      idToken: z.string().min(1),
      name: z.string().trim().min(3).max(100),
    }).parse(params);
    const claims = await auth.verifyIdToken(idToken, true);
    if (!claims.email) {
      return { success: false, message: "An email address is required." };
    }

    // Derive identity from the verified token, never from client-supplied IDs.
    const userRef = db.collection("users").doc(claims.uid);
    await db.runTransaction(async (transaction) => {
      const user = await transaction.get(userRef);
      if (!user.exists) {
        transaction.set(userRef, { name, email: claims.email });
      }
    });
    return { success: true, message: "Account created successfully." };
  } catch (error) {
    console.error("Error creating a user", error);
    return { success: false, message: "Failed to create an account." };
  }
}

export async function signIn(params: SignInParams) {
  try {
    const { email, idToken } = z.object({
      email: z.email(),
      idToken: z.string().min(1),
    }).parse(params);
    const claims = await auth.verifyIdToken(idToken, true);
    if (claims.email?.toLowerCase() !== email.toLowerCase()) {
      return { success: false, message: "Invalid sign-in credentials." };
    }

    // Recover a profile if signup stopped after Firebase Auth creation.
    const userRef = db.collection("users").doc(claims.uid);
    await db.runTransaction(async (transaction) => {
      const user = await transaction.get(userRef);
      if (!user.exists) {
        transaction.set(userRef, {
          name: claims.name || email.split("@")[0],
          email: claims.email,
        });
      }
    });
    await setSessionCookie(idToken);
    return { success: true, message: "Signed in successfully." };
  } catch (error) {
    console.error("Error signing in", error);
    return { success: false, message: "Failed to sign in. Please try again." };
  }
}

export async function setSessionCookie(idToken: string) {
  const claims = await auth.verifyIdToken(idToken, true);
  if (Date.now() / 1000 - claims.auth_time > 5 * 60) {
    throw new Error("Please sign in again to create a session.");
  }
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ONE_WEEK * 1000,
  });
  (await cookies()).set("session", sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK,
    path: "/",
    sameSite: "lax",
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const sessionCookie = (await cookies()).get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const claims = await auth.verifySessionCookie(sessionCookie, true);
    const user = await db.collection("users").doc(claims.uid).get();
    if (!user.exists) return null;
    const data = user.data();
    if (typeof data?.name !== "string" || typeof data?.email !== "string") {
      return null;
    }
    return { id: user.id, name: data.name, email: data.email };
  } catch (error) {
    console.error("Error getting current user", error);
    return null;
  }
}

export async function isAuthenticated() {
  return !!(await getCurrentUser());
}
