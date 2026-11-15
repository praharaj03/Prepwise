"use client";

import { Button } from "@/components/ui/button";

export default function InterviewError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4" role="alert">
      <h2>Unable to load interviews</h2>
      <p>Please try again in a moment.</p>
      <Button className="btn-primary" onClick={reset}>Try again</Button>
    </div>
  );
}
