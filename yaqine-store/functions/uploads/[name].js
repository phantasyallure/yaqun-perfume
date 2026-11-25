// Serves product images from R2 with long-lived caching
export async function onRequestGet({ params, env }) {
  const o = await env.BUCKET.get(params.name);
  if (!o) return new Response('Not found', { status: 404 });
  return new Response(o.body, { headers: {
    'Content-Type': o.httpMetadata?.contentType || 'image/webp',
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: o.httpEtag
  }});
}
