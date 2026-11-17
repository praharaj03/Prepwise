import LocalInterview from "@/components/LocalInterview";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LocalInterview id={id} />;
}
