import { Browser, devices, chromium } from "playwright";
import { desc, eq } from "drizzle-orm";
import type database from "../dao.js";
import { siteTable } from "../db/schema.js";
import { Scraper, TSiteQuery } from "../scraper.js";
import { diffLatest, getProfileState, saveProfileState } from "../dao.js";

export class BrowserEngine implements Scraper {
  private browser;
  private db;
  private loginProfile;
  private sites: Set<string> = new Set();

  constructor(browser: Browser, db: typeof database, login: string) {
    this.browser = browser;
    this.db = db;
    this.loginProfile = login;
  }

  private paraIntersect(titles: (string | undefined)[], contents: (string | undefined)[]) {
    let res = [];
    const maxLen = Math.min(titles.length, contents.length);
    for (let i = 0; i < maxLen - 1; i++) {
      res.push(`${titles[i]}\n${contents[i]}`);
    }

    return res.join("\n\n");
  }

  private async fetchSite(siteInfo: TSiteQuery) {
    const { site, selector } = siteInfo;

    let context;
    if (!!this.loginProfile) {
      const state = JSON.parse(await getProfileState(this.loginProfile));
      context = await this.browser.newContext({ ...devices["Desktop Chrome"], storageState: state });
    } else {
      context = await this.browser.newContext(devices["Desktop Chrome"]);
    }

    const page = await context.newPage();

    await page.goto(site, { timeout: 30000, waitUntil: 'domcontentloaded' });

    if (selector) {
      // Wait for selectors to be present
      try {
        await page.waitForSelector(selector.title, { timeout: 50000 });
        await page.waitForSelector(selector.content, { timeout: 50000 });
      } catch (e) {
        console.warn(`Selectors not found for ${site}:`, e);
      }

      const allTitles = (await Promise.all(
        (await page.$$(selector.title)).map(title => title.textContent())
      )).map(title => title?.trim());
      const allContents = (await Promise.all(
        (await page.$$(selector.content)).map(content => content.textContent())
      )).map(content => content?.trim());

      return this.paraIntersect(allTitles, allContents);
    } else {
      return await (await page.$("body"))?.textContent() ?? "";
    }

  }

  private async diffSave(siteInfo: TSiteQuery, content: string) {
    const { site } = siteInfo;
    try {
      const recent = await this.db.select({
        parsed: siteTable.parsed
      }).from(siteTable).where(eq(siteTable.site, site)).orderBy(desc(siteTable.timestamp)).limit(1);

      const updated = recent.length === 0 || (recent[0].parsed !== content);
      if (updated) {
        await this.db.insert(siteTable).values({
          site,
          timestamp: Date.now(),
          parsed: content
        });
      }
      return updated;
    } catch (e) {
      console.error('Database error:', e);
      throw e;
    }
  }

  public async compare(siteInfo: TSiteQuery, save = true) {
    const { site } = siteInfo;

    if (!site) {
      throw new Error('Site URL is required');
    }

    this.sites.add(site);

    const body = await this.fetchSite(siteInfo);
    const updated = await this.diffSave(siteInfo, body);

    if (updated) diffLatest(siteInfo);

    return { content: body, updated: save ? updated : false };
  }

  public async stop() {
    try {
      await this.browser.close();
      return true;
    } catch (e) {
      console.error('Error closing browser:', e);
      throw e;
    }
  }

  public async doLogin(url: string, finishedURL?: string) {
    const ctx = await this.browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url);
    if (finishedURL) {
      await page.waitForURL(finishedURL);
    } else {
      await page.waitForEvent('close', { timeout: 300000 });
    }
    return await saveProfileState(this.loginProfile, JSON.stringify(await ctx.storageState()));
  }

  static async create(db: typeof database, loginProfile = "", headless = true) {
    const browser = await chromium.launch({ headless });

    return new BrowserEngine(browser, db, loginProfile);
  }
}
