"use client";

import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { createPracticeQuestions, practiceDetailsSchema } from "@/lib/practice-questions";
import { interviewReportSchema, type InterviewReport } from "@/lib/interview-bot";

export const INTERVIEW_STORAGE_KEY = "prepwise:interviews:v1";
const CHANGE_EVENT = "prepwise:interviews-changed";
const storedInterviewSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  role: z.string().min(1).max(200), level: z.string().max(100), type: z.string().max(100),
  questions: z.array(z.string().min(1).max(2000)).min(1).max(20),
  techstack: z.array(z.string().max(100)).max(30),
  createdAt: z.string(), userId: z.string(), finalized: z.boolean(),
  company: z.string().max(100).optional(),
  companyLogo: z.string().regex(/^\/companies\/[a-z0-9-]+\.(svg|png)$/).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  lastResult: interviewReportSchema.optional(),
});
const librarySchema = z.array(storedInterviewSchema).max(1000);

export function parseSavedInterviews(raw: string): Interview[] {
  if (!raw) return [];
  let decoded: unknown;
  try { decoded = JSON.parse(raw); }
  catch { throw new Error("Choose a valid PrepWise JSON backup. The saved data could not be read."); }
  const result = librarySchema.safeParse(decoded);
  if (!result.success) throw new Error("Your saved library could not be read. Download a backup before changing it.");
  return result.data;
}

function snapshot() {
  try { return window.localStorage.getItem(INTERVIEW_STORAGE_KEY) || ""; }
  catch { return ""; }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(CHANGE_EVENT, listener); };
}

export function useSavedInterviews() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    try { return parseSavedInterviews(raw); }
    catch { return []; }
  }, [raw]);
}

const noSubscription = () => () => {};
export function useBrowserReady() {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

function persist(interviews: Interview[]) {
  const validated = librarySchema.parse(interviews);
  try { window.localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(validated)); }
  catch { throw new Error("Browser storage is unavailable or full. Download a backup and free some space before trying again."); }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveInterview(input: unknown): Interview {
  const details = practiceDetailsSchema.parse(input);
  const interviews = parseSavedInterviews(window.localStorage.getItem(INTERVIEW_STORAGE_KEY) || "");
  const interview: Interview = {
    id: crypto.randomUUID(), role: details.role, level: details.level, type: details.type,
    techstack: details.techstack, questions: createPracticeQuestions(details),
    createdAt: new Date().toISOString(), userId: "local", finalized: true,
    company: details.company, companyLogo: details.companyLogo,
    difficulty: details.difficulty,
  };
  persist([interview, ...interviews]);
  return interview;
}

export function removeInterview(id: string) {
  const interviews = parseSavedInterviews(window.localStorage.getItem(INTERVIEW_STORAGE_KEY) || "");
  persist(interviews.filter((interview) => interview.id !== id));
}

export function savePracticeResult(interview: Interview, report: InterviewReport) {
  const validated = interviewReportSchema.parse(report);
  const interviews = parseSavedInterviews(window.localStorage.getItem(INTERVIEW_STORAGE_KEY) || "");
  const existing = interviews.find((item) => item.id === interview.id);
  const updated = { ...(existing || interview), createdAt: existing?.createdAt || new Date().toISOString(), lastResult: validated };
  persist([updated, ...interviews.filter((item) => item.id !== interview.id)]);
}

export function downloadLibrary() {
  const raw = snapshot() || "[]";
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "prepwise-interviews.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importLibrary(raw: string) {
  if (raw.length > 3_000_000) throw new Error("This backup is too large. Choose a PrepWise library file under 3 MB.");
  const imported = parseSavedInterviews(raw);
  const existing = parseSavedInterviews(window.localStorage.getItem(INTERVIEW_STORAGE_KEY) || "");
  const merged = new Map(existing.map((interview) => [interview.id, interview]));
  for (const interview of imported) if (!merged.has(interview.id)) merged.set(interview.id, interview);
  persist([...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}
