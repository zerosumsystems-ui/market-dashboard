const API_KEY = process.env.POLYGON_API_KEY;

export default async function handler(req, res) {
  try {
    const dir = req.query.dir === "losers" ? "losers" : "gainers";
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/${dir}?apiKey=${API_KEY}`);
    const data = await r.json();
    const filtered = (data.tickers||[])
      .filter(t => {
        const price = t.day?.c ?? t.lastTrade?.p ?? 0;
        const volume = t.day?.v ?? 0;
        return price >= 2 && volume >= 50000;
      })
      .slice(0, 15)
      .map(t => ({
        ticker: t.ticker,
        price: t.day?.c ?? t.lastTrade?.p ?? 0,
        change: t.todaysChange ?? 0,
        changePerc: t.todaysChangePerc ?? 0,
        volume: t.day?.v ?? 0
      }));
    res.json(filtered);
  } catch(e) { res.status(500).json({error:e.message}); }
}
