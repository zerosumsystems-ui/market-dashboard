import { kvGet, kvEnabled } from './_lib/kv.js';

export default async function handler(req, res) {
  try {
    if (!kvEnabled()) {
      return res.json({ days: [] });
    }
    const history = (await kvGet('breadth_history')) || [];

    const days = history.slice(0, 20).map((day, i) => {
      // Rolling 5-day average of 4% ratio
      const s5 = history.slice(i, i + 5);
      const r5 = s5.length >= 5
        ? +(s5.reduce((sum, d) => sum + d.r4, 0) / 5).toFixed(2)
        : null;
      // Rolling 10-day average of 4% ratio
      const s10 = history.slice(i, i + 10);
      const r10 = s10.length >= 10
        ? +(s10.reduce((sum, d) => sum + d.r4, 0) / 10).toFixed(2)
        : null;
      return { ...day, r5, r10 };
    });

    res.json({ days });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
