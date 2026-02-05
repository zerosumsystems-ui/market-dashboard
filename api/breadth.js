import { getAllQuotes } from './_lib/quotes.js';
import { kvGet, kvSet, kvEnabled } from './_lib/kv.js';

export default async function handler(req, res) {
  try {
    const tickers = await getAllQuotes();
    const bk = { d10: 0, d5: 0, d2: 0, d0: 0, u0: 0, u2: 0, u5: 0, u10: 0 };
    let tot = 0, u4 = 0, d4 = 0, u8 = 0, d8 = 0;
    for (const q of tickers) {
      const change = q.change ?? 0;
      const prevClose = q.previousClose ?? (q.price != null && change ? q.price - change : 0);
      const p = q.changePercentage ?? q.changesPercentage ?? (prevClose > 0 ? change / prevClose * 100 : null);
      if (p == null || !q.volume) continue;
      tot++;
      if (p >= 4) u4++;
      if (p <= -4) d4++;
      if (p >= 8) u8++;
      if (p <= -8) d8++;
      if (p <= -10) bk.d10++;
      else if (p <= -5) bk.d5++;
      else if (p <= -2) bk.d2++;
      else if (p < 0) bk.d0++;
      else if (p < 2) bk.u0++;
      else if (p < 5) bk.u2++;
      else if (p < 10) bk.u5++;
      else bk.u10++;
    }
    const adv = bk.u0 + bk.u2 + bk.u5 + bk.u10;
    const dec = bk.d0 + bk.d2 + bk.d5 + bk.d10;
    const etOpts = { timeZone: 'America/New_York' };
    const dateLabel = new Date().toLocaleDateString('en-US', etOpts);
    const isoDate = new Date().toLocaleDateString('en-CA', etOpts);

    const snapshot = {
      date: isoDate, dateLabel,
      universe: tot, u4, d4, u8, d8,
      r4: d4 > 0 ? +(u4 / d4).toFixed(2) : u4 > 0 ? 99 : 0,
      r8: d8 > 0 ? +(u8 / d8).toFixed(2) : u8 > 0 ? 99 : 0,
      buckets: bk, adv, dec
    };

    // Store daily snapshot in KV for historical tracking
    if (kvEnabled() && tot > 50) {
      try {
        let history = (await kvGet('breadth_history')) || [];
        history = history.filter(h => h.date !== isoDate);
        history.unshift(snapshot);
        history = history.slice(0, 30);
        await kvSet('breadth_history', history);
      } catch {}
    }

    res.json(snapshot);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
