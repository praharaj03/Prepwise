import "server-only";
import { db } from "@/firebase/admin";
import type { QuerySnapshot } from "firebase-admin/firestore";

function isMissingIndexError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === 9 &&
    /requires an index/i.test(error.message);
}

function toInterviews(snapshot: QuerySnapshot): Interview[] {
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Interview[];
}

export async function getInterviewsByUserId(userId: string): Promise<Interview[] | null> {
  const query = db.collection("interviews").where("userId", "==", userId);
  try {
    const snapshot = await query.orderBy("createdAt", "desc").get();
    return snapshot.empty ? null : toInterviews(snapshot);
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
  }

  // Equality alone uses an automatic single-field index. Sort only this user's records.
  const snapshot = await query.get();
  const interviews = toInterviews(snapshot)
    .filter((interview) => typeof interview.createdAt === "string")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return interviews.length ? interviews : null;
}

export async function getLatestInterviews({ userId, limit = 20 }: GetLatestInterviewsParams): Promise<Interview[] | null> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Interview limit must be a positive integer.");

  const collection = db.collection("interviews");
  try {
    const snapshot = await collection.orderBy("createdAt", "desc")
      .where("finalized", "==", true)
      .where("userId", "!=", userId)
      .orderBy("userId", "asc")
      .limit(limit).get();
    return snapshot.empty ? null : toInterviews(snapshot);
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
  }

  // Scan recent records in bounded pages using the automatic createdAt index.
  // Continue past excluded records so drafts and the user's own interviews don't
  // prevent older, eligible interviews from filling the requested result count.
  const pageSize = Math.max(50, Math.min(limit, 100));
  const query = collection.orderBy("createdAt", "desc").limit(pageSize);
  let page = await query.get();
  const interviews: Interview[] = [];
  while (!page.empty) {
    for (const interview of toInterviews(page)) {
      if (interview.finalized === true && typeof interview.userId === "string" && interview.userId !== userId) {
        interviews.push(interview);
        if (interviews.length === limit) return interviews;
      }
    }
    if (page.size < pageSize) break;
    page = await query.startAfter(page.docs[page.docs.length - 1]).get();
  }
  return interviews.length ? interviews : null;
}

export async function getInterviewById(id:string):Promise<Interview | null>{
    const interview=await db
    .collection('interviews')
    .doc(id)
    .get();

    if (!interview.exists) return null;
    return { ...interview.data(), id: interview.id } as Interview;
}
