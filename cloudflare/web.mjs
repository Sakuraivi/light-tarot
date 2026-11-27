const backendPath = /^\/(?:api|master)(?:\/|$)/;

export default {
  async fetch(request, env) {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('无效路径', { status: 400 });
    }
    if (backendPath.test(pathname)) return env.TAROT_API.fetch(request);
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
