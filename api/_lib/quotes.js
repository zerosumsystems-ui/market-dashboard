import { getRange, px } from './databento.js';

export async function getAllQuotes() {
  // Fetch last 5 calendar days to ensure at least 2 trading days
  const end = new Date(); end.setDate(end.getDate() + 1);
  const start = new Date(); start.setDate(start.getDate() - 5);

  const records = await getRange({
    schema: 'ohlcv-1d',
    symbols: 'ALL_SYMBOLS',
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  });

  // Group by symbol
  const bySymbol = {};
  for (const r of records) {
    if (!r.symbol) continue;
    if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
    bySymbol[r.symbol].push(r);
  }

  // Build quote objects from latest 2 trading days per symbol
  const quotes = [];
  for (const [symbol, bars] of Object.entries(bySymbol)) {
    bars.sort((a, b) => (a.hd.ts_event > b.hd.ts_event ? 1 : -1));
    const latest = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : null;

    const price = px(latest.close);
    const open = px(latest.open);
    const high = px(latest.high);
    const low = px(latest.low);
    const volume = latest.volume ?? 0;
    const previousClose = prev ? px(prev.close) : 0;
    const change = previousClose ? +(price - previousClose).toFixed(4) : 0;
    const changePercentage = previousClose > 0 ? +((change / previousClose) * 100).toFixed(2) : 0;

    if (price <= 0) continue;

    quotes.push({
      symbol, price, open,
      dayHigh: high, dayLow: low,
      volume, previousClose, change, changePercentage,
    });
  }

  return quotes;
}

/**
 * Enhanced quotes with volume history for screener.
 * Fetches a longer lookback to compute relative volume and volume-high signals.
 */
export async function getScreenerQuotes(lookbackCalDays = 90) {
  const end = new Date(); end.setDate(end.getDate() + 1);
  const start = new Date(); start.setDate(start.getDate() - lookbackCalDays);

  const records = await getRange({
    schema: 'ohlcv-1d',
    symbols: 'ALL_SYMBOLS',
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  });

  // Group by symbol, keeping full history
  const bySymbol = {};
  for (const r of records) {
    if (!r.symbol) continue;
    if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
    bySymbol[r.symbol].push(r);
  }

  const quotes = [];
  for (const [symbol, bars] of Object.entries(bySymbol)) {
    bars.sort((a, b) => (a.hd.ts_event > b.hd.ts_event ? 1 : -1));
    if (bars.length < 2) continue;

    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];

    const price = px(latest.close);
    const open = px(latest.open);
    const high = px(latest.high);
    const low = px(latest.low);
    const volume = latest.volume ?? 0;
    const previousClose = px(prev.close);
    const change = previousClose ? +(price - previousClose).toFixed(4) : 0;
    const changePercentage = previousClose > 0 ? +((change / previousClose) * 100).toFixed(2) : 0;

    if (price <= 0 || !volume) continue;

    // Volume metrics from historical bars (exclude today)
    const histVols = [];
    for (let i = 0; i < bars.length - 1; i++) {
      const v = bars[i].volume ?? 0;
      if (v > 0) histVols.push(v);
    }
    const avgVol = histVols.length > 0 ? histVols.reduce((s, v) => s + v, 0) / histVols.length : 0;
    const relVol = avgVol > 0 ? +(volume / avgVol).toFixed(2) : 0;
    const maxHistVol = histVols.length > 0 ? Math.max(...histVols) : 0;
    const isVolHigh = volume > maxHistVol && histVols.length >= 5;
    const volPerc = maxHistVol > 0 ? Math.round((volume / maxHistVol) * 100) : 0;

    quotes.push({
      symbol, price, open,
      dayHigh: high, dayLow: low,
      volume, previousClose, change, changePercentage,
      avgVol: Math.round(avgVol), relVol,
      volDays: histVols.length, isVolHigh, volPerc,
    });
  }

  return quotes;
}
