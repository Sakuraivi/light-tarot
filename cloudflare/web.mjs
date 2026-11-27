const backendPath = /^\/(?:api|master)(?:\/|$)/;

export default {
  async fetch(request, env) {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('无效路径', { status: 400 });
    }
    return backendPath.test(pathname)
      ? env.TAROT_API.fetch(request)
      : env.ASSETS.fetch(request);
  },
};
