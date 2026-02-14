import { getRange, px } from './_lib/databento.js';

export default async function handler(req, res) {
  try {
    const tk = req.query.ticker || "SPY";
    const ago = new Date(); ago.setDate(ago.getDate() - 50);
    const end = new Date(); end.setDate(end.getDate() + 1);

    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: tk,
      start: ago.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });

    records.sort((a, b) => (a.hd.ts_event > b.hd.ts_event ? 1 : -1));
    res.json({ ticker: tk, results: records.map(r => ({ date: r.date, close: px(r.close) })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
