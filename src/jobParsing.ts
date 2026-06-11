import type { RawJob } from "./types.js";

const GENERIC_COMPANY_VALUES = new Set([
  "principal",
  "senior",
  "staff",
  "product",
  "director",
  "director of",
  "director,",
  "lead",
  "head of",
  "vp",
  "vp of",
  "vp,",
  "sr.",
]);

const ROLE_ACTION_TERMS = [
  "own",
  "lead",
  "drive",
  "define",
  "build",
  "shape",
  "set vision",
  "roadmap",
  "strategy",
  "partner",
  "collaborate",
  "core systems",
  "platform",
  "accessibility",
  "standards",
  "technical",
  "architecture",
  "endpoints",
  "metrics",
  "launch",
  "scale",
  "cross-functional",
  "requirements",
  "tradeoffs",
];

const ROLE_SECTION_MARKERS = [
  "what you'll do",
  "what you’ll do",
  "what you will do",
  "in this role",
  "responsibilities",
  "the role",
  "about the role",
  "what this role will do",
  "you will",
  "you'll",
  "you’ll",
];

const BOILERPLATE_TERMS = [
  "mission is",
  "our mission",
  "who we are",
  "about the company",
  "about us",
  "equal opportunity",
  "accommodation",
  "benefits",
  "compensation",
  "pay range",
  "privacy policy",
  "we are proud",
  "we believe",
  "employees worldwide",
  "followers",
  "show more",
  "clicked apply",
  "tailor my resume",
  "create cover letter",
];

function cleanText(value: string): string {
  return value
    .replace(/([a-z)&])(?=(Own|Define|Lead|Serve|Manage|Track|Resolve|Drive|Partner|Build|Design|Shape|Develop|Ensure|Translate|Influence|Author|Establish)\b)/g, "$1. ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isSuspiciousCompany(company: string, title: string): boolean {
  const normalizedCompany = normalize(company);
  if (!normalizedCompany) return true;
  if (GENERIC_COMPANY_VALUES.has(normalizedCompany)) return true;
  if (normalize(title).startsWith(normalizedCompany + " ")) return true;
  return false;
}

function inferCompanyFromJdPrefix(job: RawJob): string | undefined {
  const jdText = cleanText(job.jdText);
  const title = cleanText(job.title);
  if (!jdText || !title) return undefined;

  const titleIndex = jdText.toLowerCase().indexOf(title.toLowerCase());
  if (titleIndex <= 0 || titleIndex > 80) return undefined;

  const candidate = jdText.slice(0, titleIndex).replace(/^(about the job|job details)/i, "").trim();
  if (candidate.length < 2 || candidate.length > 60) return undefined;
  if (/\b(apply|save|promoted|full time|part time|remote|hybrid)\b/i.test(candidate)) return undefined;
  return candidate;
}

function roleRelevantWindow(jdText: string): string {
  const cleaned = cleanText(jdText);
  const lower = cleaned.toLowerCase();
  const markerIndex = ROLE_SECTION_MARKERS.map((marker) => lower.indexOf(marker)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  const aboutIndex = lower.indexOf("about the job");
  const startIndex = markerIndex ?? (aboutIndex >= 0 ? aboutIndex + "about the job".length : 0);
  const stopMatch = cleaned
    .slice(startIndex)
    .match(/\b(Qualifications|Minimum qualifications|Required qualifications|What You Need|What We(?:'|’)re Looking For|About [A-Z][A-Za-z0-9 .,&-]+|Compensation Range|Equal Opportunity|Benefits|Privacy Policy)\b/);
  const stopIndex = stopMatch?.index === undefined ? startIndex + 4000 : startIndex + stopMatch.index;
  return cleanText(cleaned.slice(startIndex, stopIndex)).slice(0, 4000);
}

function sentenceSplit(text: string): string[] {
  return cleanText(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .flatMap((sentence) => sentence.split(/(?<=:)\s+(?=[A-Z])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 500);
}

function isBoilerplate(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return BOILERPLATE_TERMS.some((term) => lower.includes(term));
}

function scoreSynopsisSentence(sentence: string, job: RawJob): number {
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const term of ROLE_ACTION_TERMS) {
    if (lower.includes(term)) score += 3;
  }
  for (const titlePart of normalize(job.title).split(" ").filter((part) => part.length > 3)) {
    if (lower.includes(titlePart)) score += 1;
  }
  if (/\byou(?:'|’)ll\b|\byou will\b|\bthis role\b|\bin this role\b/i.test(sentence)) score += 5;
  if (/\bown\b|\blead\b|\bdefine\b|\bdrive\b/i.test(sentence)) score += 4;
  if (isBoilerplate(sentence)) score -= 10;
  return score;
}

function concise(sentence: string): string {
  const stopped = sentence.split(/(Qualifications|Minimum qualifications|Required qualifications|Preferred Qualifications|What You Need|What We(?:'|’)re Looking For|Your Skills|You Have|✅|🧠)/i)[0] ?? sentence;
  const cleaned = cleanText(stopped)
    .replace(/^(Responsibilities|What You'll Do|What You’ll Do|In This Role, You Will|In this role[:,]?)/i, "")
    .replace(/\bYour$/, "")
    .trim();
  if (cleaned.length <= 280) return cleaned;
  const clipped = cleaned.slice(0, 280);
  return clipped.slice(0, Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(","), clipped.lastIndexOf(";"))).trim() || clipped.trim();
}

export function summarizeJd(job: RawJob): string {
  const roleWindow = roleRelevantWindow(job.jdText);
  const candidates = sentenceSplit(roleWindow)
    .filter((sentence) => !isBoilerplate(sentence))
    .map((sentence, index) => ({ sentence: concise(sentence), score: scoreSynopsisSentence(sentence, job), index }))
    .filter((candidate) => candidate.score > 0 && candidate.sentence.length >= 35)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map((candidate) => candidate.sentence);

  if (candidates.length > 0) return candidates.join(" ");

  const company = job.company || "the company";
  const location = job.location ? ` based in ${job.location}` : "";
  return `This ${job.title} role at ${company}${location} appears relevant based on its title and available job-description text.`;
}

export function enrichJobFromJd(job: RawJob): RawJob {
  const inferredCompany = inferCompanyFromJdPrefix(job);
  const company = inferredCompany && isSuspiciousCompany(job.company, job.title) ? inferredCompany : job.company;
  return {
    ...job,
    company,
    jdSynopsis: summarizeJd({ ...job, company }),
  };
}
