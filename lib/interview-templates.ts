import { createPracticeQuestions, practiceDetailsSchema } from "./practice-questions";

const presets = [
  { id: "starter-nvidia", company: "NVIDIA", companyLogo: "/companies/nvidia.svg", role: "Machine Learning Engineer", type: "Technical", techstack: "Python, Model evaluation, Data pipelines" },
  { id: "starter-oracle", company: "Oracle", companyLogo: "/companies/oracle.svg", role: "Backend Developer", type: "Technical", techstack: "Java, APIs, SQL" },
  { id: "starter-zomato", company: "Zomato", companyLogo: "/companies/zomato.svg", role: "Frontend Developer", type: "Technical", techstack: "React, TypeScript, Next.js" },
  { id: "starter-spacex", company: "SpaceX", companyLogo: "/companies/spacex.svg", role: "Systems Software Engineer", type: "Technical", techstack: "C++, Reliability, System design" },
  { id: "starter-swiggy", company: "Swiggy", companyLogo: "/companies/swiggy.svg", role: "Full Stack Developer", type: "Mixed", techstack: "React, Node.js, PostgreSQL" },
  { id: "starter-apple", company: "Apple", companyLogo: "/companies/apple.svg", role: "Product Designer", type: "Mixed", techstack: "Figma, User research, Accessibility" },
  { id: "starter-google", company: "Google", companyLogo: "/companies/google.svg", role: "Software Engineer", type: "Technical", techstack: "Algorithms, Data structures, Problem solving" },
  { id: "starter-microsoft", company: "Microsoft", companyLogo: "/companies/microsoft.svg", role: "Product Manager", type: "Mixed", techstack: "Strategy, Prioritization, Research" },
  { id: "starter-amazon", company: "Amazon", companyLogo: "/companies/amazon.png", role: "Software Engineer", type: "Behavioral", techstack: "Communication, Teamwork, Leadership" },
  { id: "starter-netflix", company: "Netflix", companyLogo: "/companies/netflix.svg", role: "DevOps Engineer", type: "Technical", techstack: "Docker, Kubernetes, CI/CD" },
];

export const interviewTemplates: Interview[] = presets.map((preset) => {
  const details = practiceDetailsSchema.parse({ ...preset, level: "Junior", amount: 5 });
  return { ...details, id: preset.id, questions: createPracticeQuestions(details), createdAt: "", userId: "local", finalized: true };
});
