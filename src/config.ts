import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { CandidateProfile, RuntimeConfig, SearchConfig } from "./types.js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const DEFAULT_LINKEDIN_ALLOWED_LOCATIONS = [
  "remote",
  "san francisco",
  "san francisco bay area",
  "bay area",
  "oakland",
  "berkeley",
  "emeryville",
  "south san francisco",
  "daly city",
  "san mateo",
  "redwood city",
  "menlo park",
  "palo alto",
  "mountain view",
  "sunnyvale",
  "cupertino",
  "santa clara",
  "san jose",
  "fremont",
  "san ramon",
  "pleasanton",
];

const candidateProfileSchema = z.object({
  headline: z.string(),
  background: z.array(z.string()),
  targetRoles: z.array(z.string()),
  targetDomains: z.array(z.string()),
  strengths: z.array(z.string()),
});

const searchConfigSchema = z.object({
  linkedin: z.object({
    enabled: z.boolean(),
    queries: z.array(z.object({ name: z.string(), url: z.string().url() })),
    maxJobsPerQuery: z.number().int().positive(),
  }),
});

function readJson<T>(filePath: string, schema: z.ZodType<T>): T {
  const raw = readFileSync(filePath, "utf8");
  return schema.parse(JSON.parse(raw));
}

function loadConfigFile<T>(localPath: string, examplePath: string, schema: z.ZodType<T>): T {
  const selectedPath = existsSync(localPath) ? localPath : examplePath;
  return readJson(selectedPath, schema);
}

function boolFromEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function csvFromEnv(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value?.trim()) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function applyLinkOverride(searches: SearchConfig): SearchConfig {
  const link = process.env.LINK?.trim();
  if (!link) return searches;

  const parsedUrl = z.string().url().parse(link);
  const name = process.env.LINK_NAME?.trim() || "One-off LinkedIn link";
  return {
    ...searches,
    linkedin: {
      ...searches.linkedin,
      enabled: true,
      queries: [{ name, url: parsedUrl }],
    },
  };
}

export function loadRuntimeConfig(rootDir = process.cwd()): RuntimeConfig {
  const googleSheetId = process.env.GOOGLE_SHEET_ID;
  if (!googleSheetId) {
    throw new Error("GOOGLE_SHEET_ID is required. Set it in your shell, .env, or .env.local.");
  }

  const candidateProfile = loadConfigFile<CandidateProfile>(
    path.join(rootDir, "config/candidate-profile.local.json"),
    path.join(rootDir, "config/candidate-profile.example.json"),
    candidateProfileSchema,
  );

  const searches = applyLinkOverride(
    loadConfigFile<SearchConfig>(
      path.join(rootDir, "config/searches.local.json"),
      path.join(rootDir, "config/searches.example.json"),
      searchConfigSchema,
    ),
  );

  return {
    googleSheetId,
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    dryRun: boolFromEnv("DRY_RUN", true),
    headless: boolFromEnv("HEADLESS", false),
    linkedinSearchLocation: process.env.LINKEDIN_SEARCH_LOCATION?.trim() || undefined,
    linkedinAllowedLocations: csvFromEnv("LINKEDIN_ALLOWED_LOCATIONS", DEFAULT_LINKEDIN_ALLOWED_LOCATIONS),
    linkedinPageDelayMinMs: numberFromEnv("LINKEDIN_PAGE_DELAY_MIN_MS", numberFromEnv("LINKEDIN_PAGE_DELAY_MS", 3000)),
    linkedinPageDelayMaxMs: numberFromEnv("LINKEDIN_PAGE_DELAY_MAX_MS", 6000),
    linkedinSearchScrollsMin: numberFromEnv("LINKEDIN_SEARCH_SCROLLS_MIN", 2),
    linkedinSearchScrollsMax: numberFromEnv("LINKEDIN_SEARCH_SCROLLS_MAX", numberFromEnv("LINKEDIN_SEARCH_SCROLLS", 4)),
    candidateProfile,
    searches,
  };
}
