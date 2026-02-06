const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

const CRYPTO_SYMBOLS = [
  { symbol: "BTCUSD", name: "Bitcoin" },
  { symbol: "ETHUSD", name: "Ethereum" },
  { symbol: "BNBUSD", name: "BNB" },
  { symbol: "XRPUSD", name: "XRP" },
  { symbol: "SOLUSD", name: "Solana" },
  { symbol: "ADAUSD", name: "Cardano" },
  { symbol: "DOGEUSD", name: "Dogecoin" },
  { symbol: "DOTUSD", name: "Polkadot" },
  { symbol: "MATICUSD", name: "Polygon" },
  { symbol: "LINKUSD", name: "Chainlink" },
  { symbol: "AVAXUSD", name: "Avalanche" },
  { symbol: "LTCUSD", name: "Litecoin" },
  { symbol: "UNIUSD", name: "Uniswap" },
  { symbol: "ATOMUSD", name: "Cosmos" },
  { symbol: "XLMUSD", name: "Stellar" }
];

export default async function handler(req, res) {
  try {
    const symbols = CRYPTO_SYMBOLS.map(c => c.symbol).join(",");
    const data = await fetchJSON(`${BASE}/stable/batch-quote?symbols=${symbols}&apikey=${API_KEY}`);

    if (Array.isArray(data) && data.length > 0) {
      const quoteMap = {};
      for (const q of data) { if (q.symbol) quoteMap[q.symbol] = q; }

      const result = CRYPTO_SYMBOLS.map(c => {
        const q = quoteMap[c.symbol];
        if (!q) return null;
        return {
          symbol: c.symbol,
          name: c.name,
          price: q.price ?? 0,
          change: q.change ?? 0,
          changePerc: q.changePercentage ?? q.changesPercentage ?? 0,
          high: q.dayHigh ?? 0,
          low: q.dayLow ?? 0,
          volume: q.volume ?? 0,
          marketCap: q.marketCap ?? 0,
          prevClose: q.previousClose ?? 0
        };
      }).filter(Boolean);

      return res.json(result);
    }

    // Fallback: try cryptocurrency endpoint
    const cryptoData = await fetchJSON(`${BASE}/stable/cryptocurrency?apikey=${API_KEY}`);
    if (Array.isArray(cryptoData)) {
      const cryptoMap = {};
      for (const c of cryptoData) {
        const sym = (c.symbol || '').replace('/', '');
        if (sym) cryptoMap[sym] = c;
      }

      const result = CRYPTO_SYMBOLS.map(c => {
        const q = cryptoMap[c.symbol];
        if (!q) return null;
        return {
          symbol: c.symbol,
          name: c.name,
          price: q.price ?? 0,
          change: q.change ?? q.changes ?? 0,
          changePerc: q.changesPercentage ?? 0,
          high: q.dayHigh ?? q.high ?? 0,
          low: q.dayLow ?? q.low ?? 0,
          volume: q.volume ?? 0,
          marketCap: q.marketCap ?? 0,
          prevClose: q.previousClose ?? 0
        };
      }).filter(Boolean);

      return res.json(result);
    }

    res.json([]);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
