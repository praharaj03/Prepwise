"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers3, Plus, Search } from "lucide-react";

interface LibraryEntry { id: string; searchText: string; type: string; card: ReactNode }

export default function InterviewLibrary({ own, templates }: { own: LibraryEntry[]; templates: LibraryEntry[] }) {
  const [tab, setTab] = useState<"own" | "community">(own.length ? "own" : "community");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState("All types");
  const entries = tab === "own" ? own : templates;
  const visible = entries.filter((entry) => entry.searchText.toLowerCase().includes(query.trim().toLowerCase()) && (focus === "All types" || entry.type.toLowerCase().includes(focus.toLowerCase())));

  return (
    <section className="library" id="library">
      <div className="section-heading"><div><span className="eyebrow">MAKE YOUR NEXT MOVE</span><h2>Your practice library</h2><p>One conversation closer to your next opportunity.</p></div><Link href="/interview" className="text-link">Create an interview <Plus size={16} /></Link></div>
      <div className="library-toolbar"><div className="library-tabs" role="group" aria-label="Interview collection"><button onClick={() => setTab("own")} aria-pressed={tab === "own"} className={tab === "own" ? "selected" : ""}>My interviews <span>{own.length}</span></button><button onClick={() => setTab("community")} aria-pressed={tab === "community"} className={tab === "community" ? "selected" : ""}>Sample interviews <span>{templates.length}</span></button></div><div className="library-filters"><label className="search-field"><Search size={16} /><input aria-label="Search interviews" placeholder="Search role or technology…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter interview type" value={focus} onChange={(event) => setFocus(event.target.value)}><option>All types</option><option>Technical</option><option>Behavioral</option><option>Mixed</option></select></div></div>
      {visible.length ? <div className="interview-grid">{visible.map((entry) => <div key={entry.id}>{entry.card}</div>)}</div> : <div className="empty-state"><span className="empty-icon"><Layers3 size={25} /></span><h3>{query || focus !== "All types" ? "No matching interviews" : tab === "own" ? "Your next chapter starts here" : "More practice is on the way"}</h3><p>{query || focus !== "All types" ? "Try a different role, technology, or interview type." : "Create an interview around the role you want. We’ll prepare the questions."}</p>{query || focus !== "All types" ? <button className="text-link" onClick={() => { setQuery(""); setFocus("All types"); }}>Clear filters <ArrowUpRight size={16} /></button> : <Link href="/interview" className="primary-button">Create your first interview <Plus size={16} /></Link>}</div>}
    </section>
  );
}
