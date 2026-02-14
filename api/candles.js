import { getRange, px } from './_lib/databento.js';

export default async function handler(req, res) {
  try {
    const tickers = (req.query.tickers || "SPY").split(",").slice(0, 9);
    const days = parseInt(req.query.days) || 90;
    const ago = new Date(); ago.setDate(ago.getDate() - days - 20);
    const end = new Date(); end.setDate(end.getDate() + 1);

    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: tickers,
      start: ago.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });

    // Group by symbol
    const bySymbol = {};
    for (const r of records) {
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
      bySymbol[r.symbol].push(r);
    }

    const results = tickers.map(tk => {
      const bars = (bySymbol[tk] || []).sort((a, b) =>
        a.hd.ts_event > b.hd.ts_event ? 1 : -1
      );
      return {
        ticker: tk,
        candles: bars.slice(-days).map(r => ({
          t: Math.floor(Number(r.hd.ts_event) / 1e6),
          o: px(r.open),
          h: px(r.high),
          l: px(r.low),
          c: px(r.close),
          v: r.volume ?? 0,
        }))
      };
    });

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
