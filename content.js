/* ================================================================
   EM FLIGHTS – content.js  v1.0.0
   ================================================================
   - Configuración de Margen y Bok directamente en la tarjeta.
   - Switcher Total / Por Pasajero con aria-pressed.
   - Redimensionable y arrastrable.
   - Validación cruzada con estado de error editable.
   - Seguridad: sender.id, storage sanitizado, debounce.
   ================================================================ */

'use strict';

// ── Constantes ──────────────────────────────────────────────────────
const POPUP_W    = 290;
const POPUP_H_EST = 340;
const PAD        = 12;
const DEBOUNCE   = 300;

// ── Estado ──────────────────────────────────────────────────────────
let config     = { passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' };
let popup      = null;
let observer   = null;
let debTimer   = null;
let saveTimer  = null;  // debounce para escrituras a storage
let currentNet = null;  // precio activo (fuera del DOM para no exponerlo al host)

const dragCleanupMap = new WeakMap();

// ── Init ─────────────────────────────────────────────────────────────
async function init() {
  try {
    const st = await chrome.storage.sync.get({ passengers:1, margin:10, bok:0.8, enabled:true, displayMode:'total' });
    // Sanitizar valores al cargar — defensa ante corrupción de storage
    config.margin      = Math.max(0,  Math.min(95, parseFloat(st.margin)      || 10));
    config.bok         = Math.max(0,  Math.min(95, parseFloat(st.bok)         || 0.8));
    config.passengers  = Math.max(1,  Math.min(20, parseInt(st.passengers)    || 1));
    config.enabled     = typeof st.enabled === 'boolean' ? st.enabled : true;
    config.displayMode = ['total','pax'].includes(st.displayMode) ? st.displayMode : 'total';
  } catch(e) {
    console.warn('[EM Flights] No se pudo cargar config:', e.message || 'Error desconocido');
  }
  if (config.enabled) {
    bindPrices();
    startObserver();
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id) return; // solo mensajes internos
  if (msg.type === 'CONFIG_UPDATED') {
    if (msg.config.passengers !== undefined) config.passengers = msg.config.passengers;
    config.enabled = true;
    if (popup && popup.isConnected && currentNet > 0) {
      renderPopupBody(); // Full re-render when passengers change
    }
    bindPrices();
  } else if (msg.type === 'TOGGLE_STATE') {
    config.enabled = msg.enabled;
    if (!config.enabled) {
      destroyPopup();
      unbindPrices();
      if (observer) { observer.disconnect(); observer = null; }
    } else {
      bindPrices();
      startObserver();
    }
  }
});

function parsePrice(text) {
  if (!text) return NaN;
  const clean = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
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
    pax      : config.passengers,
    userPct  : config.margin,
  };
}

function money(n) {
  return isNaN(n) ? '—' : Math.round(n).toLocaleString('es-UY', { maximumFractionDigits: 0 });
}

function bindPrices() {
  document.querySelectorAll('.priceNumb').forEach(el => {
    if (el.dataset.voeBound) return;
    el.dataset.voeBound = '1';
    el.style.cursor = 'pointer';
    el.title = 'Clic para calcular margen — EM Flights';
    el.addEventListener('click', onPriceClick);
  });
}

function unbindPrices() {
  document.querySelectorAll('.priceNumb[data-voe-bound]').forEach(el => {
    delete el.dataset.voeBound;
    el.style.cursor = '';
    el.title = '';
    el.removeEventListener('click', onPriceClick);
  });
}

function onPriceClick(e) {
  if (!config.enabled) return;
  const el = e.currentTarget;
  if (!el || !el.isConnected) return;

  const net = parsePrice(el.textContent);
  if (isNaN(net) || net <= 0) return;
  // No bloqueamos si calc() devuelve null — renderPopupBody muestra el estado de error

  if (popup && popup.isConnected) {
    currentNet = net;
    refreshPopupData(net);
  } else {
    popup = createPopup(net);
    document.body.appendChild(popup);
    positionPopup(popup, el.getBoundingClientRect());
    makeDraggable(popup);
    makeResizable(popup);
    document.addEventListener('keydown', onEsc);
  }
}

function refreshPopupData(net) {
  if (!popup) return;
  currentNet = net;
  const body = popup.querySelector('.voe-body');
  if (!body) return;

  body.style.opacity = '0.5';
  body.style.transition = 'opacity 0.1s';
  setTimeout(() => {
    renderPopupBody();
    body.style.opacity = '1';
  }, 90);
}

function createPopup(net) {
  const div = document.createElement('div');
  div.className = 'voe-popup';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-label', 'Calculadora EM Flights');

  div.innerHTML = `
    <div class="voe-header">
      <div class="voe-brand">
        <div class="voe-brand-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="voe-brand-name">EM Flights</span>
      </div>
      <div class="voe-header-right">
        <div class="voe-drag-dots">⠿</div>
        <button class="voe-close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="voe-body"></div>
    <div class="voe-resize-handle">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <line x1="8" y1="12" x2="12" y2="8"/>
        <line x1="4" y1="12" x2="12" y2="4"/>
      </svg>
    </div>
  `;

  div.querySelector('.voe-close').addEventListener('click', (e) => {
    e.stopPropagation();
    destroyPopup();
  });

  // Render content — currentNet debe estar asignado antes de llamar a renderPopupBody
  popup = div;
  currentNet = net;
  renderPopupBody();

  return div;
}

function renderPopupBody() {
  if (!popup) return;
  const body = popup.querySelector('.voe-body');
  if (!body) return;
  const d = calc(currentNet);
  if (!d) {
    // Porcentajes inválidos — mostramos error + inputs para corrección en el lugar
    body.innerHTML = `
      <div class="voe-error-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p class="voe-error-title">Porcentaje inválido</p>
        <p class="voe-error-sub">La suma no puede alcanzar el 100%. Corríjalo aquí:</p>
      </div>
      <div class="voe-section">
        <div class="voe-row">
          <span class="voe-row-label">Pasajeros</span>
          <div class="voe-input-group">
            <button class="voe-step-btn" data-input="voePax" data-dir="-1">−</button>
            <input type="number" id="voePax" class="voe-input voe-input-err" value="${config.passengers}" min="1" max="20">
            <button class="voe-step-btn" data-input="voePax" data-dir="1">+</button>
          </div>
        </div>
        <div class="voe-row">
          <span class="voe-row-label">Margen operativo (%)</span>
          <div class="voe-input-group">
            <button class="voe-step-btn" data-input="voeMargin" data-dir="-1">−</button>
            <input type="number" id="voeMargin" class="voe-input voe-input-err" value="${config.margin}" step="0.1" min="0" max="95">
            <button class="voe-step-btn" data-input="voeMargin" data-dir="1">+</button>
          </div>
        </div>
        <div class="voe-row">
          <span class="voe-row-label">Bok/Arancel (%)</span>
          <div class="voe-input-group">
            <button class="voe-step-btn" data-input="voeBok" data-dir="-1">−</button>
            <input type="number" id="voeBok" class="voe-input voe-input-err" value="${config.bok}" step="0.1" min="0" max="95">
            <button class="voe-step-btn" data-input="voeBok" data-dir="1">+</button>
          </div>
        </div>
        <div class="voe-row voe-row-total">
          <span class="voe-row-label">Total incluido</span>
          <span class="voe-row-val voe-val-err">${(config.margin + config.bok).toFixed(2)}%</span>
        </div>
      </div>
    `;
    const mIn = body.querySelector('#voeMargin');
    const bIn = body.querySelector('#voeBok');
    const pIn = body.querySelector('#voePax');
    if (mIn) mIn.addEventListener('input', onInputChange);
    if (bIn) bIn.addEventListener('input', onInputChange);
    if (pIn) pIn.addEventListener('input', onInputChange);
    return;
  }

  const isTotal = config.displayMode === 'total';
  const subtitle = isTotal ? 'Total' : 'Por persona';
  const mainFinal = isTotal ? d.final : d.finalPax;
  const mainProfit = isTotal ? d.profit : d.profitPax;

  // Solo restaurar foco si el elemento activo es un input propio de la extensión
  // (evita pasar IDs externos al querySelector, previniendo selector injection)
  const OWN_INPUT_IDS = ['voeMargin', 'voeBok', 'voePax'];
  const activeId = document.activeElement && OWN_INPUT_IDS.includes(document.activeElement.id)
    ? document.activeElement.id
    : null;

  body.innerHTML = `
    <div class="voe-info-row">
      <div class="voe-info-chip">
        <span class="voe-chip-label">Precio del vuelo</span>
        <span class="voe-chip-value">USD ${money(d.net)}</span>
      </div>
    </div>

    <!-- Switcher -->
    <div class="voe-switcher">
      <button class="voe-switch-btn ${isTotal ? 'active' : ''}" data-mode="total" aria-pressed="${isTotal}">Total</button>
      <button class="voe-switch-btn ${!isTotal ? 'active' : ''}" data-mode="pax" aria-pressed="${!isTotal}">Por Pasajero</button>
    </div>

    <div class="voe-section">
      <div class="voe-row">
        <span class="voe-row-label">Pasajeros</span>
        <div class="voe-input-group">
          <button class="voe-step-btn" data-input="voePax" data-dir="-1">−</button>
          <input type="number" id="voePax" class="voe-input" value="${config.passengers}" min="1" max="20">
          <button class="voe-step-btn" data-input="voePax" data-dir="1">+</button>
        </div>
      </div>
      <div class="voe-row">
        <span class="voe-row-label">Margen operativo (%)</span>
        <div class="voe-input-group">
          <button class="voe-step-btn" data-input="voeMargin" data-dir="-1">−</button>
          <input type="number" id="voeMargin" class="voe-input" value="${config.margin}" step="0.1" min="0" max="95">
          <button class="voe-step-btn" data-input="voeMargin" data-dir="1">+</button>
        </div>
      </div>
      <div class="voe-row">
        <span class="voe-row-label">Bok/Arancel (%)</span>
        <div class="voe-input-group">
          <button class="voe-step-btn" data-input="voeBok" data-dir="-1">−</button>
          <input type="number" id="voeBok" class="voe-input" value="${config.bok}" step="0.1" min="0" max="95">
          <button class="voe-step-btn" data-input="voeBok" data-dir="1">+</button>
        </div>
      </div>
      <div class="voe-row voe-row-total">
        <span class="voe-row-label">Total incluido</span>
        <span class="voe-row-val" id="voePctVal">${d.pct.toFixed(2)}%</span>
      </div>
    </div>

    <!-- Tarjeta: precio a cobrar -->
    <div class="voe-card voe-card-blue">
      <div class="voe-card-left">
        <div class="voe-card-title">Precio final al cliente <span class="voe-card-badge">${subtitle}</span></div>
        <div class="voe-card-main" id="voeFinalMain">USD ${money(mainFinal)}</div>
      </div>
      <div class="voe-card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <rect x="1" y="4" width="22" height="16" rx="2"/>
          <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      </div>
    </div>

    <!-- Tarjeta: ganancia -->
    <div class="voe-card voe-card-green">
      <div class="voe-card-left">
        <div class="voe-card-title">Ganancia neta <span class="voe-card-badge">${subtitle}</span></div>
        <div class="voe-card-main" id="voeProfitMain">USD ${money(mainProfit)}</div>
      </div>
      <div class="voe-card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      </div>
    </div>

    <div class="voe-hint">Seleccione otro precio para recalcular</div>
  `;

  // Restore focus if any
  if (activeId && popup.querySelector('#' + activeId)) {
    popup.querySelector('#' + activeId).focus();
  }

  // Attach listeners
  popup.querySelectorAll('.voe-switch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      config.displayMode = e.target.dataset.mode;
      chrome.storage.sync.set({ displayMode: config.displayMode });
      renderPopupBody();
    });
  });

  const mIn = popup.querySelector('#voeMargin');
  const bIn = popup.querySelector('#voeBok');
  const pIn = popup.querySelector('#voePax');
  if (mIn) mIn.addEventListener('input', onInputChange);
  if (bIn) bIn.addEventListener('input', onInputChange);
  if (pIn) pIn.addEventListener('input', onInputChange);

  popup.querySelectorAll('.voe-step-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const inputId = e.target.dataset.input;
      const dir = parseInt(e.target.dataset.dir);
      const input = popup.querySelector('#' + inputId);
      if (input) {
        let val = (parseFloat(input.value) || 0) + dir;
        input.value = val;
        // Disparar evento input manualmente para que se ejecute onInputChange
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
}

function onInputChange(e) {
  let val = parseFloat(e.target.value);
  if (isNaN(val)) return;
  if (val < 0) val = 0;
  if (val > 95) val = 95;

  if (e.target.id === 'voeMargin') config.margin = val;
  if (e.target.id === 'voeBok') config.bok = val;
  if (e.target.id === 'voePax') {
    if (val < 1) val = 1;
    if (val > 20) val = 20;
    config.passengers = val;
  }

  // Debounce 400ms — evita superar la cuota de storage.sync (120 ops/min)
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set({ margin: config.margin, bok: config.bok, passengers: config.passengers })
      .catch(err => console.warn('[EM Flights] Error al guardar config:', err.message));
  }, 400);

  // Validación cruzada: si la suma supera 100%, mostrar estado de error
  if (config.margin + config.bok >= 100) {
    renderPopupBody(); // Triggereará el bloque de error dentro de renderPopupBody
    return;
  }

  // Actualización parcial (sin re-render completo) para conservar foco
  const d = calc(currentNet);
  if (!d) return;

  const isTotal = config.displayMode === 'total';
  const mainFinal = isTotal ? d.final : d.finalPax;
  const mainProfit = isTotal ? d.profit : d.profitPax;

  const pctEl = popup.querySelector('#voePctVal');
  const finalEl = popup.querySelector('#voeFinalMain');
  const profitEl = popup.querySelector('#voeProfitMain');

  if (pctEl) pctEl.textContent = d.pct.toFixed(2) + '%';
  if (finalEl) finalEl.textContent = 'USD ' + money(mainFinal);
  if (profitEl) profitEl.textContent = 'USD ' + money(mainProfit);
}

function positionPopup(el, rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top  = rect.bottom + PAD;
  let left = rect.left;
  if (top + POPUP_H_EST > vh - PAD) top = rect.top - POPUP_H_EST - PAD;
  if (top < PAD) top = PAD;
  if (left + POPUP_W > vw - PAD) left = vw - POPUP_W - PAD;
  if (left < PAD) left = PAD;
  el.style.top  = `${top}px`;
  el.style.left = `${left}px`;
}

function makeDraggable(el) {
  const header = el.querySelector('.voe-header');
  if (!header) return;
  let dragging = false;
  let ox = 0, oy = 0, startL = 0, startT = 0;

  function onDown(e) {
    if (e.target.closest('.voe-close')) return;
    if (e.button !== 0) return;
    dragging = true;
    ox = e.clientX; oy = e.clientY;
    startL = parseInt(el.style.left) || 0;
    startT = parseInt(el.style.top)  || 0;
    header.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    const rect = el.getBoundingClientRect();
    const pw = rect.width  || POPUP_W;
    const ph = rect.height || POPUP_H_EST;
    const newL = Math.max(PAD, Math.min(startL + e.clientX - ox, window.innerWidth  - pw - PAD));
    const newT = Math.max(PAD, Math.min(startT + e.clientY - oy, window.innerHeight - ph - PAD));
    el.style.left = `${newL}px`;
    el.style.top  = `${newT}px`;
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    header.style.cursor = 'grab';
    document.body.style.userSelect = '';
  }

  header.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  dragCleanupMap.set(el, () => {
    header.removeEventListener('mousedown', onDown);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
  });
}

function makeResizable(el) {
  const handle = el.querySelector('.voe-resize-handle');
  if (!handle) return;
  
  let resizing = false;
  let ox = 0, startScale = 1;
  
  function onDown(e) {
    if (e.button !== 0) return;
    resizing = true;
    ox = e.clientX;
    startScale = parseFloat(el.style.getPropertyValue('--voe-scale')) || 1;
    document.body.style.userSelect = 'none';
    e.stopPropagation();
    e.preventDefault();
  }
  
  function onMove(e) {
    if (!resizing) return;
    const deltaX = e.clientX - ox;
    const newScale = Math.max(0.6, Math.min(1.8, startScale + (deltaX / POPUP_W)));
    el.style.setProperty('--voe-scale', newScale);
  }
  
  function onUp() {
    if (!resizing) return;
    resizing = false;
    document.body.style.userSelect = '';
  }
  
  handle.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  
  const oldCleanup = dragCleanupMap.get(el);
  dragCleanupMap.set(el, () => {
    if (oldCleanup) oldCleanup();
    handle.removeEventListener('mousedown', onDown);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  });
}

function destroyPopup() {
  if (!popup) return;
  const cleanup = dragCleanupMap.get(popup);
  if (cleanup) { cleanup(); dragCleanupMap.delete(popup); }
  clearTimeout(debTimer);
  clearTimeout(saveTimer);
  popup.remove();
  popup = null;
  document.removeEventListener('keydown', onEsc);
}

function onEsc(e) {
  if (e.key === 'Escape') destroyPopup();
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    const relevant = mutations.some(m =>
      ![...m.addedNodes, ...m.removedNodes].every(n =>
        n.classList && n.classList.contains('voe-popup')
      )
    );
    if (!relevant) return;

    clearTimeout(debTimer);
    debTimer = setTimeout(bindPrices, DEBOUNCE);
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', init);
else
  init();
