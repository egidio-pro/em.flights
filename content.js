/* ================================================================
   EM FLIGHTS – content.js  v1.1.5 (Manual Input)
   ================================================================ */

'use strict';

const POPUP_W    = 290;
const POPUP_H_EST = 340;
const PAD        = 12;

let config     = { passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' };
let popup      = null;
let currentNet = null;
let saveTimer  = null;

const PRICE_SELECTORS = '.priceNumb, .price-numb, [class*="priceNumb"], .totalPrice, .amount';

async function init() {
  try {
    const st = await chrome.storage.sync.get({ passengers:1, margin:10, bok:0.8, enabled:true, displayMode:'total' });
    config = { ...config, ...st };
    document.addEventListener('click', handleGlobalClick, true);
  } catch(e) {
    console.error('[EM Flights] Error init:', e);
  }
}

function handleGlobalClick(e) {
  if (!config.enabled) return;
  const el = e.target.closest(PRICE_SELECTORS);
  if (e.altKey) console.log('[EM Flights] Debug:', e.target.className);
  if (!el) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const net = parsePrice(el.textContent);
  if (isNaN(net) || net <= 0) return;

  if (popup && popup.isConnected) {
    currentNet = net;
    refreshPopupData(net);
  } else {
    currentNet = net;
    popup = createPopup(net);
    document.body.appendChild(popup);
    positionPopup(popup, el.getBoundingClientRect());
    makeDraggable(popup);
    makeResizable(popup);
    document.addEventListener('keydown', onEsc);
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === 'TOGGLE_STATE') {
    config.enabled = msg.enabled;
    if (!config.enabled) destroyPopup();
  } else if (msg.type === 'CONFIG_UPDATED') {
    if (msg.config.passengers !== undefined) config.passengers = msg.config.passengers;
    if (popup && popup.isConnected) renderPopupBody();
  }
});

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
    finalPax : final / config.passengers,
    profit   : final - net,
    profitPax: (final - net) / config.passengers,
    pax      : config.passengers
  };
}

function money(n) {
  return isNaN(n) ? '—' : Math.round(n).toLocaleString('es-UY');
}

function refreshPopupData(net) {
  if (!popup) return;
  const body = popup.querySelector('.voe-body');
  if (!body) return;
  body.style.opacity = '0.3';
  setTimeout(() => {
    renderPopupBody();
    body.style.opacity = '1';
  }, 50);
}

function createPopup(net) {
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
  renderPopupBody();
  return div;
}

function renderPopupBody() {
  if (!popup) return;
  const body = popup.querySelector('.voe-body');
  const d = calc(currentNet);
  
  if (!d) {
    body.innerHTML = '<div class="voe-error-state">Suma de % excede 100%</div>';
    return;
  }

  const isTotal = config.displayMode === 'total';
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
          <input type="number" class="voe-manual" data-key="passengers" value="${config.passengers}" step="1" min="1">
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
          <input type="number" class="voe-manual" data-key="margin" value="${config.margin}" step="0.1">
          <button class="voe-step" data-key="margin" data-v="0.5">+</button>
        </div>
      </div>
      <div class="voe-info-chip">
        <span class="voe-chip-label">Bok (%)</span>
        <div class="voe-input-group">
          <button class="voe-step" data-key="bok" data-v="-0.1">-</button>
          <input type="number" class="voe-manual" data-key="bok" value="${config.bok}" step="0.1">
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
  const finalEl = popup.querySelector('#voeFinalLabel');
  const profitEl = popup.querySelector('#voeProfitLabel');
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

function destroyPopup() { if (popup) { popup.remove(); popup = null; } }
function onEsc(e) { if (e.key === 'Escape') destroyPopup(); }

init();
