"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BookOpen, HardDrive, LayoutDashboard, Layers3, Plus } from "lucide-react";
import Brand from "./Brand";

export default function WorkspaceNav() {
  const pathname = usePathname();
  return <aside className="sidebar"><Brand /><span className="nav-caption">YOUR WORKSPACE</span><nav className="side-nav" aria-label="Main navigation"><Link className={pathname === "/" ? "nav-link active" : "nav-link"} href="/" aria-current={pathname === "/" ? "page" : undefined}><LayoutDashboard size={19} />Overview</Link><Link className="nav-link" href="/#library"><Layers3 size={19} />Interview library</Link><Link className={pathname === "/interview" ? "nav-link active" : "nav-link"} href="/interview" aria-current={pathname === "/interview" ? "page" : undefined}><Plus size={19} />Create interview</Link><Link className={pathname === "/guide" ? "nav-link active" : "nav-link"} href="/guide" aria-current={pathname === "/guide" ? "page" : undefined}><BookOpen size={19} />Practice guide</Link></nav><div className="sidebar-note"><span className="tiny-spark">✧</span><h3>A little practice.<br />A lot more confidence.</h3><p>No account. Practice solo, or meet your AI interviewer.</p><Link href="/interview">Make time for yourself <ArrowUpRight size={16} /></Link></div><div className="sidebar-account"><span className="user-initial"><HardDrive size={16} /></span><div><strong>Your personal workspace</strong><span>Saved on this browser</span></div></div></aside>;
}

export function WorkspaceHeader() {
  const pathname = usePathname();
  const title = pathname === "/" ? "Overview" : pathname === "/guide" ? "Practice guide" : pathname === "/interview" ? "Create interview" : "Practice room";
  return <header className="workspace-header"><div><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{title}</strong></div><span className="workspace-status"><i />One conversation closer.</span></header>;
}
