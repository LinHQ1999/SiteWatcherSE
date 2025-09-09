import { Browser, devices, chromium } from "playwright";
import { Scraper, TSiteQuery } from "../scraper.js";
import { getProfileState, saveProfileState, saveSite } from "../dao.js";
import ora from 'ora';
import { c, timeouts } from "../utils.js";

export class BrowserEngine implements Scraper {
  private browser;
  private loginProfile;
  private sites: Set<string> = new Set();

  constructor(browser: Browser, login: string) {
    this.browser = browser;
    this.loginProfile = login;
  }

  private format(text: string | null) {
    if (!text) return "";
    return text.trim().replaceAll(/(\s){3,}/g, "$1");
  }

  private docCompose(titles: (string | undefined)[], contents: (string | undefined)[]) {
    let res = [];
    const maxLen = Math.min(titles.length, contents.length);
    for (let i = 0; i < maxLen - 1; i++) {
      res.push(`${titles[i]}\n\n${contents[i]}`);
    }

    return res.join("\n".repeat(3));
  }

  private async fetchSite(siteInfo: TSiteQuery) {
    const { site, selector } = siteInfo;
    const loader = ora(`准备访问：${siteInfo.site}`).start();

    let context;
    if (!!this.loginProfile) {
      const state = JSON.parse(await getProfileState(this.loginProfile));
      context = await this.browser.newContext({ ...devices["Desktop Chrome"], storageState: state });
    } else {
      context = await this.browser.newContext(devices["Desktop Chrome"]);
    }

    loader.text = "创建页面中";
    const page = await context.newPage();

    loader.text = `等待 ${site} 加载`;
    await page.goto(site, { timeout: 30000, waitUntil: 'domcontentloaded' });

    if (selector) {
      // Wait for selectors to be present
      try {
        loader.text = "等待选取元素出现";
        await page.waitForSelector(selector.title, { timeout: timeouts.SELECTOR });
        await page.waitForSelector(selector.content, { timeout: timeouts.SELECTOR });
      } catch (e) {
        console.warn(`Selectors not found for ${site}:`, e);
        loader.fail("没有元素");
      }

      const allTitles = (await Promise.all(
        (await page.$$(selector.title)).map(title => title.textContent())
      )).map(this.format);
      const allContents = (await Promise.all(
        (await page.$$(selector.content)).map(content => content.textContent())
      )).map(this.format);

      loader.succeed("选择器应用成功！");
      return {
        content: this.docCompose(allTitles, allContents),
        title: await page.title()
      };
    } else {
      loader.fail("选择器应用失败！存储整个页面！");
      return {
        content: await (await page.$("body"))?.textContent() ?? "",
        title: await page.title()
      };
    }
  }

  private async saveOrIgnore(siteInfo: TSiteQuery, content: string, title: string) {
    const { site } = siteInfo;
    try {
      return (await saveSite({
        site,
        site_title: title,
        timestamp: Date.now(),
        parsed: content
      })).rows.length > 0;
    } catch (e) {
      console.error('Database error:', e);
      throw e;
    }
  }

  public async compare(siteInfo: TSiteQuery) {
    const { site } = siteInfo;

    if (!site) {
      throw new Error('Site URL is required');
    }

    this.sites.add(site);

    const { content, title } = await this.fetchSite(siteInfo);
    const updated = await this.saveOrIgnore(siteInfo, content, title);

    // 等待 diff 完成
    if (updated) console.log(c.bgGreen(`${site} 有更新，可以用 diff 查看`));

    return { content, updated };
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
      await page.waitForEvent('close', { timeout: timeouts.LOGIN });
    }
    return await saveProfileState(this.loginProfile, JSON.stringify(await ctx.storageState()));
  }

  static async create(loginProfile = "", headless = true) {
    const browser = await chromium.launch({ headless });

    return new BrowserEngine(browser, loginProfile);
  }
}
