const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

export default async function handler(req, res) {
  try {
    const dir = req.query.dir === "losers" ? "biggest-losers" : "biggest-gainers";
    const r = await fetch(`${BASE}/stable/${dir}?apikey=${API_KEY}`);
    const data = await r.json();
    const filtered = (data||[])
      .filter(q => {
        const price = q.price ?? 0;
        return price >= 2;
      })
      .slice(0, 15)
      .map(q => {
        const prevClose = q.previousClose ?? 0;
        return {
          ticker: q.symbol,
          price: q.price ?? 0,
          change: q.change ?? 0,
          changePerc: q.changesPercentage ?? (prevClose > 0 ? +((q.change??0)/prevClose*100).toFixed(2) : 0),
          volume: q.volume ?? 0
        };
      });
    res.json(filtered);
  } catch(e) { res.status(500).json({error:e.message}); }
}
