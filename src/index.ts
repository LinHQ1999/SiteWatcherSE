import Fastify from 'fastify';
import { BrowserEngine } from './engines/Browser';
import { SiteQuery, TSiteQuery } from './scraper';

let browser: BrowserEngine | undefined;

const fastify = Fastify({
  logger: true,
});

fastify.post<{ Body: TSiteQuery; }>('/monitor', {
  schema: {
    body: SiteQuery
  }
}, async (req, resp) => {
  if (!browser) return resp.send({ no: 'engine' });
  const { site, selector } = req.body;

  const res = await browser.compare({ selector, site });
  await resp.send(res);
});

async function StartServer(port = 3001) {
  browser = await BrowserEngine.create();
  fastify.listen({ port }, async (err, _addr) => {
    if (err) {
      fastify.log.error(err);
      browser?.stop();
      process.exit(1);
    }
  });
}

StartServer();
