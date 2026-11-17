"use client";

import { RefreshCw } from "lucide-react";

export default function InterviewError({ retry }: { retry: () => void }) {
  return (
    <div className="error-panel panel" role="alert">
      <span className="square-icon"><RefreshCw size={21} /></span>
      <h2>Let’s give that another try.</h2>
      <p>We couldn’t load your workspace. Your preparation is worth coming back to. Please try again in a moment.</p>
      <button className="primary-button" onClick={retry}>Try again <RefreshCw size={15} /></button>
    </div>
  );
}
