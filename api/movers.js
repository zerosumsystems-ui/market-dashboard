import { getAllQuotes } from './_lib/quotes.js';

export default async function handler(req, res) {
  try {
    const dir = req.query.dir === "losers" ? "losers" : "gainers";
    const quotes = await getAllQuotes();

    // Filter: price >= $2 and has volume
    let filtered = quotes.filter(q => q.price >= 2 && q.volume > 0);

    // Sort by change %
    if (dir === "gainers") {
      filtered.sort((a, b) => b.changePercentage - a.changePercentage);
    } else {
      filtered.sort((a, b) => a.changePercentage - b.changePercentage);
    }

    const top = filtered.slice(0, 15).map(q => ({
      ticker: q.symbol,
      price: q.price,
      change: q.change,
      changePerc: q.changePercentage,
      volume: q.volume,
    }));

    res.json(top);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
