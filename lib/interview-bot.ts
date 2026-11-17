import { z } from "zod";

export const interviewTurnRequestSchema = z.object({
  action: z.enum(["start", "answer", "finish"]),
  role: z.string().trim().min(1).max(200),
  level: z.string().trim().min(1).max(100),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  focus: z.string().trim().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(100)).max(30),
  questionCount: z.number().int().min(1).max(20),
  turns: z.array(z.object({ question: z.string().trim().min(1).max(2000), answer: z.string().trim().min(1).max(3000) })).max(20),
}).superRefine((request, context) => {
  if (request.turns.length > request.questionCount || (request.action === "start" && request.turns.length > 0) || (request.action === "answer" && !request.turns.length)) {
    context.addIssue({ code: "custom", message: "Invalid interview turn sequence" });
  }
});

const mark = z.number().int().min(0).max(100);
export const interviewScoresSchema = z.object({ knowledge: mark, reasoning: mark, communication: mark, roleFit: mark });
export const botOutputSchema = z.object({
  reply: z.string().trim().min(1).max(1500),
  nextQuestion: z.string().trim().max(2000),
  scores: interviewScoresSchema,
  strengths: z.array(z.string().trim().min(1).max(350)).max(3),
  improvements: z.array(z.string().trim().min(1).max(350)).max(3),
});
export const interviewReportSchema = z.object({
  score: mark,
  verdict: z.enum(["SELECTED", "REJECTED"]),
  summary: z.string().max(2000),
  scores: interviewScoresSchema,
  strengths: z.array(z.string().max(350)).max(3),
  improvements: z.array(z.string().max(350)).max(3),
  answered: z.number().int().min(0).max(20),
  total: z.number().int().min(1).max(20),
});
export const botTurnResponseSchema = z.object({
  reply: z.string(), nextQuestion: z.string(), complete: z.boolean(),
  report: interviewReportSchema.nullable(),
});
export type BotTurnRequest = z.infer<typeof interviewTurnRequestSchema>;
export type BotTurnResponse = z.infer<typeof botTurnResponseSchema>;
export type InterviewReport = z.infer<typeof interviewReportSchema>;

export function createInterviewReport(output: z.infer<typeof botOutputSchema>, answered: number, total: number): InterviewReport {
  const completion = Math.min(answered, total) / total;
  const scores = {
    knowledge: Math.round(output.scores.knowledge * completion),
    reasoning: Math.round(output.scores.reasoning * completion),
    communication: Math.round(output.scores.communication * completion),
    roleFit: Math.round(output.scores.roleFit * completion),
  };
  const score = Math.round(Object.values(scores).reduce((sum, value) => sum + value, 0) / 4);
  return {
    score, verdict: score >= 70 ? "SELECTED" : "REJECTED", scores,
    summary: (answered < total ? "You completed " + answered + " of " + total + " questions. Unanswered questions count as zero. " : "") + output.reply,
    strengths: output.strengths, improvements: output.improvements, answered, total,
  };
}
