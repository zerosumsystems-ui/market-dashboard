import { getRange, px } from './_lib/databento.js';

export default async function handler(req, res) {
  const results = {};

  // Test 1: Single symbol (simplest case)
  try {
    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = new Date(); start.setDate(start.getDate() - 5);
    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: ['SPY'],
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
    results.singleSymbol = {
      count: records.length,
      sample: records.slice(0, 2).map(r => ({
        symbol: r.symbol, date: r.date,
        close: px(r.close), volume: r.volume,
      })),
    };
  } catch (e) { results.singleSymbol = { error: e.message }; }

  // Test 2: Multi-symbol (like indices.js)
  try {
    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = new Date(); start.setDate(start.getDate() - 5);
    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: ['SPY', 'QQQ', 'DIA', 'IWM'],
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
    const bySymbol = {};
    for (const r of records) {
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
      bySymbol[r.symbol].push(r);
    }
    results.multiSymbol = {
      count: records.length,
      symbols: Object.keys(bySymbol),
      perSymbol: Object.fromEntries(
        Object.entries(bySymbol).map(([s, recs]) => [s, recs.length])
      ),
    };
  } catch (e) { results.multiSymbol = { error: e.message }; }

  // Test 3: ALL_SYMBOLS (like breadth/movers/screener)
  try {
    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = new Date(); start.setDate(start.getDate() - 3);
    const records = await getRange({
      schema: 'ohlcv-1d',
      symbols: 'ALL_SYMBOLS',
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
    const uniqueSymbols = [...new Set(records.map(r => r.symbol))];
    results.allSymbols = {
      count: records.length,
      uniqueSymbols: uniqueSymbols.length,
      sampleSymbols: uniqueSymbols.slice(0, 10),
      sample: records.slice(0, 2).map(r => ({
        symbol: r.symbol, date: r.date,
        close: px(r.close), volume: r.volume,
      })),
    };
  } catch (e) { results.allSymbols = { error: e.message }; }

  res.json(results);
}
