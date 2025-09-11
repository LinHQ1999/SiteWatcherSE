import { Browser, chromium, devices, firefox } from "playwright";
import { Scraper, TSiteQuery } from "../scraper.js";
import { getProfileState, saveProfileState, saveSite } from "../dao.js";
import ora from 'ora';
import { c, timeouts } from "../utils.js";

export class BrowserEngine implements Scraper {
  protected browser;
  protected loginProfile;
  protected sites: Set<string> = new Set();

  constructor(browser: Browser, login: string) {
    this.browser = browser;
    this.loginProfile = login;
  }

  public format(text: string | null) {
    if (!text) return "";
    return text.trim().replaceAll(/(\s){3,}/g, "$1");
  }

  public docCompose(titles: string[], contents: string[], subpages: string[]) {
    let res = [];
    const maxLen = Math.min(titles.length, contents.length, subpages.length === 0 ? titles.length : subpages.length);
    for (let i = 0; i < maxLen - 1; i++) {
      res.push(`${titles[i]}\n\n${contents[i]}\n\n${subpages[i] || ''}`);
    }

    return res.join("\n".repeat(3));
  }

  public async fetchSite(siteInfo: TSiteQuery) {
    const { site, selector } = siteInfo;

    const o = ora(`准备访问：${siteInfo.site}`).start();

    o.text = "创建页面中";
    const ctx = await this.newCtx();

    const page = await ctx.newPage();

    o.text = `等待 ${site} 加载`;
    await page.goto(site, { timeout: timeouts.SELECTOR, waitUntil: 'networkidle' });

    if (selector) {
      o.text = `正在提取页面`;
      const allTitles = (await page.locator(selector.title).allTextContents()).map(this.format);
      const allContents = (await page.locator(selector.content).allTextContents()).map(this.format);
      const allSubPages: Array<string> = [];

      if (selector.dig) {
        for (const lo of await page.locator(selector.dig.link).all()) {
          o.text = `正在进一步提取页面 ${await lo.textContent()}`;
          await lo.click({ modifiers: ['ControlOrMeta'] });
          const page = await ctx.waitForEvent('page');
          await page.waitForLoadState("networkidle");
          const content = this.format((await page.locator(selector.dig.body).getByRole("paragraph").allTextContents()).join("\n") ?? "");
          await page.close();
          await this.sleep(Math.min(1000, Math.random() * 1500));
          allSubPages.push(content);
        }
      }

      o.succeed("成功！");
      return {
        content: this.docCompose(allTitles, allContents, allSubPages),
        title: await page.title()
      };
    } else {
      o.fail("选择器应用失败！存储整个页面！");
      return {
        content: await (await page.$("body"))?.textContent() ?? "",
        title: await page.title()
      };
    }
  }

  public async sleep(ms: number) {
    return new Promise(res => {
      setTimeout(res, ms);
    });
  }

  public async saveOrIgnore(siteInfo: TSiteQuery, content: string, title: string) {
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

  public async newCtx() {
    const state = JSON.parse(await getProfileState(this.loginProfile) || "{}");
    return await this.browser.newContext({ ...devices['Desktop Chrome'], storageState: state });
  }

  public async doLogin(url: string) {
    const ctx = await this.newCtx();
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForEvent('close', { timeout: timeouts.LOGIN });
    return await saveProfileState(this.loginProfile, JSON.stringify(await ctx.storageState()));
  }

  static async create(loginProfile = "", headless = true, type = 'chromium') {
    let browser;
    switch (type) {
      case 'firefox':
        browser = await firefox.launch({ headless });
        break;
      default:
        browser = await chromium.launch({ headless });
    }

    return new BrowserEngine(browser, loginProfile);
  }
};
