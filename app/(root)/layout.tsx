import { ReactNode } from "react";
import WorkspaceNav, { WorkspaceHeader } from "@/components/WorkspaceNav";

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="workspace"><a className="skip-link" href="#main-content">Skip to content</a><WorkspaceNav /><div className="workspace-body"><WorkspaceHeader /><main id="main-content" className="workspace-content">{children}</main><footer className="workspace-footer"><span>Made for your next chapter.</span><span>PrepWise · Practice with purpose</span></footer></div></div>;
}
