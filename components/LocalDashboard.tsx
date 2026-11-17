"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, AudioLines, Download, FileText, Layers3, Sparkles, Target, Upload } from "lucide-react";
import InterviewCard from "./InterviewCard";
import InterviewLibrary from "./InterviewLibrary";
import { downloadLibrary, importLibrary, removeInterview, useSavedInterviews } from "@/lib/local-interviews";
import { interviewTemplates } from "@/lib/interview-templates";

export default function LocalDashboard() {
  const own = useSavedInterviews();
  const questions = own.reduce((total, interview) => total + interview.questions.length, 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  function remove(interview: Interview) {
    if (!window.confirm("Delete your saved " + interview.role + " interview?")) return;
    try { removeInterview(interview.id); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this interview."); }
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 3_000_000) throw new Error("Choose a PrepWise JSON backup under 3 MB.");
      importLibrary(await file.text());
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Choose a valid PrepWise backup."); }
    finally { event.target.value = ""; }
  }

  const entries = (interviews: Interview[], template = false) => interviews.map((interview) => ({ id: interview.id, type: interview.type, searchText: [interview.company, interview.role, interview.type, ...interview.techstack].join(" "), card: <InterviewCard {...interview} template={template} onDelete={template ? undefined : () => remove(interview)} /> }));

  return <>
    <div className="page-heading"><div><span className="eyebrow">A LITTLE BETTER, EVERY DAY</span><h1>Your next chapter.<span> Start here.</span></h1><p>Your role, your pace, your AI interview partner. No sign-in.</p></div><Link href="/interview" className="secondary-button" aria-label="Create a new interview"><Sparkles size={16} />New interview</Link></div>
    <section className="dashboard-hero"><div className="hero-copy"><span className="hero-kicker"><i />YOUR NEXT CHAPTER STARTS HERE</span><h2>Good answers come<br />from <span>great practice.</span></h2><p>A space to think out loud, find your words, and walk into your next interview feeling like yourself.</p><Link href="/interview" className="primary-button">Let’s practice <ArrowUpRight size={18} /></Link><span className="hero-footnote">Your role. Your questions. Your pace.</span></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><div className="signal-card"><span className="signal-icon"><AudioLines size={39} strokeWidth={1.7} /></span><span className="signal-title">Find your voice.</span><span className="signal-caption">Build your confidence.</span><div className="waveform">{[18, 30, 16, 40, 26, 54, 34, 64, 44, 25, 48, 32, 52, 22, 38, 18, 28].map((height, index) => <i key={index} style={{ height }} />)}</div><div className="signal-status"><i />READY WHEN YOU ARE</div></div><span className="floating-label floating-top"><Sparkles size={15} />Your AI practice partner</span><span className="floating-label floating-bottom"><Target size={15} />One answer at a time</span></div></section>
    <section className="stat-grid" aria-label="Your interview library at a glance"><div className="stat-card"><span className="stat-icon violet"><Layers3 size={20} /></span><div><span>Your interviews</span><strong>{own.length}<small>saved on this browser</small></strong></div></div><div className="stat-card"><span className="stat-icon teal"><FileText size={20} /></span><div><span>Questions prepared</span><strong>{questions}<small>opportunities to improve</small></strong></div></div><div className="stat-card"><span className="stat-icon amber"><Target size={20} /></span><div><span>Starter sets</span><strong>{interviewTemplates.length}<small>ready when you are</small></strong></div></div></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <InterviewLibrary own={entries(own)} templates={entries(interviewTemplates, true)} />
    <div className="library-backups"><p>Your library stays in this browser. Export a backup before clearing browser data.</p><div><button className="text-link" onClick={downloadLibrary}><Download size={14} />Export library</button><button className="text-link" onClick={() => fileInput.current?.click()}><Upload size={14} />Import backup</button><input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Import library backup" onChange={restore} /></div></div>
    <section className="practice-tip"><span className="tip-mark">✦</span><div><span className="eyebrow">A SMALL TIP FOR A STRONGER ANSWER</span><h3>Don’t aim for a perfect answer. Aim for a clear one.</h3><p>Set the scene, explain what you did, and share what changed. A little structure goes a long way.</p></div><Link href="/guide" className="text-link">The practice guide <ArrowRight size={16} /></Link></section>
  </>;
}
