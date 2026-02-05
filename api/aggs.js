const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

export default async function handler(req, res) {
  try {
    const tk = req.query.ticker || "SPY";
    const ago = new Date(); ago.setDate(ago.getDate()-50);
    const from = ago.toISOString().slice(0,10);
    const to = new Date().toISOString().slice(0,10);
    const r = await fetch(`${BASE}/stable/historical-price-eod/full?symbol=${tk}&from=${from}&to=${to}&apikey=${API_KEY}`);
    const data = await r.json();
    const hist = (data.historical||[]).slice().reverse();
    res.json({ticker:tk, results:hist.map(h=>({date:h.date, close:h.close}))});
  } catch(e) { res.status(500).json({error:e.message}); }
}
