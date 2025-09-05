import { Browser, devices, chromium } from "playwright";
import { Scraper, TSiteQuery } from "../scraper";
import db from '../dao';
import { siteTable } from "../db/schema";
import { desc, eq } from "drizzle-orm";

export class BrowserEngine implements Scraper {
  private browser;
  private sites: Set<string> = new Set();

  constructor(browser: Browser) {
    this.browser = browser;
  }

  private paraIntersect(titles: (string | null)[], contents: (string | null)[]) {
    let res = [];
    const maxLen = Math.min(titles.length, contents.length);
    for (let i = 0; i < maxLen - 1; i++) {
      res.push(`${titles[i]}\n${contents[i]}`);
    }

    return res.join("\n\n");
  }

  public async compare(siteInfo: TSiteQuery, save = true) {
    try {
      const { site, selector } = siteInfo;

      if (!site) {
        throw new Error('Site URL is required');
      }

      this.sites.add(site);

      // Always create a new context for isolation
      const context = await this.browser.newContext(devices["Desktop Chrome"]);
      const page = await context.newPage();
      
      try {
        await page.goto(site, { timeout: 30000, waitUntil: 'domcontentloaded' });

        let body = "";
        if (selector) {
          // Wait for selectors to be present
          try {
            await page.waitForSelector(selector.title, { timeout: 5000 });
            await page.waitForSelector(selector.content, { timeout: 5000 });
          } catch (e) {
            console.warn(`Selectors not found for ${site}:`, e);
          }
          
          const allTitles = await Promise.all(
            (await page.$$(selector.title)).map(title => title.textContent())
          );
          const allContents = await Promise.all(
            (await page.$$(selector.content)).map(content => content.textContent())
          );

          body = this.paraIntersect(allTitles, allContents);
        } else {
          body = await (await page.$("body"))?.textContent() ?? "";
        }

        let updated = false;
        if (save) {
          try {
            const recent = await db.select({
              parsed: siteTable.parsed
            }).from(siteTable).where(eq(siteTable.site, site)).orderBy(desc(siteTable.timestamp)).limit(1);
            
            updated = recent.length === 0 || (recent[0].parsed !== body);
            if (updated) {
              await db.insert(siteTable).values({
                site,
                timestamp: Date.now(),
                parsed: body
              });
            }
          } catch (e) {
            console.error('Database error:', e);
            throw e;
          }
        }

        return { content: body, updated };
      } finally {
        await page.close();
        await context.close();
      }
    } catch (error) {
      console.error(`Error processing ${siteInfo.site}:`, error);
      throw error;
    }
  }

  public async stop() {
    try {
      await this.browser.close();
      return true;
    } catch (e) {
      console.error('Error closing browser:', e);
      return false;
    }
  }

  static async create() {
    const browser = await chromium.launch();
    return new BrowserEngine(browser);
  }
}
