const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

const FOREX_PAIRS = [
  { symbol: "EURUSD", name: "EUR/USD", group: "Major" },
  { symbol: "GBPUSD", name: "GBP/USD", group: "Major" },
  { symbol: "USDJPY", name: "USD/JPY", group: "Major" },
  { symbol: "USDCHF", name: "USD/CHF", group: "Major" },
  { symbol: "AUDUSD", name: "AUD/USD", group: "Major" },
  { symbol: "USDCAD", name: "USD/CAD", group: "Major" },
  { symbol: "NZDUSD", name: "NZD/USD", group: "Major" },
  { symbol: "EURGBP", name: "EUR/GBP", group: "Cross" },
  { symbol: "EURJPY", name: "EUR/JPY", group: "Cross" },
  { symbol: "GBPJPY", name: "GBP/JPY", group: "Cross" },
  { symbol: "EURCHF", name: "EUR/CHF", group: "Cross" },
  { symbol: "AUDJPY", name: "AUD/JPY", group: "Cross" },
  { symbol: "USDHKD", name: "USD/HKD", group: "Exotic" },
  { symbol: "USDSGD", name: "USD/SGD", group: "Exotic" },
  { symbol: "USDMXN", name: "USD/MXN", group: "Exotic" },
  { symbol: "USDZAR", name: "USD/ZAR", group: "Exotic" },
  { symbol: "USDTRY", name: "USD/TRY", group: "Exotic" },
  { symbol: "USDCNH", name: "USD/CNH", group: "Exotic" }
];

export default async function handler(req, res) {
  try {
    // Try batch quote for forex
    const symbols = FOREX_PAIRS.map(f => f.symbol).join(",");
    const data = await fetchJSON(`${BASE}/stable/batch-quote?symbols=${symbols}&apikey=${API_KEY}`);

    if (Array.isArray(data) && data.length > 0) {
      const quoteMap = {};
      for (const q of data) { if (q.symbol) quoteMap[q.symbol] = q; }

      const result = FOREX_PAIRS.map(f => {
        const q = quoteMap[f.symbol];
        if (!q) return null;
        return {
          symbol: f.symbol,
          name: f.name,
          group: f.group,
          price: q.price ?? 0,
          change: q.change ?? 0,
          changePerc: q.changePercentage ?? q.changesPercentage ?? 0,
          high: q.dayHigh ?? 0,
          low: q.dayLow ?? 0,
          prevClose: q.previousClose ?? 0
        };
      }).filter(Boolean);

      return res.json(result);
    }

    // Fallback: try /stable/forex endpoint
    const fxData = await fetchJSON(`${BASE}/stable/forex?apikey=${API_KEY}`);
    if (Array.isArray(fxData)) {
      const fxMap = {};
      for (const f of fxData) {
        const sym = (f.ticker || f.symbol || '').replace('/', '');
        if (sym) fxMap[sym] = f;
      }

      const result = FOREX_PAIRS.map(f => {
        const q = fxMap[f.symbol];
        if (!q) return null;
        const prevClose = q.previousClose ?? (q.price && q.change ? q.price - q.change : 0);
        return {
          symbol: f.symbol,
          name: f.name,
          group: f.group,
          price: q.price ?? q.ask ?? 0,
          change: q.change ?? q.changes ?? 0,
          changePerc: q.changesPercentage ?? (prevClose > 0 ? ((q.change ?? 0) / prevClose * 100) : 0),
          high: q.dayHigh ?? q.high ?? 0,
          low: q.dayLow ?? q.low ?? 0,
          prevClose
        };
      }).filter(Boolean);

      return res.json(result);
    }

    res.json([]);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
