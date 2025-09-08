#!/usr/bin/env node
import { program } from 'commander';
import { readFile } from 'fs/promises';
import notifier from 'node-notifier';
import { BrowserEngine } from './engines/Browser.js';
import { TSiteQuery } from './scraper.js';
import { StartServer } from './server.js';
import db, { diffLatest } from './dao.js';

program.name('swatcher')
  .description('watch sites defined in json file');

program.command('once')
  .description("查看一次网站")
  .argument('<file>', '配置文件路径')
  .action(async (file: string) => {
    try {
      const cfg = await readFile(file, 'utf8');
      const cfgParsed = JSON.parse(cfg) as Array<TSiteQuery>;
      const engine = await BrowserEngine.create(db);
      try {
        const results = await Promise.allSettled(cfgParsed.map(cfg => engine.compare(cfg)));

        console.log(`访问完成，总共 ${cfgParsed.length} 个站`);
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
  .argument('<file>', '配置文件')
  .action(async (cfg: string) => {
    const cfgs: Array<TSiteQuery> = JSON.parse(await readFile(cfg, 'utf8'));
    for (const cfg of cfgs) {
      await diffLatest(cfg);
    }
  });


program.parse();

