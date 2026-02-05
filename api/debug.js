const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function test(url) {
  try {
    const r = await fetch(url);
    const text = await r.text();
    let d; try { d = JSON.parse(text); } catch { d = text.slice(0, 200); }
    return {
      status: r.status, ok: r.ok,
      isArray: Array.isArray(d),
      length: Array.isArray(d) ? d.length : null,
      keys: d && typeof d === 'object' && !Array.isArray(d) ? Object.keys(d).slice(0, 10) : null,
      sample: JSON.stringify(d).slice(0, 300)
    };
  } catch (e) { return { error: e.message }; }
}

export default async function handler(req, res) {
  const t = {};

  // Screener (might give us stock symbols)
  t.company_screener = await test(`${BASE}/stable/company-screener?exchange=NYSE,NASDAQ&isActivelyTrading=true&volumeMoreThan=10000&limit=5&apikey=${API_KEY}`);

  // Index constituents
  t.sp500_constituent = await test(`${BASE}/stable/sp500-constituent?apikey=${API_KEY}`);
  t.nasdaq_constituent = await test(`${BASE}/stable/nasdaq-constituent?apikey=${API_KEY}`);

  // Most actives
  t.most_actives = await test(`${BASE}/stable/most-actives?apikey=${API_KEY}`);

  // Stock list
  t.stock_list = await test(`${BASE}/stable/stock-list?apikey=${API_KEY}`);

  // Historical variants
  t.hist_eod = await test(`${BASE}/stable/historical-price-eod?symbol=SPY&from=2026-01-01&to=2026-02-05&apikey=${API_KEY}`);
  t.hist_eod_light = await test(`${BASE}/stable/historical-price-eod/light?symbol=SPY&from=2026-01-01&to=2026-02-05&apikey=${API_KEY}`);
  t.hist_eod_full = await test(`${BASE}/stable/historical-price-eod/full?symbol=SPY&from=2026-01-01&to=2026-02-05&apikey=${API_KEY}`);
  t.hist_chart_daily = await test(`${BASE}/stable/historical-chart/daily?symbol=SPY&from=2026-01-01&to=2026-02-05&apikey=${API_KEY}`);
  t.hist_chart_1day = await test(`${BASE}/stable/historical-chart/1day?symbol=SPY&apikey=${API_KEY}`);

  // Available traded list
  t.available_traded = await test(`${BASE}/stable/available-traded/list?apikey=${API_KEY}`);

  // Sector performance
  t.sector_perf = await test(`${BASE}/stable/sector-performance?apikey=${API_KEY}`);

  res.json(t);
}
