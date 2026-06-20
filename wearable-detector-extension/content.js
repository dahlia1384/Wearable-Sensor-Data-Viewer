'use strict';

// ── Sensor type definitions ────────────────────────────────────────────────────

const SENSORS = {
  accelerometer: {
    fileKeywords: ['accel', 'acceleromet', 'imu', 'gyro', 'inertial', 'motion_sensor'],
    columnKeywords: ['accel', 'acc_x', 'acc_y', 'acc_z', 'ax', 'ay', 'az',
                     'gx', 'gy', 'gz', 'mag_x', 'mag_y', 'mag_z', 'mx', 'my', 'mz'],
    label: 'Accelerometer',
    color: '#3b82f6',
    unit: 'm/s²'
  },
  heart_rate: {
    fileKeywords: ['heart', '_hr_', '-hr-', '_hr.', '-hr.', 'heartrate',
                   'bpm', 'pulse', 'ecg', 'ekg', 'ppg', 'cardiac'],
    columnKeywords: ['heart_rate', 'heartrate', 'hr', 'bpm', 'pulse', 'ecg', 'ppg'],
    label: 'Heart Rate',
    color: '#ef4444',
    unit: 'bpm'
  },
  spo2: {
    fileKeywords: ['spo2', 'spO2', 'SpO2', 'oxygen', 'oxim', 'saturation', 'pulseox'],
    columnKeywords: ['spo2', 'spo_2', 'oxygen', 'saturation', 'o2_sat', 'pulseox'],
    label: 'SpO₂',
    color: '#8b5cf6',
    unit: '%'
  },
  temperature: {
    fileKeywords: ['temp', 'temperature', 'thermal', 'fever', 'body_temp', 'skin_temp'],
    columnKeywords: ['temp', 'temperature', 'skin_temp', 'body_temp', 'celsius', 'fahrenheit'],
    label: 'Temperature',
    color: '#f97316',
    unit: '°C'
  }
};

const DATA_EXTS = new Set(['.csv', '.tsv', '.txt', '.dat', '.json', '.ndjson']);
const MAX_ROWS = 500;

// ── Utilities ─────────────────────────────────────────────────────────────────

function fileExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function detectSensorType(text) {
  const lower = text.toLowerCase();
  for (const [type, cfg] of Object.entries(SENSORS)) {
    if (cfg.fileKeywords.some(kw => lower.includes(kw.toLowerCase()))) return type;
  }
  return null;
}

// ── GitHub page scanning ───────────────────────────────────────────────────────

function scanRepoFiles() {
  const results = [];
  const seen = new Set();

  document.querySelectorAll('a[href*="/blob/"]').forEach(link => {
    const href = link.href;
    if (!href || seen.has(href)) return;
    seen.add(href);

    const match = href.match(/\/blob\/[^/]+\/(.+)$/);
    if (!match) return;

    const filepath = decodeURIComponent(match[1]).split('?')[0];
    const filename = filepath.split('/').pop();
    if (!DATA_EXTS.has(fileExt(filename))) return;

    const sensorType = detectSensorType(filename) || detectSensorType(filepath);
    if (!sensorType) return;

    results.push({ filename, filepath, href, sensorType });
  });

  return results;
}

function detectCurrentFile() {
  const match = location.pathname.match(/\/blob\/[^/]+\/(.+)$/);
  if (!match) return null;
  const filepath = decodeURIComponent(match[1]);
  const filename = filepath.split('/').pop();
  if (!DATA_EXTS.has(fileExt(filename))) return null;
  const sensorType = detectSensorType(filename) || detectSensorType(filepath);
  if (!sensorType) return null;
  return { filename, filepath, href: location.href, sensorType };
}

// ── CSV / JSON parsing ────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;

  const first = lines[0];
  let delimiter = ',';
  let best = 0;
  for (const d of [',', '\t', ';', '|']) {
    const n = first.split(d).length;
    if (n > best) { best = n; delimiter = d; }
  }

  const strip = s => s.trim().replace(/^["']|["']$/g, '');
  const headers = first.split(delimiter).map(strip);
  const rows = [];

  for (let i = 1; i < Math.min(lines.length, MAX_ROWS + 1); i++) {
    const cells = lines[i].split(delimiter).map(strip);
    if (cells.length >= headers.length) {
      rows.push(cells.map(c => (c !== '' && !isNaN(c)) ? parseFloat(c) : c));
    }
  }

  return { headers, rows, totalLines: lines.length - 1 };
}

function parseJSON(text) {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data) || !data.length || typeof data[0] !== 'object') return null;
    const headers = Object.keys(data[0]);
    const rows = data.slice(0, MAX_ROWS).map(obj =>
      headers.map(h => {
        const v = obj[h];
        return typeof v === 'number' ? v : (!isNaN(v) && v !== '' ? parseFloat(v) : v);
      })
    );
    return { headers, rows, totalLines: data.length };
  } catch {
    return null;
  }
}

// ── Stats & column detection ──────────────────────────────────────────────────

function numericColumns(headers, rows) {
  return headers.filter((_, i) =>
    rows.slice(0, 20).some(r => typeof r[i] === 'number' && !isNaN(r[i]))
  );
}

function sensorColumns(headers, sensorType) {
  const kws = SENSORS[sensorType]?.columnKeywords ?? [];
  return headers.filter(h => kws.some(k => h.toLowerCase().includes(k.toLowerCase())));
}

function colStats(headers, rows, col) {
  const idx = headers.indexOf(col);
  if (idx < 0) return null;
  const vals = rows.map(r => r[idx]).filter(v => typeof v === 'number' && !isNaN(v));
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, max, mean, count: vals.length, values: vals };
}

// ── Anomaly detection ─────────────────────────────────────────────────────────

const ANOMALY_Z = 2.0;

function computeAnomalies(values) {
  if (values.length < 4) return { indices: new Set(), count: 0, pct: 0, maxZ: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  if (std === 0) return { indices: new Set(), count: 0, pct: 0, maxZ: 0 };
  const indices = new Set();
  let maxZ = 0;
  values.forEach((v, i) => {
    const z = Math.abs(v - mean) / std;
    if (z > ANOMALY_Z) indices.add(i);
    if (z > maxZ) maxZ = z;
  });
  return { indices, count: indices.size, pct: (indices.size / values.length) * 100, maxZ };
}

function anomalySeverity(pct) {
  if (pct === 0) return null;
  if (pct < 1)  return { level: 'low',    label: 'low' };
  if (pct < 5)  return { level: 'medium', label: 'moderate' };
  return              { level: 'high',   label: 'high' };
}

// ── Sparkline drawing ─────────────────────────────────────────────────────────

// pts must already be downsampled; anomalyIndices are indices into pts
function drawSparkline(canvas, pts, color, anomalyIndices = new Set()) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, P = 4;

  ctx.clearRect(0, 0, W, H);
  if (pts.length < 2) return;

  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const sx = (W - P * 2) / (pts.length - 1);
  const sy = (H - P * 2) / range;

  const x = i => P + i * sx;
  const y = v => H - P - (v - min) * sy;

  // Gradient fill under line
  const grad = ctx.createLinearGradient(0, P, 0, H - P);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, color + '00');

  ctx.beginPath();
  ctx.moveTo(x(0), y(pts[0]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(x(i), y(pts[i]));
  ctx.lineTo(x(pts.length - 1), H - P);
  ctx.lineTo(x(0), H - P);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke
  ctx.beginPath();
  ctx.moveTo(x(0), y(pts[0]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(x(i), y(pts[i]));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Anomaly markers — dashed drop-line + red dot with white ring
  anomalyIndices.forEach(i => {
    if (i >= pts.length) return;
    const px = x(i), py = y(pts[i]);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#ef444466';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py + 5);
    ctx.lineTo(px, H - P);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

// ── File analysis ─────────────────────────────────────────────────────────────

async function analyzeFile(fileInfo) {
  const rawUrl = fileInfo.href
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/');

  let text;
  try {
    const r = await fetch(rawUrl);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    text = await r.text();
  } catch (e) {
    return { error: e.message };
  }

  const ext = fileExt(fileInfo.filename);
  const parsed = (ext === '.json' || ext === '.ndjson') ? parseJSON(text) : parseCSV(text);
  if (!parsed) return { error: 'Could not parse file format' };

  let cols = sensorColumns(parsed.headers, fileInfo.sensorType);
  if (!cols.length) cols = numericColumns(parsed.headers, parsed.rows).slice(0, 4);

  const analyses = cols
    .map(col => { const s = colStats(parsed.headers, parsed.rows, col); return s ? { col, ...s } : null; })
    .filter(Boolean);

  return {
    headers: parsed.headers,
    rowCount: parsed.totalLines,
    sampleRows: parsed.rows.length,
    analyses
  };
}

// ── Panel UI ──────────────────────────────────────────────────────────────────

let panel = null;
let detectedFiles = [];

function createPanel(files) {
  if (panel) panel.remove();

  panel = document.createElement('div');
  panel.id = 'wdd-panel';
  panel.innerHTML = `
    <div class="wdd-header">
      <span class="wdd-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        Wearable Sensor Data
      </span>
      <button class="wdd-close" aria-label="Close">×</button>
    </div>
    <div class="wdd-subtitle">${files.length} sensor file${files.length !== 1 ? 's' : ''} detected</div>
    <div class="wdd-files" id="wdd-files"></div>
  `;

  panel.querySelector('.wdd-close').onclick = () => panel.remove();

  const list = panel.querySelector('#wdd-files');

  files.forEach(f => {
    const cfg = SENSORS[f.sensorType];
    const id = 'wdd-a-' + Math.random().toString(36).slice(2);
    const item = document.createElement('div');
    item.className = 'wdd-item';
    item.innerHTML = `
      <div class="wdd-item-hdr">
        <span class="wdd-badge" style="background:${cfg.color}18;color:${cfg.color};border-color:${cfg.color}44">${cfg.label}</span>
        <a class="wdd-fname" href="${f.href}" target="_blank" title="${f.filename}">${f.filename}</a>
        <button class="wdd-btn" data-id="${id}" data-href="${f.href}" data-type="${f.sensorType}" data-name="${f.filename}">Analyze</button>
      </div>
      <div class="wdd-analysis" id="${id}"></div>
    `;
    list.appendChild(item);
  });

  list.addEventListener('click', async e => {
    const btn = e.target.closest('.wdd-btn');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Loading…';

    const result = await analyzeFile({ href: btn.dataset.href, sensorType: btn.dataset.type, filename: btn.dataset.name });
    const target = document.getElementById(btn.dataset.id);
    btn.remove();
    renderAnalysis(target, result, btn.dataset.type);
  });

  document.body.appendChild(panel);
}

function renderAnalysis(container, result, sensorType) {
  const cfg = SENSORS[sensorType];

  if (result.error) {
    container.innerHTML = `<div class="wdd-err">⚠ ${result.error}</div>`;
    return;
  }

  const truncNote = result.sampleRows < result.rowCount
    ? ` · first ${result.sampleRows.toLocaleString()} shown` : '';

  container.innerHTML = `
    <div class="wdd-meta">${result.rowCount.toLocaleString()} rows · ${result.headers.length} columns${truncNote}</div>
    ${result.analyses.length ? '<div class="wdd-charts"></div>' : '<div class="wdd-empty">No numeric sensor columns found</div>'}
  `;

  if (!result.analyses.length) return;

  const charts = container.querySelector('.wdd-charts');

  result.analyses.slice(0, 4).forEach(a => {
    const anomalies = computeAnomalies(a.values);
    const severity  = anomalySeverity(anomalies.pct);

    const anomalyHtml = severity
      ? `<div class="wdd-anomaly-row">
           <span class="wdd-anomaly-badge wdd-anomaly-${severity.level}"
                 title="${anomalies.count} point${anomalies.count !== 1 ? 's' : ''} deviate more than ${ANOMALY_Z}σ from the mean · max ${anomalies.maxZ.toFixed(1)}σ">
             ⚠ ${anomalies.count} anomal${anomalies.count !== 1 ? 'ies' : 'y'} · ${anomalies.pct.toFixed(1)}% · ${severity.label}
           </span>
         </div>`
      : '';

    const wrap = document.createElement('div');
    wrap.className = 'wdd-chart';
    wrap.innerHTML = `
      <div class="wdd-chart-hdr">
        <span class="wdd-col">${a.col}</span>
        <span class="wdd-stats">
          <span title="Mean">avg ${a.mean.toFixed(2)}</span>
          <span title="Min">↓ ${a.min.toFixed(2)}</span>
          <span title="Max">↑ ${a.max.toFixed(2)}</span>
          <span title="Count">${a.count.toLocaleString()} pts</span>
        </span>
      </div>
      ${anomalyHtml}
      <canvas class="wdd-canvas" width="280" height="56"></canvas>
    `;
    charts.appendChild(wrap);

    // Downsample for display, and map anomaly indices into display space
    const DISPLAY_PTS = 120;
    let sparkVals = a.values;
    let displayAnomalies = anomalies.indices;

    if (a.values.length > DISPLAY_PTS) {
      const step = a.values.length / DISPLAY_PTS;
      sparkVals = Array.from({ length: DISPLAY_PTS }, (_, i) => a.values[Math.floor(i * step)]);
      const mapped = new Set();
      for (let di = 0; di < DISPLAY_PTS; di++) {
        const s = Math.floor(di * step);
        const e = Math.floor((di + 1) * step);
        for (let j = s; j < e; j++) {
          if (anomalies.indices.has(j)) { mapped.add(di); break; }
        }
      }
      displayAnomalies = mapped;
    }

    drawSparkline(wrap.querySelector('canvas'), sparkVals, cfg.color, displayAnomalies);
  });
}

// ── Toggle button ─────────────────────────────────────────────────────────────

function upsertToggle(count) {
  let btn = document.getElementById('wdd-toggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'wdd-toggle';
    btn.title = 'Wearable Sensor Data Detector';
    document.body.appendChild(btn);
  }
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
    <span>${count}</span>
  `;
  btn.onclick = () => {
    if (panel && document.body.contains(panel)) panel.remove();
    else createPanel(detectedFiles);
  };
}

// ── Init & SPA navigation ─────────────────────────────────────────────────────

async function init() {
  // Clean up previous state
  if (panel) { panel.remove(); panel = null; }

  detectedFiles = scanRepoFiles();

  const currentFile = detectCurrentFile();
  if (currentFile && !detectedFiles.some(f => f.href === currentFile.href)) {
    detectedFiles.unshift(currentFile);
  }

  if (!detectedFiles.length) {
    document.getElementById('wdd-toggle')?.remove();
    return;
  }

  upsertToggle(detectedFiles.length);
  createPanel(detectedFiles);

  // Auto-analyze when viewing a single sensor file directly
  if (currentFile && detectedFiles.length === 1) {
    const id = panel.querySelector('.wdd-btn')?.dataset.id;
    const btn = panel.querySelector('.wdd-btn');
    if (btn && id) {
      btn.disabled = true;
      btn.textContent = 'Loading…';
      const result = await analyzeFile(currentFile);
      const target = document.getElementById(id);
      btn.remove();
      if (target) renderAnalysis(target, result, currentFile.sensorType);
    }
  }
}

// Run after GitHub has rendered
setTimeout(init, 400);

// Re-run on GitHub SPA navigation
let lastHref = location.href;
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    setTimeout(init, 600);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// ── Message bridge (popup communication) ──────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_FILES') {
    sendResponse({ files: detectedFiles });
  } else if (msg.type === 'TOGGLE_PANEL') {
    if (panel && document.body.contains(panel)) panel.remove();
    else createPanel(detectedFiles);
  }
  return true;
});
