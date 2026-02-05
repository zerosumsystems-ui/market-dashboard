const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

export default async function handler(req, res) {
  try {
    const r = await fetch(`${BASE}/stable/batch-quote?symbols=SPY,QQQ,DIA,IWM&apikey=${API_KEY}`);
    const data = await r.json();
    const names = { SPY:"S&P 500 (SPY)", QQQ:"NASDAQ 100 (QQQ)", DIA:"DOW 30 (DIA)", IWM:"Russell 2000 (IWM)" };
    res.json((data||[]).map(q=>({
      ticker:q.symbol, name:names[q.symbol]||q.symbol,
      price:q.price??0, open:q.open??0, high:q.dayHigh??0, low:q.dayLow??0,
      volume:q.volume??0, change:q.change??0, changePerc:q.changesPercentage??0, prevClose:q.previousClose??0
    })));
  } catch(e) { res.status(500).json({error:e.message}); }
}
