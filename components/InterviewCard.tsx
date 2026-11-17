import dayjs from "dayjs";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Code2, MessageCircle, FileText, Trash2 } from "lucide-react";
import DisplayTechIcons from "./DisplayTechIcons";

export default function InterviewCard({ id, role, type, techstack, createdAt, questions = [], template = false, onDelete, company, companyLogo, lastResult }: InterviewCardProps) {
  const normalizedType = /mix/i.test(type) ? "Mixed" : type;
  const behavioral = /behavior/i.test(type);
  const formattedDate = createdAt && dayjs(createdAt).isValid() ? dayjs(createdAt).format("MMM D, YYYY") : "Saved interview";
  return <article className="interview-card"><div className="interview-card-top">{companyLogo ? <span className="company-logo"><Image src={companyLogo} alt={(company || "Company") + " logo"} width={40} height={40} /></span> : <span className={behavioral ? "role-icon teal" : "role-icon violet"}>{behavioral ? <MessageCircle size={23} /> : <Code2 size={23} />}</span>}<div className="card-top-actions"><span className="focus-badge">{normalizedType}</span>{onDelete && <button className="icon-button" type="button" onClick={onDelete} aria-label={"Delete " + role + " interview"}><Trash2 size={14} /></button>}</div></div><div>{company && <span className="company-name">{company}</span>}<h3>{role}</h3><p className="card-description">{behavioral ? "Find the stories that show what you bring to a team." : "Build confidence in the skills that matter for this role."}</p></div><div className="card-meta"><span><FileText size={14} />{questions.length} questions</span><span><CalendarDays size={14} />{template ? "Sample interview" : formattedDate}</span></div><DisplayTechIcons techStack={techstack} />{lastResult && <span className={lastResult.verdict === "SELECTED" ? "outcome-badge selected" : "outcome-badge rejected"}>{lastResult.verdict === "SELECTED" ? "Selected" : "Rejected"} - {lastResult.score}/100</span>}<Link href={"/interview/" + id} className="card-action">Start practice <ArrowUpRight size={17} /></Link></article>;
}
