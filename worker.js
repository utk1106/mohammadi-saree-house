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
    if (pathname === '/api/admin/stream/create' && request.method === 'POST') {
      return handleStreamCreate(request, env);
    }
    if (pathname === '/api/admin/stream/finalize' && request.method === 'POST') {
      return handleStreamFinalize(request, env);
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

async function writeOverrides(overrides, env) {
  await env.PRODUCTS_BUCKET.put(OVERRIDES_KEY, JSON.stringify(overrides), { httpMetadata: { contentType: 'application/json' } });
}

async function getSlots(env) {
  const overrides = await readOverrides(env);
  return Promise.all(
    DEFAULTS.map(async (def, i) => {
      const slot = i + 1;
      const override = overrides[slot];
      if (!override) return { slot, isOverride: false, ...def };
      if (override.type === 'stream') return { slot, isOverride: true, ...(await resolveStreamSlot(override, env)) };
      return { slot, isOverride: true, ...override };
    })
  );
}

// Stream videos process asynchronously after upload, so we check readiness
// and fetch the HLS playback URL live each time slots are listed, rather
// than caching it in overrides.json (which only stores the video's uid).
async function resolveStreamSlot(override, env) {
  try {
    const details = await env.STREAM.video(override.uid).details();
    return { type: 'stream', uid: override.uid, alt: override.alt, ready: !!details.readyToStream, hlsPlaybackUrl: details.hlsPlaybackUrl };
  } catch {
    return { type: 'stream', uid: override.uid, alt: override.alt, ready: false };
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function isAuthorized(request, env) {
  return request.headers.get('authorization') === `Bearer ${env.ADMIN_PASSWORD}`;
}

// Deletes whatever a slot previously pointed at (an R2-stored photo/video, or
// a Stream-hosted video) before the slot is overwritten with something new.
async function cleanupPreviousOverride(previous, env) {
  if (!previous) return;
  if (previous.type === 'stream' && previous.uid) {
    await env.STREAM.video(previous.uid).delete().catch(() => {});
  } else if (previous.url && previous.url.startsWith(`/${SLOT_PREFIX}`)) {
    await env.PRODUCTS_BUCKET.delete(previous.url.slice(1)).catch(() => {});
  }
}

async function handleReplace(request, env) {
  if (!isAuthorized(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  const form = await request.formData();
  const slot = parseInt(form.get('slot'), 10);
  const file = form.get('media');
  const alt = (form.get('alt') || '').toString().slice(0, 200);
  if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) {
    return jsonResponse({ error: 'Invalid slot number' }, 400);
  }
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return jsonResponse({ error: 'Please upload an image here — large videos use the video upload flow automatically' }, 400);
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `${SLOT_PREFIX}${slot}-${Date.now()}.${ext}`;
  await env.PRODUCTS_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const overrides = await readOverrides(env);
  await cleanupPreviousOverride(overrides[slot], env);

  const entry = { type: 'image', url: `/${key}`, alt: alt || 'Saree from Mohammadi Saree House', uploadedAt: new Date().toISOString() };
  overrides[slot] = entry;
  await writeOverrides(overrides, env);

  return jsonResponse({ ok: true, slot, ...entry });
}

// Provisions a one-time TUS upload session with Cloudflare Stream so the
// browser can upload large videos directly to Stream, bypassing this
// Worker's request body size limit entirely. Password is passed as a query
// param (not a header) since tus-js-client reuses the same headers for the
// follow-up PATCH requests it sends straight to Stream's own endpoint.
async function handleStreamCreate(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.get('pw') !== env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const streamResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream?direct_user=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
      'Tus-Resumable': request.headers.get('Tus-Resumable') || '1.0.0',
      'Upload-Length': request.headers.get('Upload-Length') || '',
      'Upload-Metadata': request.headers.get('Upload-Metadata') || '',
    },
  });

  return new Response(null, {
    status: streamResponse.status,
    headers: {
      Location: streamResponse.headers.get('Location') || '',
      'stream-media-id': streamResponse.headers.get('stream-media-id') || '',
      'Access-Control-Expose-Headers': 'Location, stream-media-id',
    },
  });
}

// Called once the browser finishes uploading a video straight to Stream, to
// record which slot it belongs to.
async function handleStreamFinalize(request, env) {
  if (!isAuthorized(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = await request.json();
  const slot = parseInt(body.slot, 10);
  const uid = (body.uid || '').toString();
  const alt = (body.alt || '').toString().slice(0, 200);
  if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) {
    return jsonResponse({ error: 'Invalid slot number' }, 400);
  }
  if (!uid) return jsonResponse({ error: 'Missing video id' }, 400);

  const overrides = await readOverrides(env);
  await cleanupPreviousOverride(overrides[slot], env);

  const entry = { type: 'stream', uid, alt: alt || 'Saree from Mohammadi Saree House', uploadedAt: new Date().toISOString() };
  overrides[slot] = entry;
  await writeOverrides(overrides, env);

  return jsonResponse({ ok: true, slot, ...(await resolveStreamSlot(entry, env)) });
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
