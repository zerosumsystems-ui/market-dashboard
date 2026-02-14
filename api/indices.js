import { getRange, px } from './_lib/databento.js';

const ETFS = ["SPY", "QQQ", "DIA", "IWM"];
const NAMES = { SPY: "S&P 500 (SPY)", QQQ: "NASDAQ 100 (QQQ)", DIA: "DOW 30 (DIA)", IWM: "Russell 2000 (IWM)" };

export default async function handler(req, res) {
  try {
    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = new Date(); start.setDate(start.getDate() - 5);

    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: ETFS,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });

    // Group by symbol, sort by date
    const bySymbol = {};
    for (const r of records) {
      if (!r.symbol) continue;
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
      bySymbol[r.symbol].push(r);
    }

    const quotes = ETFS.map(sym => {
      const bars = (bySymbol[sym] || []).sort((a, b) =>
        a.hd.ts_event > b.hd.ts_event ? 1 : -1
      );
      if (!bars.length) return null;
      const latest = bars[bars.length - 1];
      const prev = bars.length > 1 ? bars[bars.length - 2] : null;
      const price = px(latest.close);
      const prevClose = prev ? px(prev.close) : 0;
      const change = prevClose ? +(price - prevClose).toFixed(2) : 0;
      const pct = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;
      return {
        ticker: sym, name: NAMES[sym] || sym,
        price, open: px(latest.open), high: px(latest.high), low: px(latest.low),
        volume: latest.volume ?? 0, change, changePerc: pct, prevClose
      };
    }).filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json(quotes);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
