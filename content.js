/* ================================================================
   EM FLIGHTS – content.js  v2.1.2
   Calculadora EM (Centrada en Pantalla) + Descuento Millas Itaú Volar
   ================================================================ */

'use strict';

const POPUP_W = 330;
const POPUP_H_EST = 460;
const PAD = 14;

let config = {
  passengers: 1,
  margin: 10,
  bok: 0.8,
  enabled: true,
  displayMode: 'total',
  itauMileValue: 0.0125,
  itauMinMiles: 5000,
  itauMiles: 0
};

let popup = null;
let currentNet = 0;
let currentMode = 'manual'; // 'gwc' o 'manual'
let saveTimer = null;

async function init() {
  console.log('[EM Flights] Starting v2.1.2...');

  try {
    const st = await chrome.storage.sync.get({
      passengers: 1,
      margin: 10,
      bok: 0.8,
      enabled: true,
      displayMode: 'total',
      itauMileValue: 0.0125,
      itauMinMiles: 5000
    });
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
      showCalculator(net, 'gwc');
    }
  }
}

// Mensajes recibidos desde popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === 'TOGGLE_STATE') {
    config.enabled = msg.enabled;
    if (!config.enabled && popup) destroyPopup();
    if (sendResponse) sendResponse({ ok: true });
  } else if (msg.type === 'OPEN_MANUAL_CALC') {
    config = { ...config, ...msg.config };
    showCalculator(currentNet || 0, 'manual');
    if (sendResponse) sendResponse({ ok: true });
  } else if (msg.type === 'CONFIG_UPDATED') {
    config = { ...config, ...msg.config };
    updateCalculatorUI();
    if (sendResponse) sendResponse({ ok: true });
  }
  return true;
});

// REQUISITO CRÍTICO: Cada vez que se abre, se posiciona en el CENTRO de la pantalla
function showCalculator(netValue, mode = 'manual') {
  currentNet = netValue || 0;
  currentMode = mode;

  if (popup && popup.isConnected) {
    const priceInput = popup.querySelector('#voeNetPrice');
    if (priceInput) priceInput.value = currentNet > 0 ? currentNet : '';
    applyModeToDOM(popup, mode);
    updateCalculatorUI();
    positionCenter(popup);
    return;
  }

  popup = renderCalculatorDOM(currentNet, mode);
  document.body.appendChild(popup);

  // Posicionar siempre en el centro exacto
  positionCenter(popup);

  makeDraggable(popup);
  makeResizable(popup);
  document.addEventListener('keydown', onEsc);

  // Foco en precio si es manual y está vacío
  if (mode === 'manual' && (!netValue || netValue <= 0)) {
    setTimeout(() => {
      const field = popup.querySelector('#voeNetPrice');
      if (field) field.focus();
    }, 100);
  }
}

function positionCenter(el) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth || POPUP_W;
  const h = el.offsetHeight || POPUP_H_EST;
  el.style.left = `${Math.max(PAD, Math.round((vw - w) / 2))}px`;
  el.style.top = `${Math.max(PAD, Math.round((vh - h) / 2))}px`;
}

function applyModeToDOM(el, mode) {
  const isGwc = mode === 'gwc';
  const badge = el.querySelector('#voeBadge');
  const netLabel = el.querySelector('#voeNetLabel');
  const footerNote = el.querySelector('#voeFooterNote');

  if (badge) {
    badge.className = `voe-badge-pill ${isGwc ? 'voe-badge-gwc' : 'voe-badge-manual'}`;
    badge.textContent = isGwc ? '✈️ GWC' : '📊 Manual';
  }
  if (netLabel) {
    netLabel.textContent = isGwc ? 'NETO GWC' : 'NETO MANUAL';
  }
  if (footerNote) {
    footerNote.textContent = isGwc ? 'CALCULADO SEGUN PARAMETROS GWC V2.4' : 'CALCULADORA MANUAL INDEPENDIENTE V2.1.2';
  }
}

function renderCalculatorDOM(initialNet, mode) {
  const isGwc = mode === 'gwc';
  const div = document.createElement('div');
  div.className = 'voe-popup';
  div.style.setProperty('--voe-scale', '1');

  div.innerHTML = `
    <!-- Header -->
    <div class="voe-header">
      <div class="voe-brand">
        <img class="voe-brand-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Logo">
        <div class="voe-brand-info">
          <span class="voe-brand-name">Calculadora EM</span>
          <span class="voe-badge-pill ${isGwc ? 'voe-badge-gwc' : 'voe-badge-manual'}" id="voeBadge">
            ${isGwc ? '✈️ GWC' : '📊 Manual'}
          </span>
        </div>
      </div>
      <button class="voe-close" title="Cerrar [ESC]">✕</button>
    </div>

    <!-- Fila 1: Neto GWC / Pasajeros -->
    <div class="voe-grid-row">
      <div class="voe-mini-card">
        <span class="voe-mini-label" id="voeNetLabel">${isGwc ? 'NETO GWC' : 'NETO MANUAL'}</span>
        <div class="voe-net-value-wrap">
          <span class="voe-net-curr">USD</span>
          <input type="text" id="voeNetPrice" class="voe-net-input"
                 value="${initialNet > 0 ? initialNet : ''}" placeholder="0" inputmode="decimal">
        </div>
      </div>

      <div class="voe-mini-card">
        <span class="voe-mini-label">PASAJEROS</span>
        <div class="voe-stepper">
          <button class="voe-btn-step" data-field="passengers" data-step="-1">−</button>
          <input type="number" id="voePaxInput" class="voe-step-val-input"
                 value="${config.passengers}" min="1" step="1">
          <button class="voe-btn-step" data-field="passengers" data-step="1">+</button>
        </div>
      </div>
    </div>

    <!-- Fila 2: TOTAL / POR PAX -->
    <div class="voe-switcher">
      <button class="voe-switch-btn ${config.displayMode === 'total' ? 'active' : ''}" data-mode="total">TOTAL</button>
      <button class="voe-switch-btn ${config.displayMode === 'pax' ? 'active' : ''}" data-mode="pax">POR PAX</button>
    </div>

    <!-- Fila 3: Margen (%) / Bok (%) -->
    <div class="voe-grid-row">
      <div class="voe-mini-card">
        <span class="voe-mini-label">MARGEN (%)</span>
        <div class="voe-stepper">
          <button class="voe-btn-step" data-field="margin" data-step="-0.5">−</button>
          <input type="number" id="voeMarginInput" class="voe-step-val-input"
                 value="${config.margin}" step="0.5" min="0">
          <button class="voe-btn-step" data-field="margin" data-step="0.5">+</button>
        </div>
      </div>

      <div class="voe-mini-card">
        <span class="voe-mini-label">BOK (%)</span>
        <div class="voe-stepper">
          <button class="voe-btn-step" data-field="bok" data-step="-0.1">−</button>
          <input type="number" id="voeBokInput" class="voe-step-val-input"
                 value="${config.bok}" step="0.1" min="0">
          <button class="voe-btn-step" data-field="bok" data-step="0.1">+</button>
        </div>
      </div>
    </div>

    <!-- Fila 4: Tarjeta de Millas Itaú Volar -->
    <div class="voe-itau-box">
      <div class="voe-itau-box-header">
        <span class="voe-itau-box-title">💳 Millas Itaú Volar</span>
        <span class="voe-itau-box-badge" id="voeItauDiscountTag">Sin canje</span>
      </div>
      <div class="voe-itau-controls">
        <div class="voe-itau-stepper">
          <button class="voe-btn-itau-step" id="voeItauMinus">−</button>
          <input type="number" id="voeItauMilesInput" class="voe-itau-miles-input"
                 value="${config.itauMiles || 0}" step="1000" min="0" placeholder="0">
          <button class="voe-btn-itau-step" id="voeItauPlus">+</button>
        </div>
        <div class="voe-itau-quick-chips">
          <button class="voe-itau-chip" data-miles="0">0</button>
          <button class="voe-itau-chip" data-miles="5000">5K</button>
          <button class="voe-itau-chip" data-miles="10000">10K</button>
          <button class="voe-itau-chip" data-miles="15000">15K</button>
          <button class="voe-itau-chip" data-miles="20000">20K</button>
        </div>
      </div>
      <div class="voe-itau-msg" id="voeItauStatus">
        Mínimo 5.000 millas para aplicar descuento
      </div>
    </div>

    <!-- Fila 5: Tarjeta Azul (Precio final al cliente / Total a pagar con millas) -->
    <div class="voe-banner-blue" id="voeFinalBanner" title="Clic para copiar cotización">
      <div class="voe-banner-blue-title" id="voeFinalTitle">
        PRECIO FINAL AL CLIENTE <span id="voeModeLabel">(${config.displayMode === 'total' ? 'Total' : 'Pax'})</span>
      </div>
      <div class="voe-banner-blue-val" id="voeFinalLabel">USD 0</div>
      <div class="voe-banner-subline" id="voeBannerSubline" style="display: none;"></div>
      <div class="voe-copied-hint" id="voeCopyHint" style="display: none;">✓ ¡COPIADO AL PORTAPAPELES!</div>
    </div>

    <!-- Fila 6: Tarjeta Verde (Ganancia neta) -->
    <div class="voe-banner-green">
      <div class="voe-banner-green-title">
        GANANCIA NETA <span id="voeProfitModeLabel">(${config.displayMode === 'total' ? 'Total' : 'Pax'})</span>
      </div>
      <div class="voe-banner-green-val" id="voeProfitLabel">USD 0</div>
    </div>

    <!-- Footer -->
    <div class="voe-footer-note" id="voeFooterNote">
      ${isGwc ? 'CALCULADO SEGUN PARAMETROS GWC V2.4' : 'CALCULADORA MANUAL INDEPENDIENTE V2.1.2'}
    </div>

    <div class="voe-resize-handle" title="Arrastra para redimensionar"></div>
  `;

  // Cerrar
  div.querySelector('.voe-close').onclick = destroyPopup;

  // Entrada de precio editable en vivo
  const priceInput = div.querySelector('#voeNetPrice');
  priceInput.addEventListener('input', (e) => {
    currentNet = parsePrice(e.target.value) || 0;
    updateCalculatorUI();
  });

  // Botones +/- generales
  div.querySelectorAll('.voe-btn-step').forEach(btn => {
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

  // Controles de Millas Itaú Volar
  const itauMilesInput = div.querySelector('#voeItauMilesInput');
  const itauMinusBtn = div.querySelector('#voeItauMinus');
  const itauPlusBtn = div.querySelector('#voeItauPlus');

  itauMilesInput.addEventListener('input', (e) => {
    config.itauMiles = Math.max(0, parseInt(e.target.value) || 0);
    updateCalculatorUI();
  });

  itauMinusBtn.addEventListener('click', () => {
    config.itauMiles = Math.max(0, (config.itauMiles || 0) - 1000);
    itauMilesInput.value = config.itauMiles;
    updateCalculatorUI();
  });

  itauPlusBtn.addEventListener('click', () => {
    config.itauMiles = (config.itauMiles || 0) + 1000;
    itauMilesInput.value = config.itauMiles;
    updateCalculatorUI();
  });

  div.querySelectorAll('.voe-itau-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      config.itauMiles = parseInt(chip.dataset.miles) || 0;
      itauMilesInput.value = config.itauMiles;
      updateCalculatorUI();
    });
  });

  // Conmutador TOTAL / POR PAX
  div.querySelectorAll('.voe-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      config.displayMode = btn.dataset.mode;
      div.querySelectorAll('.voe-switch-btn').forEach(b => b.classList.toggle('active', b === btn));
      persistConfig();
      updateCalculatorUI();
    });
  });

  // Copiar cotización al hacer clic en la tarjeta azul
  div.querySelector('#voeFinalBanner').addEventListener('click', () => {
    copyQuotation();
  });

  updateCalculatorUI(div);
  return div;
}

function updateCalculatorUI(targetEl = popup) {
  if (!targetEl) return;
  const d = calc(currentNet);

  const finalTitle = targetEl.querySelector('#voeFinalTitle');
  const finalLabel = targetEl.querySelector('#voeFinalLabel');
  const bannerSubline = targetEl.querySelector('#voeBannerSubline');
  const profitLabel = targetEl.querySelector('#voeProfitLabel');
  const modeLabel = targetEl.querySelector('#voeModeLabel');
  const profitModeLabel = targetEl.querySelector('#voeProfitModeLabel');

  const itauTag = targetEl.querySelector('#voeItauDiscountTag');
  const itauStatus = targetEl.querySelector('#voeItauStatus');
  const itauChips = targetEl.querySelectorAll('.voe-itau-chip');

  const isTotal = config.displayMode === 'total';
  const modeText = `(${isTotal ? 'Total' : 'Pax'})`;

  if (modeLabel) modeLabel.textContent = modeText;
  if (profitModeLabel) profitModeLabel.textContent = modeText;

  // Actualizar chips activos de millas
  if (itauChips) {
    itauChips.forEach(chip => {
      chip.classList.toggle('active', parseInt(chip.dataset.miles) === (config.itauMiles || 0));
    });
  }

  if (!d) {
    if (finalLabel) finalLabel.textContent = 'Error: % ≥ 100';
    if (profitLabel) profitLabel.textContent = '—';
    return;
  }

  // Estado del Descuento Itaú Volar
  if (itauTag && itauStatus) {
    if (d.itauDiscount > 0) {
      itauTag.textContent = `- USD ${money(d.itauDiscount)}`;
      itauTag.className = 'voe-itau-box-badge active';
      itauStatus.textContent = `✓ Descuento de USD ${money(d.itauDiscount)} aplicado (-$${(d.miles * d.mileValue).toFixed(2)})`;
      itauStatus.className = 'voe-itau-msg ok';
    } else if (d.miles > 0 && d.miles < d.minMiles) {
      itauTag.textContent = 'Mín. 5.000';
      itauTag.className = 'voe-itau-box-badge';
      itauStatus.textContent = `⚠️ Requiere mínimo ${d.minMiles.toLocaleString('es-UY')} millas (ingresadas: ${d.miles.toLocaleString('es-UY')})`;
      itauStatus.className = 'voe-itau-msg warning';
    } else {
      itauTag.textContent = 'Sin canje';
      itauTag.className = 'voe-itau-box-badge';
      itauStatus.textContent = `Mínimo ${d.minMiles.toLocaleString('es-UY')} millas · Valor: USD ${d.mileValue}/milla`;
      itauStatus.className = 'voe-itau-msg';
    }
  }

  // Valores de Precio Final y Desglose
  const showFinal = isTotal ? d.final : d.finalPax;
  const showFinalToPay = isTotal ? d.finalToPay : d.finalToPayPax;
  const showProfit = isTotal ? d.profit : d.profitPax;

  if (d.itauDiscount > 0) {
    if (finalTitle) {
      finalTitle.innerHTML = `TOTAL A COBRAR (CON MILLAS) <span id="voeModeLabel">${modeText}</span>`;
    }
    if (finalLabel) {
      finalLabel.textContent = `USD ${money(showFinalToPay)}`;
    }
    if (bannerSubline) {
      bannerSubline.style.display = 'block';
      bannerSubline.textContent = `Tarifa base: USD ${money(showFinal)} · Descuento: -USD ${money(d.itauDiscount)} (${d.miles.toLocaleString('es-UY')} millas)`;
    }
  } else {
    if (finalTitle) {
      finalTitle.innerHTML = `PRECIO FINAL AL CLIENTE <span id="voeModeLabel">${modeText}</span>`;
    }
    if (finalLabel) {
      finalLabel.textContent = `USD ${money(showFinal)}`;
    }
    if (bannerSubline) {
      bannerSubline.style.display = 'none';
      bannerSubline.textContent = '';
    }
  }

  if (profitLabel) profitLabel.textContent = `USD ${money(showProfit)}`;
}

function copyQuotation() {
  const d = calc(currentNet);
  if (!d) return;

  const isTotal = config.displayMode === 'total';
  const price = isTotal ? (d.itauDiscount > 0 ? d.finalToPay : d.final) : (d.itauDiscount > 0 ? d.finalToPayPax : d.finalPax);
  const paxText = config.passengers > 1
    ? (isTotal ? `Total para ${config.passengers} pasajeros` : `Por pasajero (grupo de ${config.passengers})`)
    : '1 pasajero';

  const modeText = currentMode === 'gwc' ? ' [GWC]' : ' [Manual]';
  let text = `✈️ Cotización de Vuelo${modeText}: USD ${money(price)} (${paxText})`;

  if (d.itauDiscount > 0) {
    const basePrice = isTotal ? d.final : d.finalPax;
    text += ` [Incluye descuento Itaú Volar: -USD ${money(d.itauDiscount)} por ${d.miles.toLocaleString('es-UY')} millas | Tarifa sin millas: USD ${money(basePrice)}]`;
  }

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
  const hint = popup?.querySelector('#voeCopyHint');
  if (hint) {
    hint.style.display = 'block';
    setTimeout(() => {
      if (hint) hint.style.display = 'none';
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
  if (!net || net <= 0) {
    return {
      net: 0,
      pct: config.margin + config.bok,
      final: 0,
      finalPax: 0,
      profit: 0,
      profitPax: 0,
      pax: config.passengers,
      miles: config.itauMiles || 0,
      minMiles: config.itauMinMiles !== undefined ? config.itauMinMiles : 5000,
      mileValue: config.itauMileValue !== undefined ? config.itauMileValue : 0.0125,
      itauDiscount: 0,
      finalToPay: 0,
      finalToPayPax: 0
    };
  }

  const pct = config.margin + config.bok;
  if (pct >= 100) return null;
  const final = net / (1 - pct / 100);
  const profit = final - net;

  // Descuento de Millas Itaú Volar
  // "se descuenta sobre el valor total del pasaje. se requiere un minimo de 5000 millas y cada milla tiene un valor de 0,0125"
  let itauDiscount = 0;
  const miles = config.itauMiles || 0;
  const minMiles = config.itauMinMiles !== undefined ? config.itauMinMiles : 5000;
  const mileValue = config.itauMileValue !== undefined ? config.itauMileValue : 0.0125;

  if (miles >= minMiles) {
    itauDiscount = miles * mileValue;
  }

  const finalToPay = Math.max(0, final - itauDiscount);

  return {
    net,
    pct,
    final,
    finalPax: final / config.passengers,
    profit,
    profitPax: profit / config.passengers,
    pax: config.passengers,
    miles,
    minMiles,
    mileValue,
    itauDiscount,
    finalToPay,
    finalToPayPax: finalToPay / config.passengers
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