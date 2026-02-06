const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    // Try general stock news first
    let articles = await fetchJSON(`${BASE}/stable/stock-news?limit=${limit}&apikey=${API_KEY}`);
    if (Array.isArray(articles) && articles.length > 0) {
      return res.json(articles.map(a => ({
        title: a.title || '',
        text: a.text || '',
        url: a.url || '',
        image: a.image || '',
        source: a.site || a.source || '',
        date: a.publishedDate || a.date || '',
        ticker: a.symbol || ''
      })));
    }

    // Fallback to FMP articles
    articles = await fetchJSON(`${BASE}/stable/fmp-articles?limit=${limit}&apikey=${API_KEY}`);
    const list = Array.isArray(articles) ? articles : (articles?.content || []);
    res.json(list.map(a => ({
      title: a.title || '',
      text: a.content || a.text || '',
      url: a.link || a.url || '',
      image: a.image || '',
      source: a.site || a.source || 'FMP',
      date: a.date || a.publishedDate || '',
      ticker: a.tickers || ''
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
}
