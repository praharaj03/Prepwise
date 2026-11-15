import { getRandomInterviewCover } from "@/lib/utils";
import { createGroq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { auth, db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { z } from "zod";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const requestSchema = z.object({
  type: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(200),
  level: z.string().trim().min(1).max(100),
  techstack: z.string().trim().min(1).max(1000)
    .transform((value) => value.split(",").map((tech) => tech.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(100)).min(1).max(30)),
  amount: z.union([z.number(), z.string().trim().regex(/^\d+$/)])
    .transform(Number).pipe(z.number().int().min(1).max(20)),
  userid: z.string().min(1).max(128).optional(),
});

export async function GET() {
  return Response.json({ success: true, data: "Thank You!" });
}

export async function POST(request: Request) {
  let userId: string | undefined;
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const token = /^Bearer (\S+)$/i.exec(authorization)?.[1];
    if (!token) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    try {
      userId = (await auth.verifyIdToken(token, true)).uid;
    } catch {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  } else {
    userId = (await getCurrentUser())?.id;
  }
  if (!userId) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid interview details" }, { status: 400 });
  }
  const { type, role, level, techstack, amount, userid } = parsed.data;
  if (userid && userid !== userId) {
    return Response.json({ success: false, error: "User ID does not match the authenticated user" }, { status: 403 });
  }

  try {
    const questionsSchema = z.object({
      questions: z.array(z.string().trim().min(1).max(2000)).length(amount),
    });
    const { output } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      providerOptions: { groq: { structuredOutputs: false } },
      output: Output.object({ schema: questionsSchema }),
      prompt: `Prepare ${amount} questions for a job interview.
        Role: ${role}. Experience level: ${level}.
        Tech stack: ${techstack.join(", ")}.
        Interview focus: ${type}.
        The questions will be read aloud. Avoid slash, asterisk, or formatting characters.`,
    });
    const { questions } = questionsSchema.parse(output);
    const interview = {
      role, type, level, techstack, questions,
      userId,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };
    const document = await db.collection("interviews").add(interview);
    return Response.json({ success: true, interviewId: document.id });
  } catch (error) {
    console.error("Interview generation failed", error);
    return Response.json({ success: false, error: "Failed to generate the interview. Please try again." }, { status: 500 });
  }
}
