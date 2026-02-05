const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

export function kvEnabled() {
  return !!(KV_URL && KV_TOKEN);
}

async function kvCommand(...args) {
  if (!kvEnabled()) return null;
  try {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    const data = await r.json();
    return data.result;
  } catch { return null; }
}

export async function kvGet(key) {
  const val = await kvCommand('GET', key);
  if (val == null) return null;
  try { return JSON.parse(val); } catch { return val; }
}

export async function kvSet(key, value) {
  return kvCommand('SET', key, JSON.stringify(value));
}
