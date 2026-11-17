import { z } from "zod";

export const practiceDetailsSchema = z.object({
  role: z.string().trim().min(1).max(200),
  level: z.enum(["Junior", "Mid-level", "Senior", "Lead"]),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  type: z.enum(["Technical", "Behavioral", "Mixed"]),
  techstack: z.string().trim().min(1).max(1000)
    .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(100)).min(1).max(30)),
  amount: z.union([z.number(), z.string().trim().regex(/^\d+$/)])
    .transform(Number).pipe(z.number().int().min(1).max(20)),
  company: z.string().trim().max(100).optional(),
  companyLogo: z.string().regex(/^\/companies\/[a-z0-9-]+\.(svg|png)$/).optional(),
});

type PracticeDetails = z.output<typeof practiceDetailsSchema>;

const behavioral = [
  "Tell me about yourself and the experience most relevant to this role.",
  "Describe a difficult problem you solved. What was your own contribution?",
  "Tell me about a time you received difficult feedback. What changed afterward?",
  "Describe a disagreement with a teammate and how you worked through it.",
  "Give an example of a deadline you struggled to meet. How did you communicate the risk?",
  "Tell me about a mistake you made and what you learned from it.",
  "How have you explained a complex idea to someone unfamiliar with the subject?",
  "Describe a time you had to learn something quickly to complete a task.",
  "Tell me about an ambiguous requirement and how you clarified it.",
  "Describe a time you took initiative without being asked.",
  "How did you prioritize competing tasks in a recent project?",
  "Tell me about a time you changed your approach after seeing new evidence.",
  "Describe how you supported a teammate who was having difficulty.",
  "Give an example of a tradeoff you made between speed and quality.",
  "Describe a result you are proud of. How did you measure its impact?",
  "Tell me about a time you worked with someone whose communication style differed from yours.",
  "How have you handled a project that did not go as planned?",
  "Describe a time you advocated for a user or customer need.",
  "What is one skill you are actively improving, and how are you practicing it?",
  "What questions would you ask to decide whether this role is a good fit?",
];

const common = [
  "Walk me through a project you built and explain the most important design decision.",
  "How do you turn an unclear requirement into a concrete implementation plan?",
  "Describe your process for investigating a bug you cannot immediately reproduce.",
  "How would you test a feature before releasing it to users?",
  "Explain a technical tradeoff you made and the alternatives you considered.",
  "How do you decide what to document in a project?",
  "How would you measure whether a performance improvement actually helped?",
  "What would you look for when reviewing someone else’s work?",
  "How do you keep sensitive configuration out of client applications?",
  "How would you make a failing feature easier to diagnose?",
  "Describe a useful abstraction and when you would avoid introducing one.",
  "How do you evaluate an unfamiliar library before adding it to a project?",
  "How would you plan a change that must preserve existing behavior?",
  "Explain how you would handle invalid input at an application boundary.",
  "How would you roll back a release that caused unexpected failures?",
  "What checks would you automate in a delivery pipeline?",
  "How do you balance accessibility, usability, and implementation effort?",
  "How would you identify the riskiest assumption in a proposed solution?",
  "What information would you include in a useful error report?",
  "Explain how you would estimate and divide a large technical task.",
];

const topics = {
  frontend: [
    "How do you decide where state should live in a frontend application?",
    "Explain how you would build an accessible form with useful validation.",
    "What causes unnecessary renders in React, and how would you investigate them?",
    "How would you improve the loading experience of a slow page?",
    "Explain the difference between server-rendered and client-rendered content.",
    "How would you handle loading, empty, and error states when fetching data?",
    "How do you design reusable components without making them hard to change?",
    "Describe your approach to responsive layouts across different screen sizes.",
    "How would you test keyboard navigation and focus management?",
    "How do you prevent stale requests from overwriting newer UI state?",
  ],
  backend: [
    "How would you design a reliable API for creating and updating a resource?",
    "Explain the difference between authentication and authorization in an API.",
    "How would you prevent duplicate writes when a request is retried?",
    "When would you use a database transaction? Give an example.",
    "How would you investigate an endpoint whose latency suddenly increased?",
    "Describe a caching strategy and how you would invalidate stale entries.",
    "How would you implement pagination without skipping or repeating records?",
    "How do you decide which database indexes a query needs?",
    "How would you handle a dependency that becomes temporarily unavailable?",
    "How would you version an API without breaking existing clients?",
  ],
  data: [
    "How do you check a dataset for missing values, duplicates, and inconsistent formats?",
    "Explain how you would choose an appropriate metric for a business question.",
    "How can a join change the number of rows in a query result?",
    "Explain the difference between correlation and causation with an example.",
    "How would you investigate a sudden change in a dashboard metric?",
    "Describe how you would communicate uncertainty in an analysis.",
    "How do you choose between a simple baseline and a more complex model?",
    "What is data leakage, and how would you detect it?",
    "How would you validate whether an experiment’s result is meaningful?",
    "How would you explain an unexpected finding to a nontechnical stakeholder?",
  ],
  product: [
    "How would you identify the user problem before proposing a feature?",
    "How do you prioritize a roadmap when teams have competing requests?",
    "Which signals would tell you whether a newly launched feature is successful?",
    "How would you test a product assumption with a small experiment?",
    "Describe how you would balance qualitative research and quantitative evidence.",
    "How would you define a useful minimum version of a product idea?",
    "How do you decide when to stop investing in an underperforming feature?",
    "How would you align stakeholders who disagree about a product’s direction?",
    "What would you include in a clear product requirement?",
    "How would you evaluate a change that improves one metric but harms another?",
  ],
  design: [
    "Walk me through your process from a user problem to an initial design.",
    "How would you test whether a navigation structure makes sense to users?",
    "Describe a design decision you changed after user research.",
    "How do you make forms easier to understand and complete?",
    "What accessibility checks would you make before handing off a design?",
    "How do you decide when a design pattern belongs in a component system?",
    "How would you work with an engineer when a design is expensive to implement?",
    "How do you distinguish an aesthetic preference from a usability problem?",
    "How would you design a useful empty state and error state?",
    "How would you measure whether a redesign improved the experience?",
  ],
};

const advanced = [
  "How would you lead a technical decision when multiple teams need different things?",
  "How would you evolve a system’s architecture while maintaining a reliable service?",
  "Describe how you would mentor someone through a difficult design decision.",
];

export function createPracticeQuestions(details: PracticeDetails): string[] {
  const context = [details.role, ...details.techstack].join(" ").toLowerCase();
  const role = details.role.toLowerCase();
  const topic = /design|ux|ui\b/.test(role) ? topics.design
    : /product/.test(role) ? topics.product
    : /data|analyst|machine learning/.test(role) ? topics.data
    : /front/.test(role) ? topics.frontend
    : /back|server|full.stack/.test(role) ? topics.backend
    : /react|vue|angular|css|html|next/.test(context) ? topics.frontend
    : /node|java|api/.test(context) ? topics.backend
    : /sql|python/.test(context) ? topics.data : [];
  const technical = [...new Set([
    ...(/Senior|Lead/.test(details.level) || details.difficulty === "Hard" ? advanced.slice(0, 2) : []),
    ...topic, ...common,
  ])];
  const mixed = technical.flatMap((question, index) => behavioral[index] ? [question, behavioral[index]] : [question]);
  const questions = details.type === "Behavioral" ? behavioral : details.type === "Mixed" ? mixed : technical;
  return [...new Set(questions)].slice(0, details.amount);
}
