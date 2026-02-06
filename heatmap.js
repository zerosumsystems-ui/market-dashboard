// Squarified Treemap Heatmap - Finviz-style S&P 500 map
const HEATMAP = {
  data: null,
  canvas: null,
  ctx: null,
  rects: [],
  tooltip: null,
  hoveredRect: null,

  init() {
    this.canvas = document.getElementById('heatmapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById('heatmapTooltip');
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
    window.addEventListener('resize', () => { if (this.data) this.render(); });
  },

  async load() {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '<canvas id="heatmapCanvas" style="width:100%;cursor:crosshair"></canvas><div id="heatmapTooltip" style="display:none;position:fixed;z-index:100;background:var(--bg-1);border:1px solid var(--border-l);border-radius:6px;padding:.6rem .8rem;font-family:JetBrains Mono,monospace;font-size:.65rem;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,.4)"></div>';
    this.canvas = document.getElementById('heatmapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById('heatmapTooltip');
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.hideTooltip());

    try {
      const r = await fetch('/api/heatmap');
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      this.data = d;
      this.render();
    } catch (e) {
      container.innerHTML = '<div class="err">' + e.message + '</div>';
    }
  },

  render() {
    if (!this.data || !this.canvas) return;
    const dp = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = Math.max(500, window.innerHeight - 200);
    this.canvas.style.height = h + 'px';
    this.canvas.width = w * dp;
    this.canvas.height = h * dp;
    this.ctx.scale(dp, dp);
    this.rects = [];

    const totalMcap = this.data.reduce((s, sec) => s + sec.totalMcap, 0);
    if (totalMcap === 0) return;

    // Layout sectors as rows
    this.layoutSectors(0, 0, w, h, this.data, totalMcap);
    this.drawAll(w, h);
  },

  layoutSectors(x, y, w, h, sectors, totalMcap) {
    const items = sectors.map(s => ({
      sector: s,
      value: s.totalMcap,
      fraction: s.totalMcap / totalMcap
    }));

    this.squarify(items, x, y, w, h, (item, rx, ry, rw, rh) => {
      // Draw sector background
      this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
      this.ctx.fillRect(rx, ry, rw, rh);

      // Layout stocks within sector
      const sectorMcap = item.sector.totalMcap;
      const stocks = item.sector.stocks.map(s => ({
        stock: s,
        value: s.mcap,
        fraction: s.mcap / sectorMcap
      }));

      const pad = 1;
      this.squarify(stocks, rx + pad, ry + pad, rw - pad * 2, rh - pad * 2, (stockItem, sx, sy, sw, sh) => {
        this.rects.push({
          x: sx, y: sy, w: sw, h: sh,
          stock: stockItem.stock
        });
      });
    });
  },

  squarify(items, x, y, w, h, callback) {
    if (items.length === 0) return;
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return;

    const sorted = [...items].sort((a, b) => b.value - a.value);
    let remaining = [...sorted];
    let cx = x, cy = y, cw = w, ch = h;

    while (remaining.length > 0) {
      const isWide = cw >= ch;
      const side = isWide ? ch : cw;
      const remainingTotal = remaining.reduce((s, i) => s + i.value, 0);
      const areaScale = (cw * ch) / remainingTotal;

      let row = [remaining[0]];
      let rowTotal = remaining[0].value;
      let bestRatio = this.worstRatio(row, rowTotal, side, areaScale);

      for (let i = 1; i < remaining.length; i++) {
        const next = remaining[i];
        const newTotal = rowTotal + next.value;
        const newRow = [...row, next];
        const newRatio = this.worstRatio(newRow, newTotal, side, areaScale);

        if (newRatio <= bestRatio) {
          row = newRow;
          rowTotal = newTotal;
          bestRatio = newRatio;
        } else {
          break;
        }
      }

      // Place row
      const rowArea = rowTotal * areaScale;
      const rowSize = rowArea / side;

      let offset = 0;
      for (const item of row) {
        const itemSize = (item.value * areaScale) / rowSize;
        if (isWide) {
          callback(item, cx, cy + offset, rowSize, itemSize);
          offset += itemSize;
        } else {
          callback(item, cx + offset, cy, itemSize, rowSize);
          offset += itemSize;
        }
      }

      if (isWide) {
        cx += rowSize;
        cw -= rowSize;
      } else {
        cy += rowSize;
        ch -= rowSize;
      }

      remaining = remaining.slice(row.length);
    }
  },

  worstRatio(row, total, side, areaScale) {
    const rowArea = total * areaScale;
    const rowSize = rowArea / side;
    let worst = 0;
    for (const item of row) {
      const itemSize = (item.value * areaScale) / rowSize;
      const ratio = Math.max(rowSize / itemSize, itemSize / rowSize);
      if (ratio > worst) worst = ratio;
    }
    return worst;
  },

  getColor(change) {
    if (change >= 3) return '#047857';
    if (change >= 2) return '#059669';
    if (change >= 1) return '#10b981';
    if (change >= 0.5) return '#34d399';
    if (change >= 0) return '#1a3a2a';
    if (change >= -0.5) return '#3a1a1a';
    if (change >= -1) return '#f87171';
    if (change >= -2) return '#ef4444';
    if (change >= -3) return '#dc2626';
    return '#991b1b';
  },

  drawAll(w, h) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    for (const r of this.rects) {
      const stock = r.stock;
      const color = this.getColor(stock.change);

      // Fill rectangle
      ctx.fillStyle = color;
      ctx.fillRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

      // Border
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

      // Labels
      if (r.w > 30 && r.h > 20) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxFontTicker = Math.min(r.w / 4, r.h / 3, 16);
        const maxFontChange = Math.min(r.w / 5, r.h / 4, 12);

        if (maxFontTicker >= 7) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + Math.max(7, maxFontTicker) + 'px JetBrains Mono';
          ctx.fillText(stock.ticker, r.x + r.w / 2, r.y + r.h / 2 - maxFontChange * 0.5);

          if (r.h > 30 && maxFontChange >= 6) {
            ctx.font = Math.max(6, maxFontChange) + 'px JetBrains Mono';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            const sign = stock.change >= 0 ? '+' : '';
            ctx.fillText(sign + stock.change.toFixed(2) + '%', r.x + r.w / 2, r.y + r.h / 2 + maxFontTicker * 0.6);
          }
        }
      }
    }

    // Draw sector labels overlay
    if (this.data) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 10px JetBrains Mono';

      for (const sector of this.data) {
        const sectorRects = this.rects.filter(r => r.stock.sector === sector.name);
        if (sectorRects.length === 0) continue;

        const minX = Math.min(...sectorRects.map(r => r.x));
        const minY = Math.min(...sectorRects.map(r => r.y));

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const textWidth = ctx.measureText(sector.name).width;
        ctx.fillRect(minX, minY, textWidth + 8, 14);
        ctx.fillStyle = '#fff';
        ctx.fillText(sector.name, minX + 4, minY + 2);
      }
    }
  },

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found = null;
    for (const r of this.rects) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        found = r;
        break;
      }
    }

    if (found) {
      this.hoveredRect = found;
      const s = found.stock;
      const sign = s.change >= 0 ? '+' : '';
      const mcap = s.mcap >= 1e12 ? '$' + (s.mcap / 1e12).toFixed(1) + 'T' :
                   s.mcap >= 1e9 ? '$' + (s.mcap / 1e9).toFixed(1) + 'B' :
                   '$' + (s.mcap / 1e6).toFixed(0) + 'M';
      this.tooltip.innerHTML =
        '<div style="color:var(--cyn2);font-weight:700;font-size:.75rem">' + s.ticker + '</div>' +
        '<div style="color:var(--t2);margin:.15rem 0">' + s.name + '</div>' +
        '<div style="color:' + (s.change >= 0 ? 'var(--grn2)' : 'var(--red2)') + ';font-weight:600">' + sign + s.change.toFixed(2) + '%</div>' +
        '<div style="color:var(--t3);margin-top:.15rem">Price: $' + s.price.toFixed(2) + ' · MCap: ' + mcap + '</div>' +
        '<div style="color:var(--t3)">' + s.sector + '</div>';
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (e.clientX + 12) + 'px';
      this.tooltip.style.top = (e.clientY + 12) + 'px';

      // Clamp tooltip to viewport
      const tr = this.tooltip.getBoundingClientRect();
      if (tr.right > window.innerWidth) {
        this.tooltip.style.left = (e.clientX - tr.width - 12) + 'px';
      }
      if (tr.bottom > window.innerHeight) {
        this.tooltip.style.top = (e.clientY - tr.height - 12) + 'px';
      }
    } else {
      this.hideTooltip();
    }
  },

  hideTooltip() {
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.hoveredRect = null;
  }
};
