export const config = {
  runtime: "nodejs",
  dynamic: "force-dynamic"
};
const UPSTREAM = 'https://api.instabox.sh/v1';

export default async function handler(req, res) {
  try {
    const raw = req.query.path;
    const segs = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const target = segs.join('/');

    const apiKey = process.env.INSTABOX_API_KEY || req.headers['x-api-key'];
    if (!apiKey) {
      res.status(400).json({
        error: { code: 'NO_API_KEY', message: '缺少 API Key：请在 Vercel 环境变量配置 INSTABOX_API_KEY，或在请求头带 x-api-key' },
      });
      return;
    }

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
      else qs.append(k, String(v));
    }
    const qstr = qs.toString();
    const url = `${UPSTREAM}/${target}${qstr ? `?${qstr}` : ''}`;

    const init = {
      method: req.method,
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    };
    if (!['GET', 'HEAD'].includes(req.method) && req.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body);
    }

    const r = await fetch(url, init);
    const ct = r.headers.get('content-type') || '';
    res.status(r.status);
    if (ct.includes('application/json')) {
      res.json(await r.json());
    } else {
      res.send(await r.text());
    }
  } catch (e) {
    res.status(502).json({
      error: { code: 'PROXY_ERROR', message: String((e && e.message) || e) },
    });
  }
}