import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';
import { processShopeeLink } from './services/phase1.mjs';
import { MessageRouter } from './messaging/router.mjs';
import { resolveAndClassifyShopeeUrl } from './shopee/classifier.mjs';

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

async function readJson(req, maxBytes = 64 * 1024) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) throw new Error('Request body quá lớn.');
  }
  return body ? JSON.parse(body) : {};
}

const router = new MessageRouter({
  processLink: processShopeeLink,
  classifyLink: (url) => resolveAndClassifyShopeeUrl(url, { timeoutMs: config.resolveTimeoutMs })
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/simulator')) {
      const html = fs.readFileSync(path.resolve(process.cwd(), 'public/simulator.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'shopee-affiliate-zalo-bot-phase1',
        openApiConfigured: Boolean(config.shopeeApiAppId && config.shopeeApiSecret),
        affiliateIdConfigured: Boolean(config.shopeeAffiliateId)
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/shopee/classify') {
      const input = url.searchParams.get('url');
      if (!input) return json(res, 400, { ok: false, error: 'Thiếu query url.' });
      const data = await resolveAndClassifyShopeeUrl(input, { timeoutMs: config.resolveTimeoutMs });
      return json(res, 200, { ok: true, data });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/affiliate/convert') {
      const body = await readJson(req);
      const result = await processShopeeLink({
        url: body.url,
        userId: body.userId || 'guest',
        displayName: body.displayName || '',
        resolve: body.resolve !== false
      });
      return json(res, 200, { ok: true, data: result });
    }

    // Pure local simulator for parser/router/template testing before a real Zalo account is connected.
    if (req.method === 'POST' && url.pathname === '/api/v1/messages/simulate') {
      const body = await readJson(req);
      const result = await router.route({
        senderId: body.senderId,
        senderName: body.senderName,
        groupId: body.groupId || 'simulator-group',
        messageId: body.messageId || `sim-${Date.now()}`,
        text: body.text,
        isOwnMessage: body.isOwnMessage
      }, {
        mockAffiliate: body.mockAffiliate || null,
        previewCommands: body.previewCommands === true,
        skipDedupe: body.skipDedupe !== false
      });
      return json(res, 200, { ok: true, data: result });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/zalo/webhook-demo') {
      const body = await readJson(req);
      const result = await router.route(body, {
        mockAffiliate: body.mockAffiliate || null,
        previewCommands: body.previewCommands === true
      });
      return json(res, 200, { ok: true, data: result });
    }

    return json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    return json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(config.port, () => {
  console.log(`Phase 1 server listening on http://localhost:${config.port}`);
});
