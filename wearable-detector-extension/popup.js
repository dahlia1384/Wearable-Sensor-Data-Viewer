'use strict';

const SENSOR_META = {
  accelerometer: { label: 'Accel',  color: '#3b82f6' },
  heart_rate:    { label: 'HR',     color: '#ef4444' },
  spo2:          { label: 'SpO₂',  color: '#8b5cf6' },
  temperature:   { label: 'Temp',   color: '#f97316' }
};

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const content = document.getElementById('content');
  const tab = await getActiveTab();

  if (!tab?.url?.includes('github.com')) {
    content.innerHTML = '<p class="hint">Open a GitHub repository to detect sensor data files.</p>';
    return;
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_FILES' });
  } catch {
    content.innerHTML = '<p class="hint">Refresh the GitHub page and try again.</p>';
    return;
  }

  const files = response?.files ?? [];

  if (!files.length) {
    content.innerHTML = '<p class="hint">No wearable sensor data files detected in this repository view.</p>';
    return;
  }

  // Group by sensor type
  const byType = {};
  for (const f of files) {
    (byType[f.sensorType] ??= []).push(f);
  }

  const typeChips = Object.entries(byType).map(([type, group]) => {
    const m = SENSOR_META[type];
    return `<span class="chip" style="background:${m.color}18;color:${m.color};border-color:${m.color}44">
      ${m.label} × ${group.length}
    </span>`;
  }).join('');

  const fileRows = files.map(f => {
    const m = SENSOR_META[f.sensorType];
    return `<li class="row">
      <span class="badge" style="background:${m.color}18;color:${m.color};border-color:${m.color}44">${m.label}</span>
      <a class="fname" href="${f.href}" target="_blank" title="${f.filename}">${f.filename}</a>
    </li>`;
  }).join('');

  content.innerHTML = `
    <div class="summary">
      <span class="count">${files.length} file${files.length !== 1 ? 's' : ''} found</span>
      <div class="chips">${typeChips}</div>
    </div>
    <ul class="list">${fileRows}</ul>
    <button id="view-btn">View panel on page</button>
  `;

  document.getElementById('view-btn').addEventListener('click', async () => {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
    window.close();
  });
}

init();
