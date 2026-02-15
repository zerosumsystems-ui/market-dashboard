import { getRange, px } from './_lib/databento.js';

export default async function handler(req, res) {
  try {
    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = new Date(); start.setDate(start.getDate() - 5);

    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: ['SPY'],
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });

    res.json({
      count: records.length,
      sample: records.slice(0, 3).map(r => ({
        symbol: r.symbol,
        date: r.date,
        close: px(r.close),
        volume: r.volume,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
