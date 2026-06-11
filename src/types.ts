import { z } from "zod";

export const RawJobSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().default(""),
  url: z.string().url(),
  source: z.string().min(1),
  jdText: z.string().default(""),
  jdSynopsis: z.string().default(""),
  dateFound: z.string().default(() => new Date().toISOString()),
});

export const ScoredJobSchema = RawJobSchema.extend({
  roleId: z.string().min(1),
  roleType: z.string().default(""),
  level: z.string().default(""),
  totalScore: z.number().int().min(0).max(100),
  fitScore: z.number().int().min(0).max(30),
  financialUpsideScore: z.number().int().min(0).max(25),
  compensationScore: z.number().int().min(0).max(20),
  scopeScore: z.number().int().min(0).max(10),
  prestigeScore: z.number().int().min(0).max(10),
  accessScore: z.number().int().min(0).max(5),
  manualScoreOverride: z.string().default(""),
  finalScore: z.number().int().min(0).max(100),
  classification: z.enum(["Pursue", "Potential", "Monitor", "Deprioritize"]),
  scoreRationale: z.string(),
  recommendedAction: z.string(),
  resumeAngle: z.string(),
  outreachAngle: z.string(),
});

export type RawJob = z.infer<typeof RawJobSchema>;
export type ScoredJob = z.infer<typeof ScoredJobSchema>;

export type CandidateProfile = {
  headline: string;
  background: string[];
  targetRoles: string[];
  targetDomains: string[];
  strengths: string[];
};

export type LinkedinSearch = {
  name: string;
  url: string;
};

export type SearchConfig = {
  linkedin: {
    enabled: boolean;
    queries: LinkedinSearch[];
    maxJobsPerQuery: number;
  };
};

export type RuntimeConfig = {
  googleSheetId: string;
  googleApplicationCredentials?: string;
  dryRun: boolean;
  headless: boolean;
  linkedinSearchLocation?: string;
  linkedinAllowedLocations: string[];
  linkedinPageDelayMinMs: number;
  linkedinPageDelayMaxMs: number;
  linkedinSearchScrollsMin: number;
  linkedinSearchScrollsMax: number;
  candidateProfile: CandidateProfile;
  searches: SearchConfig;
};
