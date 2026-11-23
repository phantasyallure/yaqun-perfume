const J = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...h } });
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function sign(v, secret) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(v)));
}
async function authed(req, env) {
  const t = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)t=([^;]+)/)?.[1];
  if (!t) return false;
  const [exp, sig] = t.split('.');
  return Number(exp) > Date.now() && sig === await sign(exp, env.ADMIN_PASSWORD);
}
const day = (back = 0) => new Date(Date.now() + 36e5 - back * 864e5).toISOString().slice(0, 10); // Algeria time (UTC+1)
const SKEYS = ['whatsapp', 'phone', 'email', 'address', 'hours', 'facebook', 'instagram', 'tiktok', 'youtube', 'fb_pixel', 'tiktok_pixel'];
const STATUS = ['new', 'confirmed', 'delivered', 'canceled'];
const out = r => ({ id: r.id, name: r.name, price: r.price, category: r.category, description: r.description, size: r.size, soldOut: !!r.sold_out, image: r.image });
const size = v => { v = String(v || '').trim().slice(0, 30); return /^\d+(\.\d+)?$/.test(v) ? v + ' ml' : v; };
const fields = f => ({
  name: String(f.get('name') || '').trim().slice(0, 80),
  price: Math.max(0, parseInt(f.get('price')) || 0),
  category: ['Homme', 'Femme', 'Coffrets'].includes(f.get('category')) ? f.get('category') : 'Homme',
  description: String(f.get('description') || '').trim().slice(0, 400),
  size: size(f.get('size')), sold: f.get('soldOut') === 'true' ? 1 : 0
});
async function saveImage(env, file) {
  if (!file || typeof file === 'string') return null;
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 5e6) throw new Error('Image must be WebP, JPG or PNG under 5 MB');
  const name = crypto.randomUUID() + '.webp';
  await env.BUCKET.put(name, file.stream(), { httpMetadata: { contentType: file.type } });
  return name;
}
async function settings(env) {
  const { results } = await env.DB.prepare('SELECT key,value FROM settings').all();
  const s = Object.fromEntries(SKEYS.map(k => [k, '']));
  results.forEach(r => { if (r.key in s) s[r.key] = r.value; });
  if (!s.whatsapp) s.whatsapp = env.WHATSAPP || '';
  return s;
}
function cleanSetting(k, v) {
  v = String(v ?? '').trim();
  if (k === 'whatsapp') return v.replace(/\D/g, '').slice(0, 15);
  if (['facebook', 'instagram', 'tiktok', 'youtube'].includes(k)) {
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    if (!/^https?:\/\/[^\s"'<>]+$/.test(v)) throw new Error('Invalid link for ' + k);
    return v.slice(0, 200);
  }
  if (k === 'fb_pixel' || k === 'tiktok_pixel') {
    if (!/^[A-Za-z0-9]{0,30}$/.test(v)) throw new Error('Pixel ID should contain letters and numbers only');
    return v;
  }
  return v.slice(0, 200);
}


const h = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// Telegram alert. Token is a Cloudflare secret, never stored in the database or sent to the browser.
async function tg(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { ok: false, error: 'Telegram is not set up yet (bot token or chat ID missing)' };
  const ids = String(env.TELEGRAM_CHAT_ID).split(',').map(x => x.trim()).filter(Boolean);
  const rs = await Promise.all(ids.map(chat_id =>
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true })
    }).then(r => r.json()).catch(() => ({ ok: false, description: 'Could not reach Telegram' }))));
  const bad = rs.find(r => !r.ok);
  return bad ? { ok: false, error: bad.description || 'Telegram error' } : { ok: true };
}

export async function onRequest({ request, env, params, waitUntil }) {
  const parts = params.path || [], route = parts.join('/'), m = request.method, D = env.DB;
  try {
    // ---------- public ----------
    if (route === 'settings') return J(await settings(env), 200, { 'Cache-Control': 'public, max-age=15' });
    if (route === 'products' && m === 'GET') {
      const { results } = await D.prepare('SELECT * FROM products ORDER BY rowid DESC').all();
      return J(results.map(out), 200, { 'Cache-Control': 'public, max-age=15' });   // changes show within 15 s
    }
    if (route === 'track' && m === 'POST') {
      const { vid } = await request.json().catch(() => ({}));
      if (typeof vid === 'string' && /^[\w-]{8,40}$/.test(vid)) await D.prepare('INSERT INTO events (day,vid) VALUES (?,?)').bind(day(), vid).run();
      return J({ ok: true });
    }
    if (route === 'order' && m === 'POST') {
      const b = await request.json().catch(() => ({}));
      const p = await D.prepare('SELECT * FROM products WHERE id=?').bind(String(b.productId || '')).first();
      if (!p || p.sold_out) return J({ error: 'Produit indisponible' }, 400);
      const qty = Math.min(10, Math.max(1, parseInt(b.qty) || 1));
      const name = String(b.name || '').trim().slice(0, 60), wilaya = String(b.wilaya || '').trim().slice(0, 60);
      const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 16);
      if (name.length < 2 || phone.replace(/\D/g, '').length < 8 || !wilaya) return J({ error: 'Vérifiez votre nom, téléphone et wilaya' }, 400);
      const id = crypto.randomUUID();
      await D.prepare('INSERT INTO orders (id,day,product_id,product_name,size,price,qty,name,phone,wilaya) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(id, day(), p.id, p.name, p.size, p.price, qty, name, phone, wilaya).run();
      const admin = 'https://' + new URL(request.url).host + '/admin';
      waitUntil(tg(env, `🛍 <b>Nouvelle commande</b>\n\n<b>${h(p.name)}</b>${p.size ? ' · ' + h(p.size) : ''} × ${qty}\n💰 <b>${(p.price * qty).toLocaleString('fr-DZ')} DA</b>\n\n👤 ${h(name)}\n📞 ${h(phone)}\n📍 ${h(wilaya)}\n\n<a href="${admin}">Ouvrir l'administration</a>`));
      return J({ id, total: p.price * qty });
    }
    if (route === 'login' && m === 'POST') {
      const { password } = await request.json().catch(() => ({}));
      if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) return J({ error: 'Wrong password' }, 401);
      const exp = String(Date.now() + 7 * 864e5);
      return J({ ok: true }, 200, { 'Set-Cookie': `t=${exp}.${await sign(exp, env.ADMIN_PASSWORD)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800` });
    }
    if (route === 'logout') return J({ ok: true }, 200, { 'Set-Cookie': 't=; Max-Age=0; Path=/' });

    // ---------- admin ----------
    if (!(await authed(request, env))) return J({ error: 'Not logged in' }, 401);
    if (route === 'me') return J({ ok: true });

    if (route === 'admin/telegram-test' && m === 'POST') {
      const r = await tg(env, '✅ <b>Yaqine</b> : Telegram est bien connecté. Vous recevrez ici chaque nouvelle commande.');
      return r.ok ? J({ ok: true }) : J({ error: r.error }, 400);
    }
    if (route === 'admin/settings') {
      if (m === 'GET') return J(await settings(env));
      const b = await request.json(), st = [];
      for (const k of SKEYS) if (k in b) st.push(D.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, cleanSetting(k, b[k])));
      if (st.length) await D.batch(st);
      return J({ ok: true });
    }
    if (route === 'admin/stats') {
      const q = [];
      for (const n of [1, 7, 30]) {
        const d = day(n - 1);
        q.push(D.prepare('SELECT COUNT(DISTINCT vid) v, COUNT(*) views FROM events WHERE day>=?').bind(d),
          D.prepare("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status='delivered' THEN price*qty END),0) earn, COALESCE(SUM(CASE WHEN status IN ('new','confirmed') THEN price*qty END),0) pend FROM orders WHERE day>=? AND status!='canceled'").bind(d));
      }
      q.push(D.prepare('SELECT day, COUNT(DISTINCT vid) v FROM events WHERE day>=? GROUP BY day').bind(day(13)),
        D.prepare("SELECT product_name name, SUM(qty) n FROM orders WHERE day>=? AND status!='canceled' GROUP BY product_id ORDER BY n DESC LIMIT 5").bind(day(29)));
      const r = await D.batch(q), ranges = {};
      [1, 7, 30].forEach((n, i) => { ranges[n] = { ...r[2 * i].results[0], ...r[2 * i + 1].results[0] }; });
      const byDay = Object.fromEntries(r[6].results.map(x => [x.day, x.v]));
      const daily = Array.from({ length: 14 }, (_, i) => { const d = day(13 - i); return { day: d, v: byDay[d] || 0 }; });
      return J({ ranges, daily, top: r[7].results });
    }
    if (route === 'admin/orders' && m === 'GET') {
      const { results } = await D.prepare('SELECT * FROM orders ORDER BY rowid DESC LIMIT 100').all();
      return J(results);
    }
    if (parts[0] === 'admin' && parts[1] === 'orders' && parts[2]) {
      if (m === 'PUT') {
        const { status } = await request.json();
        if (!STATUS.includes(status)) return J({ error: 'Bad status' }, 400);
        await D.prepare('UPDATE orders SET status=? WHERE id=?').bind(status, parts[2]).run();
        return J({ ok: true });
      }
      if (m === 'DELETE') { await D.prepare('DELETE FROM orders WHERE id=?').bind(parts[2]).run(); return J({ ok: true }); }
    }
    if (route === 'admin/products' && m === 'POST') {
      const f = await request.formData(), v = fields(f);
      if (!v.name) return J({ error: 'Add a name' }, 400);
      const image = await saveImage(env, f.get('image'));
      if (!image) return J({ error: 'Add a product image' }, 400);
      const id = crypto.randomUUID();
      await D.prepare('INSERT INTO products (id,name,price,category,description,sold_out,image,size) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, v.name, v.price, v.category, v.description, v.sold, image, v.size).run();
      return J({ id });
    }
    if (parts[0] === 'admin' && parts[1] === 'products' && parts[2]) {
      const id = parts[2], row = await D.prepare('SELECT * FROM products WHERE id=?').bind(id).first();
      if (!row) return J({ error: 'Not found' }, 404);
      if (m === 'PUT') {
        const f = await request.formData(), v = fields(f), image = await saveImage(env, f.get('image'));
        await D.prepare('UPDATE products SET name=?,price=?,category=?,description=?,sold_out=?,image=?,size=? WHERE id=?')
          .bind(v.name || row.name, v.price, v.category, v.description, v.sold, image || row.image, v.size, id).run();
        if (image) await env.BUCKET.delete(row.image);
        return J({ ok: true });
      }
      if (m === 'DELETE') {
        await D.prepare('DELETE FROM products WHERE id=?').bind(id).run();
        await env.BUCKET.delete(row.image);
        return J({ ok: true });
      }
    }
    return J({ error: 'Not found' }, 404);
  } catch (e) { return J({ error: e.message || 'Server error' }, 400); }
}
