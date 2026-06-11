import { chromium } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";

async function main(): Promise<void> {
  const profileDir = path.resolve("browser-profile");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });

  console.log("");
  console.log("LinkedIn login browser is open.");
  console.log("Log in manually, complete any checkpoint, then return here.");
  console.log(`Profile directory: ${profileDir}`);
  console.log("");

  const rl = readline.createInterface({ input, output });
  await rl.question("Press Enter after LinkedIn is fully logged in...");
  rl.close();
  await context.close();
  console.log("Saved LinkedIn session to browser-profile/.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
