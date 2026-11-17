"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";
import { saveInterview } from "@/lib/local-interviews";

export default function GenerationForm() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [amount, setAmount] = useState("5");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const interview = saveInterview(Object.fromEntries(fields));
      router.push("/interview/" + interview.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Please try again.");
    } finally { setPending(false); }
  }

  return <div className="creation-grid"><form className="creation-form panel" onSubmit={submit}><div className="panel-heading"><span className="square-icon"><Sparkles size={20} /></span><div><h2>Make it your interview</h2><p>Choose your role and complexity. Meet your AI interviewer.</p></div></div><div className="field-group"><label htmlFor="role">What role are you preparing for?</label><input id="role" name="role" required maxLength={200} placeholder="e.g. Frontend Developer" value={role} onChange={(event) => setRole(event.target.value)} /><div className="role-suggestions">{["Frontend Developer", "Product Manager", "Data Analyst"].map((value) => <button key={value} type="button" onClick={() => setRole(value)}>{value}</button>)}</div></div><div className="field-row"><div className="field-group"><label htmlFor="level">Experience level</label><select name="level" id="level" defaultValue="Junior"><option>Junior</option><option>Mid-level</option><option>Senior</option><option>Lead</option></select></div><div className="field-group"><label htmlFor="type">Interview focus</label><select name="type" id="type" defaultValue="Technical"><option>Technical</option><option>Behavioral</option><option>Mixed</option></select></div></div><div className="field-group"><label htmlFor="techstack">Skills & technologies</label><input name="techstack" id="techstack" required maxLength={1000} placeholder="e.g. React, TypeScript, system design" /><p className="field-hint">Separate skills with commas. Include the ones in your job description.</p></div><div className="field-group"><label htmlFor="difficulty">Question complexity</label><select name="difficulty" id="difficulty" defaultValue="Medium"><option value="Easy">Easy - Core concepts and simple examples</option><option value="Medium">Medium - Practical application and tradeoffs</option><option value="Hard">Hard - Deeper reasoning and complex scenarios</option></select></div><div className="field-group"><label htmlFor="amount">Number of questions</label><select name="amount" id="amount" value={amount} onChange={(event) => setAmount(event.target.value)}><option value="5">5 questions · A quick practice</option><option value="10">10 questions · Go a little deeper</option><option value="15">15 questions · A full session</option><option value="20">20 questions · The complete rehearsal</option></select></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-footer"><span>Good preparation starts with one step.</span><button className="primary-button" disabled={pending} type="submit">{pending ? <><LoaderCircle size={17} className="spin" />Preparing your questions…</> : <>Create interview <ArrowRight size={17} /></>}</button></div></form><aside className="creation-aside"><span className="eyebrow">BUILT AROUND YOU</span><h2>Your role.<br />Your pace.<br /><span>Your next step.</span></h2><p>Turn a job description into a conversation you feel ready for.</p><div className="session-preview"><span className="preview-label">YOUR PRACTICE SESSION</span><h3>{role || "Your next opportunity"}</h3><div><span>{amount} tailored questions</span><span>Voice practice</span></div></div><ul className="benefit-list"><li><Check size={16} />Questions matched to your experience</li><li><Check size={16} />Review the questions before you begin</li><li><Check size={16} />Practice again, whenever you need</li></ul><p className="quiet-note">You can review questions without a microphone. Voice practice needs microphone access.</p></aside></div>;
}
