"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BookmarkPlus, Headphones, LoaderCircle, ShieldCheck } from "lucide-react";
import BrowserPractice from "./BrowserPractice";
import InterviewRoom from "./InterviewRoom";
import DisplayTechIcons from "./DisplayTechIcons";
import { interviewTemplates } from "@/lib/interview-templates";
import { saveInterview, useBrowserReady, useSavedInterviews } from "@/lib/local-interviews";

export default function LocalInterview({ id }: { id: string }) {
  const router = useRouter();
  const ready = useBrowserReady();
  const own = useSavedInterviews();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"ai" | "solo">("ai");
  const saved = own.find((interview) => interview.id === id);
  const interview = saved || interviewTemplates.find((template) => template.id === id);

  if (!ready) return <div className="empty-state"><LoaderCircle className="spin" size={22} /><p>Opening your practice room…</p></div>;
  if (!interview) return <div className="empty-state"><h1>This interview isn’t on this browser.</h1><p>Open a starter set, create an interview, or import your library backup.</p><Link href="/" className="primary-button"><ArrowLeft size={16} />Back to your library</Link></div>;

  function saveTemplate() {
    if (!interview) return;
    try {
      const copy = saveInterview({ role: interview.role, level: interview.level, difficulty: interview.difficulty, type: interview.type, techstack: interview.techstack.join(", "), amount: interview.questions.length, company: interview.company, companyLogo: interview.companyLogo });
      router.replace("/interview/" + copy.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this interview."); }
  }

  return <><Link href="/" className="back-link"><ArrowLeft size={16} />Back to your workspace</Link><div className="page-heading room-heading"><div><span className="eyebrow">YOUR PRACTICE ROOM</span><h1>{interview.role}<span> interview.</span></h1><div className="room-meta"><span className="focus-badge">{interview.type}</span><span>{interview.questions.length} questions</span><span>{interview.level}</span><span>{interview.difficulty || "Medium"} complexity</span><DisplayTechIcons techStack={interview.techstack} /></div></div>{saved ? <span className="room-reassurance"><Headphones size={17} />Find a quiet spot. Take a breath.</span> : <button className="secondary-button" onClick={saveTemplate} aria-label="Save this template to your library"><BookmarkPlus size={16} />Save to my library</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="interview-mode-tabs" role="group" aria-label="Practice mode"><button className={mode === "ai" ? "selected" : ""} aria-pressed={mode === "ai"} onClick={() => setMode("ai")}>AI video interview</button><button className={mode === "solo" ? "selected" : ""} aria-pressed={mode === "solo"} onClick={() => setMode("solo")}>Solo practice</button></div>{mode === "ai" ? <InterviewRoom key={interview.id} interview={interview} /> : <BrowserPractice key={interview.id} questions={interview.questions} role={interview.role} />}<div className="room-bottom"><p><ShieldCheck size={16} />One candidate. One AI interviewer. No sign-in needed.</p><span>AI evaluation is for mock interview practice.</span></div><details className="question-preview panel"><summary>Review your prepared questions <span>{interview.questions.length} questions</span></summary><ol>{interview.questions.map((question, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span><p>{question}</p></li>)}</ol></details></>;
}
