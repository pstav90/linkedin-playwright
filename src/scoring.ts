import { roleIdFor } from "./dedupe.js";
import type { CandidateProfile, RawJob, ScoredJob } from "./types.js";

const ROLE_LEVELS = [
  "director",
  "group",
  "principal",
  "lead",
  "senior",
  "staff",
  "head of",
  "deployment strategist",
  "forward deployed",
];

const HIGH_UPSIDE_TERMS = [
  "ai",
  "agent",
  "ranking",
  "recommendation",
  "discovery",
  "creator",
  "marketplace",
  "fintech",
  "credit",
  "lending",
  "crypto",
  "wallet",
  "payments",
  "enterprise",
  "analytics",
  "data platform",
];

const COMPENSATION_TERMS = ["principal", "group", "director", "lead", "staff", "head of", "platform", "enterprise"];
const PRESTIGE_TERMS = ["openai", "anthropic", "meta", "google", "stripe", "palantir", "databricks", "scale", "perplexity"];

function textFor(job: RawJob): string {
  return [job.company, job.title, job.location, job.jdText].join(" ").toLowerCase();
}

function countMatches(text: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (text.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function clampScore(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function classify(finalScore: number): ScoredJob["classification"] {
  if (finalScore >= 90) return "Pursue";
  if (finalScore >= 75) return "Potential";
  if (finalScore >= 60) return "Monitor";
  return "Deprioritize";
}

function inferRoleType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("forward deployed")) return "Forward Deployed";
  if (lower.includes("deployment strategist")) return "Deployment Strategist";
  if (lower.includes("solutions")) return "Solutions";
  if (lower.includes("product")) return "Product";
  return "";
}

function inferLevel(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("director") || lower.includes("head of")) return "Director";
  if (lower.includes("group")) return "Group";
  if (lower.includes("principal") || lower.includes("staff")) return "Principal/Staff";
  if (lower.includes("lead")) return "Lead";
  if (lower.includes("senior")) return "Senior";
  return "";
}

function actionFor(score: number): string {
  if (score >= 90) return "Prioritize today: tailor resume, identify warm path, and prepare a focused outreach note.";
  if (score >= 75) return "Review this week: validate company stage and decide whether to pursue directly or through a warm intro.";
  if (score >= 60) return "Monitor unless a strong warm path or exceptional team signal appears.";
  return "Deprioritize unless new information materially improves fit or access.";
}

export function scoreJob(job: RawJob, candidateProfile: CandidateProfile, accessScore = 1): ScoredJob {
  const haystack = textFor(job);
  const targetRoleMatches = countMatches(haystack, candidateProfile.targetRoles);
  const targetDomainMatches = countMatches(haystack, candidateProfile.targetDomains);
  const strengthMatches = countMatches(haystack, candidateProfile.strengths);
  const roleLevelMatches = countMatches(haystack, ROLE_LEVELS);
  const upsideMatches = countMatches(haystack, HIGH_UPSIDE_TERMS);
  const compMatches = countMatches(haystack, COMPENSATION_TERMS);
  const prestigeMatches = countMatches(haystack, PRESTIGE_TERMS);

  const fitScore = clampScore(10 + targetRoleMatches * 4 + targetDomainMatches * 3 + strengthMatches * 2, 30);
  const financialUpsideScore = clampScore(8 + upsideMatches * 2.5, 25);
  const compensationScore = clampScore(8 + compMatches * 3 + roleLevelMatches, 20);
  const scopeScore = clampScore(3 + roleLevelMatches * 2, 10);
  const prestigeScore = clampScore(3 + prestigeMatches * 3 + (haystack.includes("founding") ? 2 : 0), 10);
  const normalizedAccessScore = clampScore(accessScore, 5);
  const totalScore = clampScore(
    fitScore + financialUpsideScore + compensationScore + scopeScore + prestigeScore + normalizedAccessScore,
    100,
  );
  const finalScore = totalScore;

  const strongestSignals = [
    fitScore >= 24 ? "strong background fit" : "moderate background fit",
    financialUpsideScore >= 18 ? "high-upside domain" : "needs company upside validation",
    compensationScore >= 15 ? "senior compensation signal" : "compensation signal unclear",
    normalizedAccessScore <= 1 ? "access not yet researched" : "warm access signal present",
  ];

  return {
    ...job,
    roleId: roleIdFor(job),
    roleType: inferRoleType(job.title),
    level: inferLevel(job.title),
    totalScore,
    fitScore,
    financialUpsideScore,
    compensationScore,
    scopeScore,
    prestigeScore,
    accessScore: normalizedAccessScore,
    manualScoreOverride: "",
    finalScore,
    classification: classify(finalScore),
    scoreRationale: strongestSignals.join("; "),
    recommendedAction: actionFor(finalScore),
    resumeAngle: "Emphasize the experience from your profile that best matches the role's domain, level, and business model.",
    outreachAngle:
      "Lead with a concise thesis on how your relevant product experience maps to the company's current product surface.",
  };
}

export function scoreJobs(jobs: RawJob[], candidateProfile: CandidateProfile): ScoredJob[] {
  return jobs.map((job) => scoreJob(job, candidateProfile));
}
