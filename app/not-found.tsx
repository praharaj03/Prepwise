import Link from "next/link";
import Brand from "@/components/Brand";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main className="error-panel panel"><Brand /><span className="eyebrow" style={{ marginTop: 35 }}>404 / A LITTLE OFF TRACK</span><h1 style={{ fontSize: 30, letterSpacing: -1 }}>A fresh start is this way.</h1><p style={{ marginTop: 15 }}>This page isn’t available. Head back to your workspace and find your next interview.</p><Link href="/" className="primary-button"><ArrowLeft size={16} />Back to workspace</Link></main>;
}
