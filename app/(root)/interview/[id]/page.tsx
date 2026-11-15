import Agent from "@/components/Agent";
import DisplayTechIcons from "@/components/DisplayTechIcons";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewById } from "@/lib/actions/general.action";
import { notFound, redirect } from "next/navigation";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { id } = await params;
  const interview = await getInterviewById(id);
  if (!interview || (!interview.finalized && interview.userId !== user.id)) notFound();

  return (
    <>
      <div className="flex items-center gap-4">
        <h3 className="capitalize">{interview.role} Interview</h3>
        <DisplayTechIcons techStack={interview.techstack} />
      </div>
      <Agent userName={user.name} userId={user.id} interviewId={id}
        type="interview" questions={interview.questions} />
    </>
  );
}
