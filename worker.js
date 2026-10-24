const UPLOADS_PREFIX = 'uploads/';
const MANIFEST_KEY = 'products.json';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/products' && request.method === 'GET') {
      return jsonResponse(await readManifest(env));
    }
    if (pathname === '/api/admin/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    if (pathname.startsWith(`/${UPLOADS_PREFIX}`) && request.method === 'GET') {
      return serveUpload(pathname.slice(1), env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function readManifest(env) {
  const obj = await env.PRODUCTS_BUCKET.get(MANIFEST_KEY);
  return obj ? obj.json() : [];
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

async function handleUpload(request, env) {
  if (request.headers.get('authorization') !== `Bearer ${env.ADMIN_PASSWORD}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const form = await request.formData();
  const file = form.get('photo');
  const alt = (form.get('alt') || '').toString().slice(0, 200);
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return jsonResponse({ error: 'Please upload an image file' }, 400);
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `${UPLOADS_PREFIX}${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.PRODUCTS_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const manifest = await readManifest(env);
  const product = { url: `/${key}`, alt, uploadedAt: new Date().toISOString() };
  manifest.unshift(product);
  await env.PRODUCTS_BUCKET.put(MANIFEST_KEY, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });

  return jsonResponse({ ok: true, product });
}

async function serveUpload(key, env) {
  const obj = await env.PRODUCTS_BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
