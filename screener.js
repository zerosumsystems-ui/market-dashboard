// Screener module - loaded by index.html
const SCREENER = {
  filters: { minPrice:2, maxPrice:999999, minVol:50000, minChange:-999, maxChange:999, sort:'changeDesc', limit:21 },
  tickers: [],
  
  init() {
    document.getElementById('scrFilterToggle').addEventListener('click', () => {
      const p = document.getElementById('scrFilterPanel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
      document.getElementById('scrFilterToggle').textContent = p.style.display === 'none' ? 'SHOW FILTERS' : 'HIDE FILTERS';
    });
    document.getElementById('scrApply').addEventListener('click', () => this.applyAndLoad());
    document.getElementById('scrReset').addEventListener('click', () => this.resetFilters());
  },

  applyAndLoad() {
    this.filters.minPrice = parseFloat(document.getElementById('fMinPrice').value) || 0;
    this.filters.maxPrice = parseFloat(document.getElementById('fMaxPrice').value) || 999999;
    this.filters.minVol = parseFloat(document.getElementById('fMinVol').value) || 0;
    this.filters.minChange = parseFloat(document.getElementById('fMinChg').value) || -999;
    this.filters.maxChange = parseFloat(document.getElementById('fMaxChg').value) || 999;
    this.filters.sort = document.getElementById('fSort').value;
    this.load();
  },

  resetFilters() {
    document.getElementById('fMinPrice').value = '2';
    document.getElementById('fMaxPrice').value = '';
    document.getElementById('fMinVol').value = '50000';
    document.getElementById('fMinChg').value = '';
    document.getElementById('fMaxChg').value = '';
    document.getElementById('fSort').value = 'changeDesc';
    this.filters = { minPrice:2, maxPrice:999999, minVol:50000, minChange:-999, maxChange:999, sort:'changeDesc', limit:21 };
    this.load();
  },

  async load() {
    const grid = document.getElementById('scrGrid');
    grid.innerHTML = Array(9).fill('<div class="scr-card shimmer" style="min-height:220px"></div>').join('');
    const f = this.filters;
    const q = `minPrice=${f.minPrice}&maxPrice=${f.maxPrice}&minVol=${f.minVol}&minChange=${f.minChange}&maxChange=${f.maxChange}&sort=${f.sort}&limit=${f.limit}`;
    try {
      const r = await fetch('/api/screener?' + q);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      document.getElementById('scrCount').textContent = d.count + ' of ' + d.total + ' matches';
      this.tickers = d.tickers;
      if (!d.tickers.length) { grid.innerHTML = '<div class="err" style="grid-column:1/-1">No stocks match your filters</div>'; return; }
      grid.innerHTML = d.tickers.map((t, i) => {
        const u = t.changePerc >= 0;
        return '<div class="scr-card" id="scr-' + i + '">' +
          '<div class="scr-head">' +
            '<span class="scr-tk">' + t.ticker + '</span>' +
            '<span class="scr-px">' + t.price.toFixed(2) + '</span>' +
          '</div>' +
          '<div class="scr-meta">' +
            '<span class="' + (u ? 'up-c' : 'dn-c') + '">' + (u ? '+' : '') + t.changePerc.toFixed(2) + '%</span>' +
            '<span class="scr-vol">Vol: ' + fmtVol(t.volume) + '</span>' +
          '</div>' +
          '<canvas id="candle-' + i + '" class="scr-canvas"></canvas>' +
        '</div>';
      }).join('');
      this.loadCandles(d.tickers.map(t => t.ticker));
    } catch (e) { grid.innerHTML = '<div class="err" style="grid-column:1/-1">' + e.message + '</div>'; }
  },

  async loadCandles(tickers) {
    try {
      const r = await fetch('/api/candles?tickers=' + tickers.join(',') + '&days=90');
      const data = await r.json();
      data.forEach((d, i) => { if (d.candles.length) this.drawCandles('candle-' + i, d.candles); });
    } catch (e) { console.error(e); }
  },

  drawCandles(id, candles) {
    const c = document.getElementById(id);
    if (!c) return;
    const ctx = c.getContext('2d');
    const dp = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dp; c.height = r.height * dp;
    ctx.scale(dp, dp);
    const w = r.width, h = r.height;
    const pad = { t: 5, b: 25, l: 5, r: 5 };
    const cw = (w - pad.l - pad.r) / candles.length;
    const allH = candles.map(c => c.h), allL = candles.map(c => c.l);
    const mn = Math.min(...allL), mx = Math.max(...allH);
    const rng = mx - mn || 1;
    const yScale = (v) => pad.t + (1 - (v - mn) / rng) * (h - pad.t - pad.b);

    // Volume bars
    const maxV = Math.max(...candles.map(c => c.v));
    candles.forEach((bar, i) => {
      const x = pad.l + i * cw;
      const vH = (bar.v / maxV) * 20;
      const up = bar.c >= bar.o;
      ctx.fillStyle = up ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
      ctx.fillRect(x + 1, h - pad.b, cw - 2, -vH);
    });

    // Candles
    candles.forEach((bar, i) => {
      const x = pad.l + i * cw;
      const cx = x + cw / 2;
      const up = bar.c >= bar.o;
      const color = up ? '#10b981' : '#ef4444';
      // Wick
      ctx.beginPath();
      ctx.moveTo(cx, yScale(bar.h));
      ctx.lineTo(cx, yScale(bar.l));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Body
      const oY = yScale(bar.o), cY = yScale(bar.c);
      const bodyH = Math.max(Math.abs(cY - oY), 1);
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, Math.min(oY, cY), Math.max(cw - 2, 1), bodyH);
    });

    // Date labels
    ctx.fillStyle = '#4f6484';
    ctx.font = '9px JetBrains Mono';
    const step = Math.floor(candles.length / 3);
    for (let i = step; i < candles.length; i += step) {
      const d = new Date(candles[i].t);
      const label = (d.getMonth() + 1) + '/' + d.getDate();
      const x = pad.l + i * cw;
      ctx.fillText(label, x - 10, h - 5);
    }
  }
};

function fmtVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v;
}
