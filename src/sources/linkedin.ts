import { chromium, type Page } from "playwright";
import path from "node:path";
import { enrichJobFromJd } from "../jobParsing.js";
import { recordSourceDiagnostic } from "../sourceDiagnostics.js";
import { RawJobSchema, type LinkedinSearch, type RawJob } from "../types.js";

function randomInt(min: number, max: number): number {
  const normalizedMin = Math.ceil(Math.min(min, max));
  const normalizedMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (normalizedMax - normalizedMin + 1)) + normalizedMin;
}

function normalizeLocation(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isAllowedLocation(location: string, allowedLocations: string[]): boolean {
  if (allowedLocations.length === 0) return true;
  const normalized = normalizeLocation(location);
  if (!normalized) return false;
  return allowedLocations.some((allowedLocation) => normalized.includes(normalizeLocation(allowedLocation)));
}

function hasExplicitRemoteSignal(value: string): boolean {
  return /\b(remote|united states \(remote\)|us remote|u\.s\. remote)\b/i.test(value);
}

function isAllowedJobLocation(job: Pick<RawJob, "location" | "jdText">, allowedLocations: string[]): boolean {
  if (isAllowedLocation(job.location, allowedLocations)) return true;
  return hasExplicitRemoteSignal(job.jdText) && allowedLocations.some((location) => normalizeLocation(location) === "remote");
}

function withSearchLocation(url: string, searchLocation?: string): string {
  if (!searchLocation) return url;
  const nextUrl = new URL(url);
  if (!nextUrl.searchParams.has("location")) {
    nextUrl.searchParams.set("location", searchLocation);
  }
  return nextUrl.toString();
}

async function extractVisibleJobs(page: Page, sourceName: string): Promise<RawJob[]> {
  const jobs = await page.evaluate((source) => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/jobs/view/']"));
    return anchors
      .map((anchor) => {
        const container =
          anchor.closest("[data-job-id]") ||
          anchor.closest("li") ||
          anchor.closest(".job-card-container") ||
          anchor.parentElement;
        const text = container?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const lines = text
          .split(/ (?=[A-Z][A-Za-z0-9&.,' -]{2,})/g)
          .map((line) => line.trim())
          .filter(Boolean);
        const title = anchor.textContent?.replace(/\s+/g, " ").trim() || lines[0] || "";
        const company =
          container?.querySelector<HTMLElement>("[class*='company-name'], [class*='job-card-container__primary-description']")
            ?.textContent?.replace(/\s+/g, " ")
            .trim() ||
          lines.find((line) => line !== title && !line.includes("Promoted")) ||
          "";
        const location =
          container?.querySelector<HTMLElement>("[class*='metadata-item'], [class*='job-card-container__metadata-item']")
            ?.textContent?.replace(/\s+/g, " ")
            .trim() || "";
        const url = new URL(anchor.href, window.location.href);
        url.search = "";
        return { company, title, location, url: url.toString(), source, jdText: "" };
      })
      .filter((job) => job.company && job.title && job.url);
  }, sourceName);

  const parsed: RawJob[] = [];
  for (const job of jobs) {
    const result = RawJobSchema.safeParse(job);
    if (result.success) {
      recordSourceDiagnostic({ stage: "extracted", ...result.data });
      parsed.push(result.data);
    }
  }
  return parsed;
}

async function hydrateJobDescriptions(page: Page, jobs: RawJob[], maxJobs: number, allowedLocations: string[], pageDelayMinMs: number, pageDelayMaxMs: number): Promise<RawJob[]> {
  const hydrated: RawJob[] = [];
  for (const job of jobs.slice(0, maxJobs)) {
    try {
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(randomInt(pageDelayMinMs, pageDelayMaxMs));
      const details = await page.evaluate(() => {
        const description =
          document.querySelector<HTMLElement>(".jobs-description-content__text") ||
          document.querySelector<HTMLElement>("[class*='jobs-description']") ||
          document.querySelector<HTMLElement>("main");
        const topCard =
          document.querySelector<HTMLElement>(".job-details-jobs-unified-top-card__container--two-pane") ||
          document.querySelector<HTMLElement>(".jobs-unified-top-card") ||
          document.querySelector<HTMLElement>("main");
        const title =
          topCard?.querySelector<HTMLElement>("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
        const company =
          topCard?.querySelector<HTMLAnchorElement>("a[href*='/company/']")?.textContent?.replace(/\s+/g, " ").trim() || "";
        const topCardText = topCard?.textContent?.replace(/\s+/g, " ").trim() || "";
        const locationMatch = topCardText.match(/(?:Remote|Hybrid|On-site|Onsite)?\s*(?:San Francisco Bay Area|San Francisco, CA|San Jose, CA|Palo Alto, CA|Mountain View, CA|Menlo Park, CA|Redwood City, CA|San Mateo, CA|Oakland, CA|Berkeley, CA|United States|[A-Z][A-Za-z .-]+, [A-Z]{2})(?: \((?:Remote|Hybrid|On-site|Onsite)\))?/);
        return {
          company,
          title,
          location: locationMatch?.[0] ?? "",
          jdText: description?.textContent?.replace(/\s+/g, " ").trim().slice(0, 12000) ?? "",
        };
      });
      const nextJob = {
        ...job,
        company: details.company || job.company,
        title: details.title || job.title,
        location: details.location || job.location,
        jdText: details.jdText,
      };
      const enrichedJob = enrichJobFromJd(nextJob);
      recordSourceDiagnostic({ stage: "hydrated", ...enrichedJob });
      if (isAllowedJobLocation(enrichedJob, allowedLocations)) {
        recordSourceDiagnostic({ stage: "accepted", ...enrichedJob });
        hydrated.push(enrichedJob);
      } else {
        recordSourceDiagnostic({ stage: "rejected", reason: "location_not_allowed", ...enrichedJob });
      }
    } catch {
      recordSourceDiagnostic({ stage: "failed_hydration", reason: "detail_page_error", ...job });
      if (isAllowedLocation(job.location, allowedLocations)) {
        recordSourceDiagnostic({ stage: "accepted", reason: "card_location_allowed_after_failed_hydration", ...job });
        hydrated.push(job);
      } else {
        recordSourceDiagnostic({ stage: "rejected", reason: "failed_hydration_and_location_not_allowed", ...job });
      }
    }
  }
  return hydrated;
}

export async function sourceLinkedInJobs(options: {
  queries: LinkedinSearch[];
  maxJobsPerQuery: number;
  headless: boolean;
  browserProfileDir?: string;
  searchLocation?: string;
  allowedLocations?: string[];
  pageDelayMinMs?: number;
  pageDelayMaxMs?: number;
  searchScrollsMin?: number;
  searchScrollsMax?: number;
}): Promise<RawJob[]> {
  if (options.queries.length === 0) return [];
  const profileDir = options.browserProfileDir ?? path.resolve("browser-profile");
  const allowedLocations = options.allowedLocations ?? [];
  const pageDelayMinMs = options.pageDelayMinMs ?? 3000;
  const pageDelayMaxMs = options.pageDelayMaxMs ?? 6000;
  const searchScrollsMin = options.searchScrollsMin ?? 2;
  const searchScrollsMax = options.searchScrollsMax ?? 4;
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: options.headless,
    viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const allJobs: RawJob[] = [];

  try {
    for (const query of options.queries) {
      await page.goto(withSearchLocation(query.url, options.searchLocation), { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      const searchScrolls = randomInt(searchScrollsMin, searchScrollsMax);
      for (let i = 0; i < searchScrolls; i += 1) {
        await page.mouse.wheel(0, 1200);
        await page.waitForTimeout(600);
      }
      const extracted = await extractVisibleJobs(page, "LinkedIn: " + query.name);
      const hydrated = await hydrateJobDescriptions(
        page,
        extracted,
        options.maxJobsPerQuery,
        allowedLocations,
        pageDelayMinMs,
        pageDelayMaxMs,
      );
      allJobs.push(...hydrated);
    }
  } finally {
    await context.close();
  }

  return allJobs;
}
