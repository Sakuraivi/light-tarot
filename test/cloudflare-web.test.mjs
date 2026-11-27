import assert from 'node:assert/strict';
import test from 'node:test';
import web from '../cloudflare/web.mjs';

const origin = 'https://tarot.sakura.observer';
const bind = (backend, assets) => ({ TAROT_API: { fetch: backend }, ASSETS: { fetch: assets } });
const unexpected = () => assert.fail('request reached the wrong Worker');

test('static assets and near-match paths stay on the web Worker', async () => {
  for (const path of ['/', '/site.css', '/app.mjs', '/akashic/card-78.jpg', '/masterpiece', '/apiary']) {
    const req = new Request(origin + path);
    const reply = await web.fetch(req, bind(unexpected, incoming => {
      assert.equal(incoming, req);
      return new Response('worker reply', { headers: { ETag: 'fixture' } });
    }));
    assert.equal(await reply.text(), 'worker reply');
    assert.equal(reply.headers.get('etag'), 'fixture');
    assert.equal(reply.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(reply.headers.get('x-content-type-options'), 'nosniff');
    assert.match(reply.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  }
});

test('API and admin paths preserve the original same-origin request and response', async () => {
  for (const path of ['/api', '/api/config', '/api/read', '/master', '/master/', '/master/api/settings', '/%6daster', '/api%2fconfig']) {
    const req = new Request(origin + path + '?x=1', {
      method: 'POST',
      headers: { Origin: origin, Cookie: 'synthetic=1', 'Content-Type': 'application/json' },
      body: '{"fixture":true}',
    });
    const reply = new Response('backend reply', { status: 202, headers: { 'X-Request-Id': 'fixture', 'Set-Cookie': 'synthetic=2; Secure' } });
    const actual = await web.fetch(req, bind(async incoming => {
      assert.equal(incoming, req);
      assert.equal(incoming.headers.get('origin'), origin);
      assert.equal(incoming.headers.get('cookie'), 'synthetic=1');
      assert.equal(await incoming.text(), '{"fixture":true}');
      return reply;
    }, unexpected));
    assert.equal(actual, reply);
  }
});

test('malformed encoded paths never reach a binding', async () => {
  assert.equal((await web.fetch(new Request(origin + '/%zz'), bind(unexpected, unexpected))).status, 400);
});
