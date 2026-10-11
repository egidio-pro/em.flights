/* ================================================================
   EM FLIGHTS – content.js  v1.4.0 (GWC + Manual Calc)
   ================================================================ */

'use strict';

const POPUP_W = 290;
const POPUP_H_EST = 340;
const PAD = 12;

let config = { passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' };
let popup = null;
let currentNet = null;
let saveTimer = null;

async function init() {
  console.log('[EM Flights] Starting v1.4.0...');

  try {
    const st = await chrome.storage.sync.get({ passengers:1, margin:10, bok:0.8, enabled:true, displayMode:'total' });
    config = { ...config, ...st };

    document.addEventListener('click', onDocClick, true);
    console.log('[EM Flights] Click listener active');

    setTimeout(scanPrices, 1500);

  } catch(e) {
    console.error('[EM Flights] Init error:', e);
    setTimeout(init, 1000);
  }
}

function onDocClick(e) {
  if (!config.enabled) return;
  if (e.target.closest('.voe-popup')) return;

  const target = e.target;

  let priceEl = null;

  if (target.tagName === 'STRONG' && target.classList.contains('priceNumb')) {
    priceEl = target;
  } else if (target.classList.contains('priceNumb')) {
    priceEl = target;
  } else if (target.closest('.price-cont')) {
    const container = target.closest('.price-cont');
    priceEl = container.querySelector('strong.priceNumb');
  }

  if (priceEl) {
    console.log('[EM Flights] Price clicked:', priceEl.textContent);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showPopup(priceEl);
  }
}

function showPopup(priceEl, manualConfig = null) {
  const rect = priceEl.getBoundingClientRect();
  const text = priceEl.textContent.trim();
  const net = parsePrice(text);

  console.log('[EM Flights] Parsed:', text, '->', net);

  if (isNaN(net) || net <= 0) return;

  const activeConfig = manualConfig || config;

  if (popup && popup.isConnected) {
    currentNet = net;
    refreshPopupData(net, activeConfig);
  } else {
    currentNet = net;
    popup = createPopup(net, activeConfig);
    document.body.appendChild(popup);
    positionPopup(popup, rect);
    makeDraggable(popup);
    makeResizable(popup);
    document.addEventListener('keydown', onEsc);
  }
}

function scanPrices() {
  const prices = document.querySelectorAll('strong.priceNumb');
  console.log('[EM Flights] Found', prices.length, 'prices');
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === 'TOGGLE_STATE') {
    config.enabled = msg.enabled;
    if (!config.enabled && popup) destroyPopup();
  }
  else if (msg.type === 'OPEN_MANUAL_CALC') {
    console.log('[EM Flights] Opening manual calculator');
    config = { ...config, ...msg.config };
    showManualCalc(msg.config);
  }
});

function showManualCalc(cfg) {
  destroyPopup();

  const div = document.createElement('div');
  div.className = 'voe-popup voe-manual-popup';
  div.style.setProperty('--voe-scale', '1');
  div.innerHTML = `
    <div class="voe-header">
      <div class="voe-brand">
        <img class="voe-brand-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Logo">
        <span class="voe-brand-name">EM Flights - Calculadora</span>
      </div>
      <button class="voe-close">✕</button>
    </div>
    <div class="voe-body">
      <div class="voe-input-price">
        <label class="voe-price-label">Precio Neto (USD)</label>
        <input type="number" id="manualNetInput" class="voe-price-field" placeholder="0.00" step="0.01" value="">
      </div>
      <div class="voe-settings-row">
        <div class="voe-setting-item">
          <label>Pasajeros</label>
          <div class="voe-step-group">
            <button class="voe-step-btn" data-key="passengers" data-v="-1">-</button>
            <input type="number" id="manualPax" value="${cfg.passengers}" min="1" step="1">
            <button class="voe-step-btn" data-key="passengers" data-v="1">+</button>
          </div>
        </div>
        <div class="voe-setting-item">
          <label>Margen %</label>
          <div class="voe-step-group">
            <button class="voe-step-btn" data-key="margin" data-v="-0.5">-</button>
            <input type="number" id="manualMargin" value="${cfg.margin}" step="0.1" min="0">
            <button class="voe-step-btn" data-key="margin" data-v="0.5">+</button>
          </div>
        </div>
        <div class="voe-setting-item">
          <label>Bok %</label>
          <div class="voe-step-group">
            <button class="voe-step-btn" data-key="bok" data-v="-0.1">-</button>
            <input type="number" id="manualBok" value="${cfg.bok}" step="0.1" min="0">
            <button class="voe-step-btn" data-key="bok" data-v="0.1">+</button>
          </div>
        </div>
      </div>
      <div class="voe-mode-switcher">
        <button class="voe-mode-btn active" data-mode="total">Total</button>
        <button class="voe-mode-btn" data-mode="pax">Por Pax</button>
      </div>
      <div class="voe-results">
        <div class="voe-result-card voe-result-blue">
          <span class="voe-result-label">Precio Final</span>
          <span class="voe-result-value" id="manualFinal">$0</span>
        </div>
        <div class="voe-result-card voe-result-green">
          <span class="voe-result-label">Ganancia Neta</span>
          <span class="voe-result-value" id="manualProfit">$0</span>
        </div>
      </div>
    </div>
    <div class="voe-resize-handle"></div>
  `;

  div.querySelector('.voe-close').onclick = destroyPopup;

  const state = {
    net: 0,
    passengers: cfg.passengers,
    margin: cfg.margin,
    bok: cfg.bok,
    displayMode: 'total'
  };

  function updateManualCalc() {
    if (!state.net || state.net <= 0) {
      div.querySelector('#manualFinal').textContent = '$0';
      div.querySelector('#manualProfit').textContent = '$0';
      return;
    }

    const pct = state.margin + state.bok;
    if (pct >= 100) {
      div.querySelector('#manualFinal').textContent = 'Error';
      div.querySelector('#manualProfit').textContent = '% > 100';
      return;
    }

    const final = state.net / (1 - pct / 100);
    const profit = final - state.net;

    const isTotal = state.displayMode === 'total';
    const showFinal = isTotal ? final : final / state.passengers;
    const showProfit = isTotal ? profit : profit / state.passengers;

    div.querySelector('#manualFinal').textContent = '$' + money(showFinal);
    div.querySelector('#manualProfit').textContent = '$' + money(showProfit);

    document.querySelectorAll('.voe-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === state.displayMode);
    });
  }

  div.querySelector('#manualNetInput').addEventListener('input', (e) => {
    state.net = parseFloat(e.target.value) || 0;
    updateManualCalc();
  });

  div.querySelectorAll('.voe-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const val = parseFloat(btn.dataset.v);
      if (key === 'passengers') {
        state.passengers = Math.max(1, state.passengers + val);
        div.querySelector('#manualPax').value = state.passengers;
      } else if (key === 'margin') {
        state.margin = Math.max(0, parseFloat((state.margin + val).toFixed(1)));
        div.querySelector('#manualMargin').value = state.margin;
      } else if (key === 'bok') {
        state.bok = Math.max(0, parseFloat((state.bok + val).toFixed(1)));
        div.querySelector('#manualBok').value = state.bok;
      }
      updateManualCalc();
    });
  });

  div.querySelectorAll('.voe-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.displayMode = btn.dataset.mode;
      updateManualCalc();
    });
  });

  popup = div;
  document.body.appendChild(popup);
  div.style.top = '100px';
  div.style.left = '100px';
  makeDraggable(div);
  makeResizable(div);
  document.addEventListener('keydown', onEsc);

  setTimeout(() => div.querySelector('#manualNetInput').focus(), 100);
}

function parsePrice(text) {
  if (!text) return NaN;
  let clean = text.replace(/[^\d.,]/g, '');
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean);
}

function calc(net) {
  const pct = config.margin + config.bok;
  if (pct >= 100) return null;
  const final = net / (1 - pct / 100);
  return {
    net, pct, final,
    finalPax: final / config.passengers,
    profit: final - net,
    profitPax: (final - net) / config.passengers,
    pax: config.passengers
  };
}

function money(n) {
  return isNaN(n) ? '0' : Math.round(n).toLocaleString('es-UY');
}

function refreshPopupData(net, activeConfig) {
  if (!popup) return;
  const body = popup.querySelector('.voe-body');
  if (!body) return;
  body.style.opacity = '0.3';
  setTimeout(() => {
    renderPopupBody(activeConfig);
    body.style.opacity = '1';
  }, 50);
}

function createPopup(net, activeConfig = null) {
  const cfg = activeConfig || config;
  const div = document.createElement('div');
  div.className = 'voe-popup';
  div.style.setProperty('--voe-scale', '1');
  div.innerHTML = `
    <div class="voe-header">
      <div class="voe-brand">
        <img class="voe-brand-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Logo">
        <span class="voe-brand-name">EM Flights</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <label class="voe-switch">
          <input type="checkbox" id="voeGlobalToggle" ${config.enabled ? 'checked' : ''}>
          <span class="voe-slider"></span>
        </label>
        <button class="voe-close">✕</button>
      </div>
    </div>
    <div class="voe-body"></div>
    <div class="voe-resize-handle"></div>
  `;
  div.querySelector('.voe-close').onclick = destroyPopup;
  div.querySelector('#voeGlobalToggle').onchange = (e) => {
    config.enabled = e.target.checked;
    chrome.storage.sync.set({ enabled: config.enabled });
    if (!config.enabled) destroyPopup();
  };
  popup = div;
  renderPopupBody(activeConfig);
  return div;
}

function renderPopupBody(activeConfig = null) {
  if (!popup) return;
  const cfg = activeConfig || config;
  const body = popup.querySelector('.voe-body');
  const d = calc(currentNet);

  if (!d) {
    body.innerHTML = '<div class="voe-error-state">Suma de % excede 100%</div>';
    return;
  }

  const isTotal = cfg.displayMode === 'total';
  const mainFinal = isTotal ? d.final : d.finalPax;
  const mainProfit = isTotal ? d.profit : d.profitPax;

  body.innerHTML = `
    <div class="voe-info-row">
      <div class="voe-info-chip">
        <span class="voe-chip-label">Neto GWC</span>
        <span class="voe-chip-value">USD ${money(d.net)}</span>
      </div>
      <div class="voe-info-chip">
        <span class="voe-chip-label">Pasajeros</span>
        <div class="voe-input-group">
          <button class="voe-step" data-key="passengers" data-v="-1">-</button>
          <input type="number" class="voe-manual" data-key="passengers" value="${cfg.passengers}" step="1" min="1">
          <button class="voe-step" data-key="passengers" data-v="1">+</button>
        </div>
      </div>
    </div>

    <div class="voe-switcher">
      <button class="voe-switch-btn ${isTotal ? 'active' : ''}" data-m="total">Total</button>
      <button class="voe-switch-btn ${!isTotal ? 'active' : ''}" data-m="pax">Por Pax</button>
    </div>

    <div class="voe-info-row">
      <div class="voe-info-chip">
        <span class="voe-chip-label">Margen (%)</span>
        <div class="voe-input-group">
          <button class="voe-step" data-key="margin" data-v="-0.5">-</button>
          <input type="number" class="voe-manual" data-key="margin" value="${cfg.margin}" step="0.1">
          <button class="voe-step" data-key="margin" data-v="0.5">+</button>
        </div>
      </div>
      <div class="voe-info-chip">
        <span class="voe-chip-label">Bok (%)</span>
        <div class="voe-input-group">
          <button class="voe-step" data-key="bok" data-v="-0.1">-</button>
          <input type="number" class="voe-manual" data-key="bok" value="${cfg.bok}" step="0.1">
          <button class="voe-step" data-key="bok" data-v="0.1">+</button>
        </div>
      </div>
    </div>

    <div class="voe-card voe-card-blue">
      <div class="voe-card-title">Precio final al cliente <span style="font-weight:400">(${isTotal ? 'Total' : 'Pax'})</span></div>
      <div class="voe-card-main" id="voeFinalLabel">USD ${money(mainFinal)}</div>
    </div>

    <div class="voe-card voe-card-green">
      <div class="voe-card-title">Ganancia neta <span style="font-weight:400">(${isTotal ? 'Total' : 'Pax'})</span></div>
      <div class="voe-card-main" id="voeProfitLabel">USD ${money(mainProfit)}</div>
    </div>
  `;

  body.querySelectorAll('.voe-switch-btn').forEach(b => {
    b.onclick = () => {
      config.displayMode = b.dataset.m;
      chrome.storage.sync.set({ displayMode: config.displayMode });
      renderPopupBody();
    };
  });

  body.querySelectorAll('.voe-step').forEach(b => {
    b.onclick = () => {
      const key = b.dataset.key;
      const val = parseFloat(b.dataset.v);
      config[key] = Math.max(0, parseFloat((config[key] + val).toFixed(2)));
      if (key === 'passengers') config[key] = Math.max(1, config[key]);
      saveAndRefresh();
    };
  });

  body.querySelectorAll('.voe-manual').forEach(input => {
    input.oninput = (e) => {
      const key = input.dataset.key;
      let val = parseFloat(e.target.value);
      if (isNaN(val)) return;
      if (key === 'passengers' && val < 1) val = 1;
      if (val < 0) val = 0;
      config[key] = val;
      updateTotalsInUI();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => chrome.storage.sync.set(config), 600);
    };
  });
}

function updateTotalsInUI() {
  const d = calc(currentNet);
  const isTotal = config.displayMode === 'total';
  const finalEl = popup?.querySelector('#voeFinalLabel');
  const profitEl = popup?.querySelector('#voeProfitLabel');
  if (d && finalEl && profitEl) {
    finalEl.textContent = `USD ${money(isTotal ? d.final : d.finalPax)}`;
    profitEl.textContent = `USD ${money(isTotal ? d.profit : d.profitPax)}`;
  }
}

function saveAndRefresh() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.sync.set(config), 400);
  renderPopupBody();
}

function positionPopup(el, rect) {
  let top = rect.bottom + PAD;
  let left = rect.left;
  if (top + POPUP_H_EST > window.innerHeight) top = rect.top - POPUP_H_EST - PAD;
  if (left + POPUP_W > window.innerWidth) left = window.innerWidth - POPUP_W - PAD;
  el.style.top = `${Math.max(PAD, top)}px`;
  el.style.left = `${Math.max(PAD, left)}px`;
}

function makeDraggable(el) {
  const h = el.querySelector('.voe-header');
  let d = false, ox, oy, sl, st;
  h.onmousedown = (e) => {
    if (e.target.closest('.voe-close') || e.target.closest('.voe-switch') || e.target.closest('input')) return;
    d = true; ox = e.clientX; oy = e.clientY;
    sl = parseInt(el.style.left); st = parseInt(el.style.top);
    document.onmousemove = (me) => {
      if (!d) return;
      el.style.left = `${sl + me.clientX - ox}px`;
      el.style.top = `${st + me.clientY - oy}px`;
    };
    document.onmouseup = () => d = false;
  };
}

function makeResizable(el) {
  const r = el.querySelector('.voe-resize-handle');
  let rs = false, ox, os;
  r.onmousedown = (e) => {
    rs = true; ox = e.clientX;
    os = parseFloat(el.style.getPropertyValue('--voe-scale')) || 1;
    document.onmousemove = (me) => {
      if (!rs) return;
      const s = Math.max(0.6, Math.min(1.5, os + (me.clientX - ox)/250));
      el.style.setProperty('--voe-scale', s);
    };
    document.onmouseup = () => rs = false;
  };
}

function destroyPopup() {
  if (popup) {
    popup.remove();
    popup = null;
    document.removeEventListener('keydown', onEsc);
  }
}

function onEsc(e) { if (e.key === 'Escape') destroyPopup(); }

window.addEventListener('beforeunload', destroyPopup);

init();