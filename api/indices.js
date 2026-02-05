const API_KEY = process.env.POLYGON_API_KEY;

export default async function handler(req, res) {
  try {
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=SPY,QQQ,DIA,IWM&apiKey=${API_KEY}`);
    const data = await r.json();
    const names = { SPY:"S&P 500 (SPY)", QQQ:"NASDAQ 100 (QQQ)", DIA:"DOW 30 (DIA)", IWM:"Russell 2000 (IWM)" };
    res.json((data.tickers||[]).map(t=>({
      ticker:t.ticker, name:names[t.ticker]||t.ticker,
      price:t.day?.c??t.lastTrade?.p??0, open:t.day?.o??0, high:t.day?.h??0, low:t.day?.l??0,
      volume:t.day?.v??0, change:t.todaysChange??0, changePerc:t.todaysChangePerc??0, prevClose:t.prevDay?.c??0
    })));
  } catch(e) { res.status(500).json({error:e.message}); }
}
