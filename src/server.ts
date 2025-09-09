import Fastify from 'fastify';
import { BrowserEngine } from './engines/Browser.js';
import { TSiteQuery, SiteQuery } from './scraper.js';

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

export async function StartServer(port = 3001) {
  try {
    browser = await BrowserEngine.create();
    await fastify.listen({ port });
  } catch (e) {

    fastify.log.error(e);
    browser?.stop();
    process.exit(1);
  }
}
