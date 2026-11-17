import Link from "next/link";

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

export default function Brand() {
  return <Link href="/" className="brand" aria-label="PrepWise home"><BrandMark /><span>prepwise<span className="brand-dot">.</span></span></Link>;
}
