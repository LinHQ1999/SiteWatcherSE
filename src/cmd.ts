import { program } from 'commander';
import { readFile } from 'fs/promises';
import { BrowserEngine } from './engines/Browser';
import notifier from 'node-notifier';
import { TSiteQuery } from './scraper';
import { StartServer } from './server';

program.name('swatcher')
  .description('watch sites defined in json file');

program.command('once')
  .description("查看一次网站")
  .argument('<file>', '配置文件路径')
  .action(async (file: string) => {
    const cfg = await readFile(file, 'utf8');
    const cfgParsed = JSON.parse(cfg) as Array<TSiteQuery>;
    const engine = await BrowserEngine.create();
    const results = await Promise.all(cfgParsed.map(cfg => engine.compare(cfg)));
    console.log(`访问完成，总共 ${cfgParsed.length} 个站`);
    cfgParsed.forEach((cfg, idx) => {
      if (results[idx]?.updated) notifier.notify(`${cfg.site} 更新！`);
    });
    engine.stop();
  });

program.command('serve')
  .action(StartServer);


program.parse();

