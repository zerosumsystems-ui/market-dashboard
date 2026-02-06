const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

const COMMODITY_SYMBOLS = [
  { symbol: "GCUSD", name: "Gold", group: "Metals" },
  { symbol: "SIUSD", name: "Silver", group: "Metals" },
  { symbol: "PLUSD", name: "Platinum", group: "Metals" },
  { symbol: "HGUSD", name: "Copper", group: "Metals" },
  { symbol: "CLUSD", name: "Crude Oil WTI", group: "Energy" },
  { symbol: "BZUSD", name: "Brent Crude", group: "Energy" },
  { symbol: "NGUSD", name: "Natural Gas", group: "Energy" },
  { symbol: "RBUSD", name: "Gasoline", group: "Energy" },
  { symbol: "ZSUSD", name: "Soybeans", group: "Grains" },
  { symbol: "ZCUSD", name: "Corn", group: "Grains" },
  { symbol: "ZWUSD", name: "Wheat", group: "Grains" },
  { symbol: "KEUSD", name: "Coffee", group: "Softs" },
  { symbol: "CCUSD", name: "Cocoa", group: "Softs" },
  { symbol: "CTUSD", name: "Cotton", group: "Softs" },
  { symbol: "SBUSD", name: "Sugar", group: "Softs" },
  { symbol: "LCUSD", name: "Live Cattle", group: "Meats" },
  { symbol: "LHUSD", name: "Lean Hogs", group: "Meats" },
  { symbol: "ZBUSD", name: "30-Year T-Bond", group: "Bonds" },
  { symbol: "ZNUSD", name: "10-Year T-Note", group: "Bonds" }
];

export default async function handler(req, res) {
  try {
    const symbols = COMMODITY_SYMBOLS.map(f => f.symbol).join(",");
    const data = await fetchJSON(`${BASE}/stable/batch-quote?symbols=${symbols}&apikey=${API_KEY}`);

    if (!Array.isArray(data)) {
      // Fallback: try individual quotes
      const results = await Promise.allSettled(
        COMMODITY_SYMBOLS.map(f =>
          fetchJSON(`${BASE}/stable/quote?symbol=${f.symbol}&apikey=${API_KEY}`)
        )
      );
      const fallback = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          const q = Array.isArray(r.value) ? r.value[0] : r.value;
          if (q) {
            fallback.push({
              symbol: COMMODITY_SYMBOLS[i].symbol,
              name: COMMODITY_SYMBOLS[i].name,
              group: COMMODITY_SYMBOLS[i].group,
              price: q.price ?? 0,
              change: q.change ?? 0,
              changePerc: q.changePercentage ?? q.changesPercentage ?? 0,
              high: q.dayHigh ?? 0,
              low: q.dayLow ?? 0,
              prevClose: q.previousClose ?? 0
            });
          }
        }
      });
      return res.json(fallback);
    }

    const quoteMap = {};
    for (const q of data) { if (q.symbol) quoteMap[q.symbol] = q; }

    const result = COMMODITY_SYMBOLS.map(f => {
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

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
