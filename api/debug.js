const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

export default async function handler(req, res) {
  const tests = {};

  // Test 1: stable quote (we know this works)
  try {
    const r = await fetch(`${BASE}/stable/quote?symbol=SPY&apikey=${API_KEY}`);
    const d = await r.json();
    tests.stable_quote = { status: r.status, type: typeof d, isArray: Array.isArray(d), sample: JSON.stringify(d).slice(0, 200) };
  } catch (e) { tests.stable_quote = { error: e.message }; }

  // Test 2: stable historical-price-eod
  try {
    const r = await fetch(`${BASE}/stable/historical-price-eod?symbol=SPY&from=2026-01-01&to=2026-02-05&apikey=${API_KEY}`);
    const d = await r.json();
    tests.stable_historical = { status: r.status, type: typeof d, isArray: Array.isArray(d), keys: d && typeof d === 'object' && !Array.isArray(d) ? Object.keys(d) : null, length: Array.isArray(d) ? d.length : null, sample: JSON.stringify(d).slice(0, 300) };
  } catch (e) { tests.stable_historical = { error: e.message }; }

  // Test 3: legacy historical-price-full
  try {
    const r = await fetch(`${BASE}/api/v3/historical-price-full/SPY?from=2026-01-01&to=2026-02-05&apikey=${API_KEY}`);
    const d = await r.json();
    tests.legacy_historical = { status: r.status, type: typeof d, isArray: Array.isArray(d), keys: d && typeof d === 'object' && !Array.isArray(d) ? Object.keys(d) : null, length: Array.isArray(d) ? d.length : (d && d.historical ? d.historical.length : null), sample: JSON.stringify(d).slice(0, 300) };
  } catch (e) { tests.legacy_historical = { error: e.message }; }

  // Test 4: stable batch-exchange-quote
  try {
    const r = await fetch(`${BASE}/stable/batch-exchange-quote?exchange=NASDAQ&apikey=${API_KEY}`);
    const d = await r.json();
    tests.stable_batch_exchange = { status: r.status, type: typeof d, isArray: Array.isArray(d), length: Array.isArray(d) ? d.length : null, sample: JSON.stringify(d).slice(0, 200) };
  } catch (e) { tests.stable_batch_exchange = { error: e.message }; }

  // Test 5: legacy exchange quotes
  try {
    const r = await fetch(`${BASE}/api/v3/quotes/NASDAQ?apikey=${API_KEY}`);
    const d = await r.json();
    tests.legacy_exchange_quotes = { status: r.status, type: typeof d, isArray: Array.isArray(d), length: Array.isArray(d) ? d.length : null, sample: JSON.stringify(d).slice(0, 200) };
  } catch (e) { tests.legacy_exchange_quotes = { error: e.message }; }

  // Test 6: company-symbols-list
  try {
    const r = await fetch(`${BASE}/stable/company-symbols-list?apikey=${API_KEY}`);
    const d = await r.json();
    tests.symbols_list = { status: r.status, type: typeof d, isArray: Array.isArray(d), length: Array.isArray(d) ? d.length : null, sample: JSON.stringify(d).slice(0, 200) };
  } catch (e) { tests.symbols_list = { error: e.message }; }

  // Test 7: stable batch-quote with a few symbols
  try {
    const r = await fetch(`${BASE}/stable/batch-quote?symbols=SPY,QQQ,AAPL&apikey=${API_KEY}`);
    const d = await r.json();
    tests.stable_batch_quote = { status: r.status, type: typeof d, isArray: Array.isArray(d), length: Array.isArray(d) ? d.length : null, sample: JSON.stringify(d).slice(0, 200) };
  } catch (e) { tests.stable_batch_quote = { error: e.message }; }

  res.json(tests);
}
