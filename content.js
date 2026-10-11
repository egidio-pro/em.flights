/* ================================================================
   EM FLIGHTS – content.js  v2.1.2
   Doble Modo: GWC Automático (gwc.glas.travel) + Manual Independiente
   ================================================================ */

'use strict';

const POPUP_W = 320;
const POPUP_H_EST = 400;
const PAD = 14;

let config = { passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' };
let popup = null;
let currentNet = 0;
let currentMode = 'manual'; // 'gwc' o 'manual'
let saveTimer = null;

async function init() {
  console.log('[EM Flights] Starting v2.1.2...');

  try {
    const st = await chrome.storage.sync.get({ passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' });
    config = { ...config, ...st };

    document.addEventListener('click', onDocClick, true);
    console.log('[EM Flights] Click listener active (GWC automatic detection)');
  } catch (e) {
    console.error('[EM Flights] Init error:', e);
    setTimeout(init, 1000);
  }
}

// Verifica si la página actual corresponde a GWC (gwc.glas.travel) o entornos de prueba
function isGwcPage() {
  const host = window.location.hostname || '';
  const href = window.location.href || '';
  return host === 'gwc.glas.travel' ||
         host.endsWith('.gwc.glas.travel') ||
         href.includes('gwc.glas.travel/search') ||
         href.includes('gwc.glas.travel') ||
         href.includes('test_gwc_simulation') ||
         href.includes('Probar_EM_Flights');
}

function onDocClick(e) {
  if (!config.enabled) return;

  // REQUISITO CLAVE: La calculadora automática solo se activa en gwc.glas.travel/search
  if (!isGwcPage()) return;

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
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const net = parsePrice(priceEl.textContent.trim());
    if (!isNaN(net) && net > 0) {
      showCalculator(net, priceEl, 'gwc');
    }
  }
}

// Mensajes recibidos desde el popup o background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === 'TOGGLE_STATE') {
    config.enabled = msg.enabled;
    if (!config.enabled && popup) destroyPopup();
    if (sendResponse) sendResponse({ ok: true });
  } else if (msg.type === 'OPEN_MANUAL_CALC') {
    // Calculadora manual: se abre independientemente del dominio
    config = { ...config, ...msg.config };
    showCalculator(currentNet || 0, null, 'manual');
    if (sendResponse) sendResponse({ ok: true });
  }
  return true;
});

function showCalculator(netValue, anchorEl = null, mode = 'manual') {
  currentNet = netValue || 0;
  currentMode = mode;

  if (popup && popup.isConnected) {
    const priceInput = popup.querySelector('#voeNetPrice');
    if (priceInput) priceInput.value = currentNet > 0 ? currentNet : '';
    applyModeToDOM(popup, mode);
    updateCalculatorUI();
    return;
  }

  popup = renderCalculatorDOM(currentNet, mode);
  document.body.appendChild(popup);

  if (anchorEl) {
    positionNear(popup, anchorEl.getBoundingClientRect());
  } else {
    // Calculadora manual: centrada en la parte superior
    popup.style.top = '90px';
    popup.style.left = `${Math.max(20, (window.innerWidth - POPUP_W) / 2)}px`;
  }

  makeDraggable(popup);
  makeResizable(popup);
  document.addEventListener('keydown', onEsc);

  // Foco en precio si se abre manual con valor 0
  if (mode === 'manual' && (!netValue || netValue <= 0)) {
    setTimeout(() => {
      const field = popup.querySelector('#voeNetPrice');
      if (field) field.focus();
    }, 100);
  }
}

function applyModeToDOM(el, mode) {
  const badge = el.querySelector('#voeBadge');
  const priceBoxLabel = el.querySelector('#voePriceBoxLabel');
  const priceTag = el.querySelector('#voePriceTag');
  const isGwc = mode === 'gwc';

  if (badge) {
    badge.className = `voe-badge-pill ${isGwc ? 'voe-badge-gwc' : 'voe-badge-manual'}`;
    badge.textContent = isGwc ? '✈️ GWC Auto' : '📊 Calc Manual';
  }
  if (priceBoxLabel) {
    priceBoxLabel.textContent = isGwc ? 'Tarifa GWC (Detectada)' : 'Tarifa Neta (Manual)';
  }
  if (priceTag) {
    priceTag.className = `voe-price-tag ${isGwc ? 'voe-price-tag-gwc' : 'voe-price-tag-manual'}`;
    priceTag.textContent = isGwc ? 'gwc.glas.travel' : 'Cualquier dominio';
  }
}

function renderCalculatorDOM(initialNet, mode) {
  const isGwc = mode === 'gwc';
  const div = document.createElement('div');
  div.className = 'voe-popup';
  div.style.setProperty('--voe-scale', '1');

  div.innerHTML = `
    <div class="voe-header">
      <div class="voe-brand">
        <img class="voe-brand-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Logo">
        <div class="voe-brand-text">
          <span class="voe-brand-name">EM Flights</span>
          <span class="voe-badge-pill ${isGwc ? 'voe-badge-gwc' : 'voe-badge-manual'}" id="voeBadge">
            ${isGwc ? '✈️ GWC Auto' : '📊 Calc Manual'}
          </span>
        </div>
      </div>
      <button class="voe-close" title="Cerrar [ESC]">✕</button>
    </div>

    <div class="voe-body">
      <!-- Tarifa Neta -->
      <div class="voe-price-box">
        <div class="voe-price-box-header">
          <span class="voe-price-label" id="voePriceBoxLabel">
            ${isGwc ? 'Tarifa GWC (Detectada)' : 'Tarifa Neta (Manual)'}
          </span>
          <span class="voe-price-tag ${isGwc ? 'voe-price-tag-gwc' : 'voe-price-tag-manual'}" id="voePriceTag">
            ${isGwc ? 'gwc.glas.travel' : 'Cualquier dominio'}
          </span>
        </div>
        <div class="voe-price-input-row">
          <span class="voe-currency-sym">USD</span>
          <input type="text" id="voeNetPrice" class="voe-price-field"
                 placeholder="0.00" value="${initialNet > 0 ? initialNet : ''}" inputmode="decimal">
        </div>
      </div>

      <!-- Pasajeros -->
      <div class="voe-setting-row">
        <span class="voe-setting-label">Pasajeros</span>
        <div class="voe-step-group">
          <button class="voe-step-btn" data-field="passengers" data-step="-1">−</button>
          <input type="number" id="voePaxInput" class="voe-step-input" value="${config.passengers}" min="1" step="1">
          <button class="voe-step-btn" data-field="passengers" data-step="1">+</button>
        </div>
      </div>

      <!-- Margen % -->
      <div class="voe-setting-row">
        <span class="voe-setting-label">Margen (%)</span>
        <div class="voe-step-group">
          <button class="voe-step-btn" data-field="margin" data-step="-0.5">−</button>
          <input type="number" id="voeMarginInput" class="voe-step-input" value="${config.margin}" step="0.5" min="0">
          <button class="voe-step-btn" data-field="margin" data-step="0.5">+</button>
        </div>
      </div>

      <!-- Presets de Margen rápido -->
      <div class="voe-presets">
        <button class="voe-preset-btn" data-preset="8">8%</button>
        <button class="voe-preset-btn" data-preset="10">10%</button>
        <button class="voe-preset-btn" data-preset="12">12%</button>
        <button class="voe-preset-btn" data-preset="15">15%</button>
      </div>

      <!-- Bok % -->
      <div class="voe-setting-row">
        <span class="voe-setting-label">Bok / Fee (%)</span>
        <div class="voe-step-group">
          <button class="voe-step-btn" data-field="bok" data-step="-0.1">−</button>
          <input type="number" id="voeBokInput" class="voe-step-input" value="${config.bok}" step="0.1" min="0">
          <button class="voe-step-btn" data-field="bok" data-step="0.1">+</button>
        </div>
      </div>

      <!-- Conmutador Total / Pax -->
      <div class="voe-switcher">
        <button class="voe-switch-btn ${config.displayMode === 'total' ? 'active' : ''}" data-mode="total">Total</button>
        <button class="voe-switch-btn ${config.displayMode === 'pax' ? 'active' : ''}" data-mode="pax">Por Pasajero</button>
      </div>

      <!-- Tarjetas de Resultado -->
      <div class="voe-results">
        <div class="voe-card voe-card-blue" id="voeFinalCard" title="Clic para copiar cotización">
          <div class="voe-card-content">
            <div class="voe-card-title">Precio final al cliente <span id="voeModeLabel">(${config.displayMode === 'total' ? 'Total' : 'Pax'})</span></div>
            <div class="voe-card-main" id="voeFinalLabel">USD 0</div>
          </div>
          <button class="voe-copy-btn" id="voeCopyBtn" title="Copiar cotización">
            📋 Copiar
          </button>
        </div>

        <div class="voe-card voe-card-green">
          <div class="voe-card-content">
            <div class="voe-card-title">Ganancia neta <span id="voeProfitModeLabel">(${config.displayMode === 'total' ? 'Total' : 'Pax'})</span></div>
            <div class="voe-card-main" id="voeProfitLabel">USD 0</div>
          </div>
        </div>
      </div>

      <div class="voe-footnote" id="voeFootnote">
        ${isGwc ? '✈️ Modo GWC (gwc.glas.travel)' : '📊 Modo Manual'} · Margen total: 10.8%
      </div>
    </div>
    <div class="voe-resize-handle" title="Arrastra para redimensionar"></div>
  `;

  // Cerrar
  div.querySelector('.voe-close').onclick = destroyPopup;

  // Entrada de precio en vivo
  const priceInput = div.querySelector('#voeNetPrice');
  priceInput.addEventListener('input', (e) => {
    currentNet = parsePrice(e.target.value) || 0;
    updateCalculatorUI();
  });

  // Botones +/-
  div.querySelectorAll('.voe-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const step = parseFloat(btn.dataset.step);
      if (field === 'passengers') {
        config.passengers = Math.max(1, config.passengers + step);
        div.querySelector('#voePaxInput').value = config.passengers;
      } else if (field === 'margin') {
        config.margin = Math.max(0, parseFloat((config.margin + step).toFixed(2)));
        div.querySelector('#voeMarginInput').value = config.margin;
      } else if (field === 'bok') {
        config.bok = Math.max(0, parseFloat((config.bok + step).toFixed(2)));
        div.querySelector('#voeBokInput').value = config.bok;
      }
      persistConfig();
      updateCalculatorUI();
    });
  });

  // Entradas numéricas directas
  div.querySelector('#voePaxInput').addEventListener('input', (e) => {
    config.passengers = Math.max(1, parseInt(e.target.value) || 1);
    persistConfig();
    updateCalculatorUI();
  });
  div.querySelector('#voeMarginInput').addEventListener('input', (e) => {
    config.margin = Math.max(0, parseFloat(e.target.value) || 0);
    persistConfig();
    updateCalculatorUI();
  });
  div.querySelector('#voeBokInput').addEventListener('input', (e) => {
    config.bok = Math.max(0, parseFloat(e.target.value) || 0);
    persistConfig();
    updateCalculatorUI();
  });

  // Presets de margen
  div.querySelectorAll('.voe-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      config.margin = parseFloat(btn.dataset.preset);
      div.querySelector('#voeMarginInput').value = config.margin;
      persistConfig();
      updateCalculatorUI();
    });
  });

  // Conmutador Total vs Pax
  div.querySelectorAll('.voe-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      config.displayMode = btn.dataset.mode;
      div.querySelectorAll('.voe-switch-btn').forEach(b => b.classList.toggle('active', b === btn));
      persistConfig();
      updateCalculatorUI();
    });
  });

  // Copiar cotización
  const copyBtn = div.querySelector('#voeCopyBtn');
  const copyCard = div.querySelector('#voeFinalCard');
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyQuotation();
  });
  copyCard.addEventListener('click', (e) => {
    if (e.target.closest('#voeCopyBtn')) return;
    copyQuotation();
  });

  updateCalculatorUI(div);
  return div;
}

function updateCalculatorUI(targetEl = popup) {
  if (!targetEl) return;
  const d = calc(currentNet);

  const finalLabel = targetEl.querySelector('#voeFinalLabel');
  const profitLabel = targetEl.querySelector('#voeProfitLabel');
  const modeLabel = targetEl.querySelector('#voeModeLabel');
  const profitModeLabel = targetEl.querySelector('#voeProfitModeLabel');
  const footnote = targetEl.querySelector('#voeFootnote');

  const isTotal = config.displayMode === 'total';
  const modeText = `(${isTotal ? 'Total' : 'Pax'})`;

  if (modeLabel) modeLabel.textContent = modeText;
  if (profitModeLabel) profitModeLabel.textContent = modeText;

  if (!d) {
    if (finalLabel) finalLabel.textContent = 'Error: % ≥ 100';
    if (profitLabel) profitLabel.textContent = '—';
    if (footnote) footnote.textContent = 'La suma de Margen y Bok no puede superar el 100%';
    return;
  }

  const showFinal = isTotal ? d.final : d.finalPax;
  const showProfit = isTotal ? d.profit : d.profitPax;

  if (finalLabel) finalLabel.textContent = `USD ${money(showFinal)}`;
  if (profitLabel) profitLabel.textContent = `USD ${money(showProfit)}`;
  if (footnote) {
    const badgeText = currentMode === 'gwc' ? '✈️ GWC Auto (gwc.glas.travel)' : '📊 Modo Manual';
    footnote.textContent = `${badgeText} · Margen total: ${d.pct.toFixed(1)}% · Fórm.: Neto ÷ (1 - ${(d.pct / 100).toFixed(3)})`;
  }
}

function copyQuotation() {
  const d = calc(currentNet);
  if (!d) return;

  const isTotal = config.displayMode === 'total';
  const price = isTotal ? d.final : d.finalPax;
  const paxText = config.passengers > 1
    ? (isTotal ? `Total para ${config.passengers} pasajeros` : `Por pasajero (grupo de ${config.passengers})`)
    : '1 pasajero';

  const modeText = currentMode === 'gwc' ? ' [GWC]' : ' [Manual]';
  const text = `✈️ Cotización de Vuelo${modeText}: USD ${money(price)} (${paxText})`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopiedFeedback).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showCopiedFeedback();
  } catch (err) {}
  document.body.removeChild(ta);
}

function showCopiedFeedback() {
  const copyBtn = popup?.querySelector('#voeCopyBtn');
  if (copyBtn) {
    copyBtn.textContent = '✓ ¡Copiado!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      if (copyBtn) {
        copyBtn.textContent = '📋 Copiar';
        copyBtn.classList.remove('copied');
      }
    }, 1800);
  }
}

function parsePrice(text) {
  if (!text) return NaN;
  let clean = text.replace(/[^\d.,]/g, '');
  if (clean.includes('.') && clean.includes(',')) {
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length === 3 && parseInt(parts[0]) > 0) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(',', '.');
    }
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parseInt(parts[0]) > 0) {
      clean = clean.replace(/\./g, '');
    }
  }
  return parseFloat(clean);
}

function calc(net) {
  if (!net || net <= 0) return { net: 0, pct: config.margin + config.bok, final: 0, finalPax: 0, profit: 0, profitPax: 0, pax: config.passengers };
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

function persistConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set({
      passengers: config.passengers,
      margin: config.margin,
      bok: config.bok,
      displayMode: config.displayMode
    });
  }, 400);
}

function positionNear(el, rect) {
  let top = rect.bottom + PAD;
  let left = rect.left;
  if (top + POPUP_H_EST > window.innerHeight) top = rect.top - POPUP_H_EST - PAD;
  if (left + POPUP_W > window.innerWidth) left = window.innerWidth - POPUP_W - PAD;
  el.style.top = `${Math.max(PAD, top)}px`;
  el.style.left = `${Math.max(PAD, left)}px`;
}

function makeDraggable(el) {
  const h = el.querySelector('.voe-header');
  if (!h) return;
  h.addEventListener('mousedown', (e) => {
    if (e.target.closest('.voe-close') || e.target.closest('input') || e.target.closest('button')) return;
    const ox = e.clientX, oy = e.clientY;
    const sl = parseInt(el.style.left) || 0, st = parseInt(el.style.top) || 0;

    function onMove(me) {
      el.style.left = `${sl + me.clientX - ox}px`;
      el.style.top = `${st + me.clientY - oy}px`;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function makeResizable(el) {
  const r = el.querySelector('.voe-resize-handle');
  if (!r) return;
  r.addEventListener('mousedown', (e) => {
    const ox = e.clientX;
    const os = parseFloat(el.style.getPropertyValue('--voe-scale')) || 1;

    function onMove(me) {
      const s = Math.max(0.7, Math.min(1.4, os + (me.clientX - ox) / 260));
      el.style.setProperty('--voe-scale', s);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function destroyPopup() {
  if (popup) {
    popup.remove();
    popup = null;
    document.removeEventListener('keydown', onEsc);
  }
}

function onEsc(e) {
  if (e.key === 'Escape') destroyPopup();
}

window.addEventListener('beforeunload', destroyPopup);

init();