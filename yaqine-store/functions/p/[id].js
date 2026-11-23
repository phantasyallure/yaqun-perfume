// Product landing page: /p/<name>-<id>  (serves product.html with this product's title/image for sharing)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export async function onRequestGet({ request, env, params }) {
  const m = String(params.id || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const p = m && await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(m[0]).first();
  if (!p) return Response.redirect(new URL('/', request.url).href, 302);
  const origin = new URL(request.url).origin;
  const pr = { id: p.id, name: p.name, price: p.price, category: p.category, description: p.description, size: p.size, soldOut: !!p.sold_out, image: p.image };
  const page = await env.ASSETS.fetch(new URL('/product.html', request.url));
  let html = await page.text();
  const desc = (p.description || 'Boutique Yaquine — Parfums').slice(0, 200);
  const head = `<title>${esc(p.name)} — Boutique Yaquine</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product"><meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${origin}/uploads/${esc(p.image)}">
<meta property="og:url" content="${esc(request.url)}"><meta name="twitter:card" content="summary_large_image">
<script>window.__P=${JSON.stringify(pr).replace(/</g, '\\u003c')}</script>`;
  html = html.replace('<!--HEAD-->', head);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=15' } });
}
