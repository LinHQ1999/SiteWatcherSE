#!/usr/bin/env node
import { program } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import notifier from 'node-notifier';
import { BrowserEngine } from './engines/Browser.js';
import { SiteQuery, TSiteQuery } from './scraper.js';
import { StartServer } from './server.js';
import { clear, getSiteHist, getSites } from './dao.js';
import { join, resolve } from 'path';
import { select, checkbox, confirm } from '@inquirer/prompts';
import { CliError, DB, diff } from './utils.js';
import ora from 'ora';
import { Type } from '@sinclair/typebox';

program.name('swatcher')
  .description('watch sites defined in json file');

program.command('once')
  .description("查看一次网站")
  .argument('<file>', '配置文件路径')
  .option("--debug", "调试模式", false)
  .action(async (file: string, options: { debug: boolean; }) => {
    try {
      const cfg = await readFile(file, 'utf8');
      const cfgParsed = JSON.parse(cfg) as Array<TSiteQuery>;
      const engine = await BrowserEngine.create(resolve(file), !options.debug);
      try {
        const results = await Promise.allSettled(cfgParsed.map(cfg => engine.compare(cfg)));

        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value?.updated) {
            notifier.notify(`${cfgParsed[idx].site} 更新！`);
          } else if (result.status === 'rejected') {
            console.error(`处理 ${cfgParsed[idx].site} 时出错:`, result.reason);
          }
        });
      } finally {
        await engine.stop();
      }
    } catch (error) {
      console.error('执行命令时出错:', error);
      process.exit(1);
    }
  });

program.command('serve')
  .action(() => StartServer(3002));

program.command('diff')
  .action(async () => {
    const loading = ora("正在读取数据").start();
    const sites = (await getSites());
    while (true) {
      try {
        loading.succeed(`${DB} 读取成功`);
        if (sites.length === 0) {
          throw new CliError('当前没有网站可供选择');
        }
        const siteID = await select({
          message: `选择一个网站`,
          choices: sites.map(site => ({ name: site.title || site.site, value: site.id })),
          loop: true
        });

        const hists = await getSiteHist(sites.find(site => site.id === siteID)?.site!);
        const histSelected = await checkbox({
          message: "选取两个需要比较的版本？",
          choices: hists.map(hist => ({
            value: hist.parsed,
            name: new Date(hist.timestamp).toLocaleDateString()
          })),
          validate: choices => choices.length === 2
        });
        await diff(histSelected[0], histSelected[1]);
        break;
      } catch (e) {
        if (e instanceof CliError) {
          e.log();
          break;
        };
        console.log('取消');
      }
    }
  });

program.command("clear")
  .description("清空数据")
  .action(async () => {
    const res = await confirm({ message: "确实要清空数据吗？", default: false });
    if (res) await clear();
  });

program.command("login")
  .argument("<profile>", "配置文件")
  .argument("<url>", "登录页面链接")
  .argument("[succURL]", "登录页面跳转链接")
  .action(async (profile: string, url: string, succURL?: string) => {
    const engine = await BrowserEngine.create(resolve(profile), false);
    await engine.doLogin(url, succURL);
    engine.stop();
  });

program.command("schema")
  .description("生成 json schema")
  .argument("<path>", "生成 schema 路径")
  .action(async (path: string) => {
    const schema = Type.Array(SiteQuery);
    await writeFile(join(resolve(path), "swatcher.schema.json"), JSON.stringify(schema), 'utf8');
  });

program.parse();

