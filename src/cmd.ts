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
    try {
      const cfg = await readFile(file, 'utf8');
      const cfgParsed = JSON.parse(cfg) as Array<TSiteQuery>;
      const engine = await BrowserEngine.create();
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
  .action(StartServer);


program.parse();

