import HTMLConverter from './html2json.js';

function getTld(tier) {
  if (tier === 'preview') return 'page';
  if (tier === 'review') return 'reviews';
  return 'live';
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const [tier, org, site, ...rest] = url.pathname
        .replace('.json', '')
        .slice(1)
        .split('/');

    const tld = getTld(tier);

    const origin = `https://main--${site}--${org}.aem.${tld}`;
    const path = `/${rest.join('/')}`;

    try {
      const response = await fetch(`${origin}${path}`);
      const html = await response.text();

      const converter = new HTMLConverter(html);
      
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');

      return new Response(JSON.stringify(converter.json, null, 4), {
        status: response.status,
        headers
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }
  },
};