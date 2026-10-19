/**
 * Proxies /api/aeronet/* → aeronet.gsfc.nasa.gov (see vercel.json rewrite).
 * External edge rewrites to NASA often fail; Node fetch from serverless is more reliable.
 */
export default async function handler(req, res) {
  let pathPart = req.query.path;
  if (Array.isArray(pathPart)) pathPart = pathPart.join('/');
  if (!pathPart) {
    res.status(400).json({ error: 'Missing path' });
    return;
  }

  const target = `https://aeronet.gsfc.nasa.gov/${pathPart}`;

  try {
    const up = await fetch(target, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: { 'User-Agent': 'aaqe-tv-display/1.0' },
    });

    const ct = up.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');

    if (req.method === 'HEAD') {
      res.status(up.status).end();
      return;
    }

    const body = Buffer.from(await up.arrayBuffer());
    res.status(up.status).send(body);
  } catch (err) {
    res.status(502).json({ error: err?.message || 'NASA proxy failed' });
  }
}
