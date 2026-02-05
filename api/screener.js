const API_KEY = process.env.POLYGON_API_KEY;
const BASE = "https://api.polygon.io";

export default async function handler(req, res) {
  try {
    const minPrice = parseFloat(req.query.minPrice) || 2;
    const maxPrice = parseFloat(req.query.maxPrice) || 999999;
    const minVol = parseFloat(req.query.minVol) || 50000;
    const minChange = parseFloat(req.query.minChange) || -999;
    const maxChange = parseFloat(req.query.maxChange) || 999;
    const sort = req.query.sort || "changeDesc";
    const limit = Math.min(parseInt(req.query.limit) || 21, 30);

    const r = await fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${API_KEY}`);
    const data = await r.json();
    let tickers = (data.tickers || []).filter(t => {
      const price = t.day?.c ?? t.lastTrade?.p ?? 0;
      const vol = t.day?.v ?? 0;
      const chg = t.todaysChangePerc ?? 0;
      return price >= minPrice && price <= maxPrice && vol >= minVol && chg >= minChange && chg <= maxChange;
    });

    if (sort === "changeDesc") tickers.sort((a, b) => (b.todaysChangePerc || 0) - (a.todaysChangePerc || 0));
    else if (sort === "changeAsc") tickers.sort((a, b) => (a.todaysChangePerc || 0) - (b.todaysChangePerc || 0));
    else if (sort === "volumeDesc") tickers.sort((a, b) => (b.day?.v || 0) - (a.day?.v || 0));

    const selected = tickers.slice(0, limit).map(t => ({
      ticker: t.ticker,
      price: t.day?.c ?? t.lastTrade?.p ?? 0,
      change: t.todaysChange ?? 0,
      changePerc: t.todaysChangePerc ?? 0,
      volume: t.day?.v ?? 0,
      open: t.day?.o ?? 0,
      high: t.day?.h ?? 0,
      low: t.day?.l ?? 0
    }));

    res.json({ count: selected.length, total: tickers.length, tickers: selected });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
