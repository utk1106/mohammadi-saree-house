const SLOT_COUNT = 20;
const SLOT_PREFIX = 'slots/';
const OVERRIDES_KEY = 'overrides.json';

// The 20 cards hardcoded in index.html (see each <figure data-slot="N">), in
// document order. This is the fallback shown until an admin replaces a slot
// via admin.html — keep this in sync if the hardcoded cards ever change.
const DEFAULTS = [
  { type: 'image', url: '/assets/images/product-01.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-02.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-03.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-05.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-06.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-08.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-09.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-10.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-11.jpg', alt: 'Saree from Mohammadi Saree House' },
  { type: 'video', url: '/assets/video/shelf-01.mp4', poster: '/assets/video/shelf-01-poster.jpg' },
  { type: 'image', url: '/assets/images/product-12.jpg', alt: 'Punjabi suit from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-14.jpg', alt: 'Mauve embroidered Punjabi suit from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-16.jpg', alt: 'Dusty rose embroidered Punjabi suit from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-17.jpg', alt: 'Cream and teal Punjabi suit from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-18.jpg', alt: 'Cream and navy Punjabi suit from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-19.jpg', alt: 'Olive green embroidered Punjabi suit from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-20.jpg', alt: 'Cream and red Punjabi suit from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-21.jpg', alt: 'White embroidered lehenga dupatta from Mohammadi Saree House' },
  { type: 'image', url: '/assets/images/product-22.jpg', alt: 'Red bridal lehenga from Mohammadi Saree House' },
  { type: 'video', url: '/assets/video/shelf-02.mp4', poster: '/assets/video/shelf-02-poster.jpg' },
];

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/slots' && request.method === 'GET') {
      return jsonResponse(await getSlots(env));
    }
    if (pathname === '/api/admin/replace' && request.method === 'POST') {
      return handleReplace(request, env);
    }
    if (pathname.startsWith(`/${SLOT_PREFIX}`) && request.method === 'GET') {
      return serveSlotFile(pathname.slice(1), env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function readOverrides(env) {
  const obj = await env.PRODUCTS_BUCKET.get(OVERRIDES_KEY);
  return obj ? obj.json() : {};
}

async function getSlots(env) {
  const overrides = await readOverrides(env);
  return DEFAULTS.map((def, i) => {
    const slot = i + 1;
    const override = overrides[slot];
    return override ? { slot, isOverride: true, ...override } : { slot, isOverride: false, ...def };
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

async function handleReplace(request, env) {
  if (request.headers.get('authorization') !== `Bearer ${env.ADMIN_PASSWORD}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const form = await request.formData();
  const slot = parseInt(form.get('slot'), 10);
  const file = form.get('media');
  const alt = (form.get('alt') || '').toString().slice(0, 200);
  if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) {
    return jsonResponse({ error: 'Invalid slot number' }, 400);
  }
  if (!(file instanceof File) || !/^(image|video)\//.test(file.type)) {
    return jsonResponse({ error: 'Please upload an image or video file' }, 400);
  }

  const type = file.type.startsWith('video/') ? 'video' : 'image';
  const ext = (file.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${SLOT_PREFIX}${slot}-${Date.now()}.${ext}`;
  await env.PRODUCTS_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const overrides = await readOverrides(env);
  const previous = overrides[slot];
  if (previous?.url?.startsWith(`/${SLOT_PREFIX}`)) {
    await env.PRODUCTS_BUCKET.delete(previous.url.slice(1)).catch(() => {});
  }

  const entry = { type, url: `/${key}`, alt: alt || 'Saree from Mohammadi Saree House', uploadedAt: new Date().toISOString() };
  overrides[slot] = entry;
  await env.PRODUCTS_BUCKET.put(OVERRIDES_KEY, JSON.stringify(overrides), { httpMetadata: { contentType: 'application/json' } });

  return jsonResponse({ ok: true, slot, ...entry });
}

async function serveSlotFile(key, env) {
  const obj = await env.PRODUCTS_BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
