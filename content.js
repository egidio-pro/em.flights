/* ================================================================
   EM FLIGHTS – content.js  v2.1.2
   Calculadora EM (Centrada en Pantalla) + Descuento Millas Itaú Volar
   ================================================================ */

'use strict';

const POPUP_W = 320;
const POPUP_H_EST = 360;
const PAD = 12;

let config = {
  passengers: 1,
  margin: 10,
  bok: 0.8,
  enabled: true,
  displayMode: 'total',
  itauMileValue: 0.0125,
  itauMinMiles: 5000,
  itauMiles: 0,
  itauActive: false
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
      itauMinMiles: 5000,
      itauMiles: 0,
      itauActive: false
    });
    config = { ...config, ...st };

    document.addEventListener('click', onDocClick, true);
    console.log('[EM Flights] Click listener active (GWC automatic detection)');
  } catch (e) {
    console.error('[EM Flights] Init error:', e);
    setTimeout(init, 1000);
  }
}

// Verifica si la página actual corresponde a GWC (gwc.glas.travel)
function isGwcPage() {
  const host = window.location.hostname || '';
  const href = window.location.href || '';
  return host === 'gwc.glas.travel' ||
         host.endsWith('.gwc.glas.travel') ||
         href.includes('gwc.glas.travel/search') ||
         href.includes('gwc.glas.travel');
}

// Detección automática inteligente de cantidad de pasajeros en GWC (gwc.glas.travel)
function detectGwcPassengers(priceEl) {
  // Función auxiliar robusta para leer el valor numérico de un input en GWC
  function readGwcInputValue(input, defaultVal) {
    if (!input) return defaultVal;
    // 1. Propiedad JavaScript directa (lo que el usuario tipeó o Blazor fijó en runtime)
    if (input.value !== undefined && input.value !== null) {
      const v = String(input.value).trim();
      if (v !== '') {
        const n = parseInt(v, 10);
        if (!isNaN(n)) return n;
      }
    }
    // 2. Atributo HTML value
    const attr = input.getAttribute('value');
    if (attr !== null && attr !== undefined && attr.trim() !== '') {
      const n = parseInt(attr.trim(), 10);
      if (!isNaN(n)) return n;
    }
    // 3. Atributo placeholder (ej. placeholder="1" para Adultos, placeholder="0" para Niños/Infants)
    const ph = input.placeholder ? input.placeholder.trim() : '';
    if (ph !== '') {
      const n = parseInt(ph, 10);
      if (!isNaN(n)) return n;
    }
    return defaultVal;
  }

  // 1. PRIORIDAD MÁXIMA: Formulario de búsqueda principal de GWC (Adultos, Niños, Infants)
  // Estructura oficial de GWC:
  // <div class="input-type ..."><div class="input-cont"><span class="floating-label">Adultos</span><input class="search-input" data-mask="00" placeholder="1"></div></div>
  try {
    let adults = null;
    let children = null;
    let infants = null;

    // Método 1A: Recorrer contenedores .input-cont y .input-type
    const conts = document.querySelectorAll('.input-cont, .input-type');
    for (const cont of conts) {
      if (cont.closest('.voe-popup')) continue;
      const label = cont.querySelector('.floating-label, label, span');
      const labelText = (label?.textContent || '').trim().toLowerCase();
      const input = cont.querySelector('input');
      if (!input) continue;

      if (labelText.includes('adult')) {
        adults = readGwcInputValue(input, 1);
      } else if (labelText.includes('niñ') || labelText.includes('menor') || labelText.includes('child')) {
        children = readGwcInputValue(input, 0);
      } else if (labelText.includes('infant') || labelText.includes('bebé') || labelText.includes('bebe') || labelText.includes('inf')) {
        infants = readGwcInputValue(input, 0);
      }
    }

    // Método 1B: Buscar por etiquetas .floating-label directamente
    if (adults === null) {
      const labels = document.querySelectorAll('.floating-label, label');
      for (const lbl of labels) {
        if (lbl.closest('.voe-popup')) continue;
        const txt = (lbl.textContent || '').trim().toLowerCase();
        const parent = lbl.closest('.input-cont') || lbl.closest('.input-type') || lbl.parentElement;
        const input = parent?.querySelector('input');
        if (!input) continue;

        if (txt.includes('adult') && adults === null) {
          adults = readGwcInputValue(input, 1);
        } else if ((txt.includes('niñ') || txt.includes('menor') || txt.includes('child')) && children === null) {
          children = readGwcInputValue(input, 0);
        } else if ((txt.includes('infant') || txt.includes('bebé') || txt.includes('inf')) && infants === null) {
          infants = readGwcInputValue(input, 0);
        }
      }
    }

    // Método 1C: Buscar inputs específicos de pasajeros en GWC con data-mask="00" o .search-input
    if (adults === null) {
      const maskedInputs = document.querySelectorAll('input[data-mask="00"], input.search-input');
      for (const inp of maskedInputs) {
        if (inp.closest('.voe-popup')) continue;
        const parent = inp.closest('.input-cont') || inp.closest('.input-type') || inp.parentElement;
        const pText = (parent?.innerText || parent?.textContent || '').toLowerCase();
        if (pText.includes('adult') && adults === null) {
          adults = readGwcInputValue(inp, 1);
        } else if ((pText.includes('niñ') || pText.includes('menor')) && children === null) {
          children = readGwcInputValue(inp, 0);
        } else if (pText.includes('infant') && infants === null) {
          infants = readGwcInputValue(inp, 0);
        }
      }
    }

    if (adults !== null || children !== null || infants !== null) {
      const sum = (adults !== null ? adults : 1) + (children || 0) + (infants || 0);
      if (sum > 0 && sum <= 30) {
        console.log(`[EM Flights] Pasajeros detectados en GWC search form: Adultos=${adults}, Niños=${children}, Infants=${infants} => Total=${sum}`);
        return sum;
      }
    }
  } catch (err) {
    console.warn('[EM Flights] Error analizando inputs de pasajeros en GWC:', err);
  }

  // 2. Detección en la URL (parámetros de consulta o segmentos de ruta)
  try {
    const rawSearch = window.location.search || (window.location.hash.includes('?') ? window.location.hash.substring(window.location.hash.indexOf('?')) : '');
    const params = new URLSearchParams(rawSearch);

    // Búsqueda de parámetros directos
    const directKeys = ['passengers', 'pax', 'totalpax', 'travelers', 'pasajeros', 'cantpax', 'qty'];
    for (const k of directKeys) {
      const val = parseInt(params.get(k), 10);
      if (val > 0 && val <= 30) return val;
    }

    // Búsqueda de suma de adultos + menores + infantes en URL
    const adt = parseInt(params.get('adults') || params.get('adultos') || params.get('adt') || params.get('adult') || '0', 10);
    const chd = parseInt(params.get('children') || params.get('menores') || params.get('chd') || params.get('child') || params.get('kids') || '0', 10);
    const inf = parseInt(params.get('infants') || params.get('inf') || params.get('infant') || params.get('bebes') || '0', 10);
    const sum = adt + chd + inf;
    if (sum > 0 && sum <= 30) return sum;

    // Segmentos en la ruta (ej. /search/MVD/MIA/2026-11-20/2/0/0)
    if (window.location.pathname) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(parts[i]) && parts[i + 1] && /^[1-9]$/.test(parts[i + 1])) {
          const adtSeg = parseInt(parts[i + 1], 10);
          const chdSeg = parseInt(parts[i + 2], 10) || 0;
          const infSeg = parseInt(parts[i + 3], 10) || 0;
          const segTotal = adtSeg + chdSeg + infSeg;
          if (segTotal > 0 && segTotal <= 30) return segTotal;
        }
      }
    }
  } catch (_) {}

  // 3. Detección en la tarjeta del vuelo actual (contenedor del precio clicado)
  if (priceEl) {
    const card = priceEl.closest('.flight-item') ||
                 priceEl.closest('[class*="flight-item"]') ||
                 priceEl.closest('.flight-card') ||
                 priceEl.closest('[class*="flight"]') ||
                 priceEl.closest('[class*="card"]') ||
                 priceEl.closest('tr') ||
                 priceEl.parentElement?.parentElement?.parentElement?.parentElement ||
                 priceEl.parentElement?.parentElement?.parentElement;

    if (card) {
      const cardText = card.innerText || card.textContent || '';
      const adtM = cardText.match(/(\d+)\s*(?:adulto|adt|adult)s?/i) || cardText.match(/(?:adulto|adt|adult)s?[:\s]*(\d+)/i);
      const chdM = cardText.match(/(\d+)\s*(?:niño|menor|chd|child)s?/i) || cardText.match(/(?:niño|menor|chd|child)s?[:\s]*(\d+)/i);
      const infM = cardText.match(/(\d+)\s*(?:bebé|infante|inf)s?/i) || cardText.match(/(?:bebé|infante|inf)s?[:\s]*(\d+)/i);
      if (adtM || chdM || infM) {
        const sum = (adtM ? parseInt(adtM[1], 10) : 0) +
                    (chdM ? parseInt(chdM[1], 10) : 0) +
                    (infM ? parseInt(infM[1], 10) : 0);
        if (sum > 0 && sum <= 30) return sum;
      }
      const match = cardText.match(/(\d+)\s*(?:pasajero|pax|viajero|persona)s?/i) ||
                    cardText.match(/(?:pasajero|pax|viajero|persona)s?[:\s]*(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > 0 && val <= 30) return val;
      }
    }
  }

  // 4. Escaneo de texto en el encabezado de la página (tanto "Adultos 2" como "2 Adultos")
  try {
    const topText = (document.body?.innerText || '').substring(0, 4000);
    const lblFirstAdt = topText.match(/Adultos?[:\s\n\r]+(\d+)/i);
    const lblFirstChd = topText.match(/Niños?[:\s\n\r]+(\d+)/i);
    const lblFirstInf = topText.match(/Infants?[:\s\n\r]+(\d+)/i);
    if (lblFirstAdt) {
      const a = parseInt(lblFirstAdt[1], 10) || 0;
      const c = lblFirstChd ? parseInt(lblFirstChd[1], 10) || 0 : 0;
      const i = lblFirstInf ? parseInt(lblFirstInf[1], 10) || 0 : 0;
      const tot = a + c + i;
      if (tot > 0 && tot <= 30) return tot;
    }

    const numFirstMatch = topText.match(/(\d+)\s*(?:Adulto|Pasajero|Viajero)s?(?:\s*[,·+]\s*(\d+)\s*(?:Niño|Menor)s?)?/i);
    if (numFirstMatch) {
      const ad = parseInt(numFirstMatch[1], 10) || 0;
      const ch = parseInt(numFirstMatch[2], 10) || 0;
      if (ad + ch > 0 && ad + ch <= 30) return ad + ch;
    }
  } catch (_) {}

  // 5. Almacenamiento local / sesión de Blazor
  try {
    const storages = [sessionStorage, localStorage];
    for (const st of storages) {
      for (let i = 0; i < st.length; i++) {
        const k = (st.key(i) || '').toLowerCase();
        if (k.includes('search') || k.includes('pax') || k.includes('flight') || k.includes('criteria') || k.includes('filter')) {
          const raw = st.getItem(st.key(i));
          if (raw && typeof raw === 'string') {
            try {
              const obj = JSON.parse(raw);
              if (obj && typeof obj === 'object') {
                const p = obj.passengers || obj.pax || obj.travelers || obj.totalPax;
                if (p && parseInt(p, 10) > 0) return parseInt(p, 10);

                const adts = parseInt(obj.adults || obj.adt || obj.adult || 0, 10);
                const chds = parseInt(obj.children || obj.chd || obj.child || 0, 10);
                const infs = parseInt(obj.infants || obj.inf || obj.infant || 0, 10);
                if (adts + chds + infs > 0) return adts + chds + infs;
              }
            } catch (_) {}
          }
        }
      }
    }
  } catch (_) {}

  return 0;
}

function onDocClick(e) {
  if (!config.enabled) return;

  // REQUISITO CLAVE: La calculadora automática solo se activa en gwc.glas.travel/search
  if (!isGwcPage()) return;

  const target = e.target;
  if (!target) return;
  if (target.closest('.voe-popup')) return;

  let priceEl = null;

  if (target.closest('strong.priceNumb') || target.closest('.priceNumb')) {
    priceEl = target.closest('strong.priceNumb') || target.closest('.priceNumb');
  } else if (target.closest('.price-cont')) {
    const container = target.closest('.price-cont');
    priceEl = container.querySelector('strong.priceNumb') || container.querySelector('.priceNumb');
  } else if (target.closest('.flight-item-price')) {
    const container = target.closest('.flight-item-price');
    priceEl = container.querySelector('strong.priceNumb') || container.querySelector('.priceNumb');
  }

  if (priceEl) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const net = parsePrice(priceEl.textContent.trim());
    if (!isNaN(net) && net > 0) {
      // Detección automática de pasajeros en GWC
      const detectedPax = detectGwcPassengers(priceEl);
      if (detectedPax > 0) {
        config.passengers = detectedPax;
      }
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

  // Si estamos en GWC, detectar pasajeros automáticamente si no han sido ajustados manualmente
  if (isGwcPage()) {
    const detected = detectGwcPassengers();
    if (detected > 0) {
      config.passengers = detected;
    }
  }

  if (popup && popup.isConnected) {
    const priceInput = popup.querySelector('#voeNetPrice');
    if (priceInput) priceInput.value = currentNet > 0 ? currentNet : '';
    const paxInput = popup.querySelector('#voePaxInput');
    if (paxInput) paxInput.value = config.passengers;
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

    <!-- Fila 2: Margen (%) / Bok (%) -->
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

    <!-- Fila 3: Switcher Activar / Desactivar Cotización con Millas Itaú -->
    <div class="voe-switcher" id="voeItauSwitcher">
      <button class="voe-switch-btn ${!config.itauActive ? 'active' : ''}" data-itau="off">SIN MILLAS</button>
      <button class="voe-switch-btn ${config.itauActive ? 'active' : ''}" data-itau="on">💳 MILLAS ITAÚ</button>
    </div>

    <!-- Fila 4: Tarjeta de Millas Itaú Volar (Desplegable solo si está activo) -->
    <div class="voe-itau-box ${config.itauActive ? 'active' : ''}" id="voeItauBox">
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

    <!-- Fila 5: Tarjeta Azul (Precio Final - Total en destaque y pax en chiquito) -->
    <div class="voe-banner-blue" id="voeFinalBanner" title="Clic para copiar cotización">
      <div class="voe-banner-header">
        <span class="voe-banner-blue-title" id="voeFinalTitle">TOTAL A COBRAR</span>
        <span class="voe-pax-badge" id="voeFinalPaxLabel">USD 0 / pax</span>
      </div>
      <div class="voe-banner-blue-val" id="voeFinalLabel">USD 0</div>
      <div class="voe-banner-subline" id="voeBannerSubline" style="display: none;"></div>
      <div class="voe-copied-hint" id="voeCopyHint" style="display: none;">✓ ¡COPIADO AL PORTAPAPELES!</div>
    </div>

    <!-- Fila 6: Tarjeta Verde (Ganancia Neta - Total en destaque y pax en chiquito) -->
    <div class="voe-banner-green">
      <div class="voe-banner-header">
        <span class="voe-banner-green-title">GANANCIA NETA</span>
        <span class="voe-pax-badge green" id="voeProfitPaxLabel">USD 0 / pax</span>
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

  // Conmutador SIN MILLAS / MILLAS ITAÚ
  div.querySelectorAll('#voeItauSwitcher .voe-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const isItau = btn.dataset.itau === 'on';
      config.itauActive = isItau;
      if (isItau && (!config.itauMiles || config.itauMiles === 0)) {
        config.itauMiles = config.itauMinMiles || 5000;
        const itauInput = div.querySelector('#voeItauMilesInput');
        if (itauInput) itauInput.value = config.itauMiles;
      }
      persistConfig();
      updateCalculatorUI();
    });
  });

  // Controles de Millas Itaú Volar
  const itauMilesInput = div.querySelector('#voeItauMilesInput');
  const itauMinusBtn = div.querySelector('#voeItauMinus');
  const itauPlusBtn = div.querySelector('#voeItauPlus');

  itauMilesInput.addEventListener('input', (e) => {
    config.itauMiles = Math.max(0, parseInt(e.target.value) || 0);
    persistConfig();
    updateCalculatorUI();
  });

  itauMinusBtn.addEventListener('click', () => {
    config.itauMiles = Math.max(0, (config.itauMiles || 0) - 1000);
    itauMilesInput.value = config.itauMiles;
    persistConfig();
    updateCalculatorUI();
  });

  itauPlusBtn.addEventListener('click', () => {
    config.itauMiles = (config.itauMiles || 0) + 1000;
    itauMilesInput.value = config.itauMiles;
    persistConfig();
    updateCalculatorUI();
  });

  div.querySelectorAll('.voe-itau-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      config.itauMiles = parseInt(chip.dataset.miles) || 0;
      itauMilesInput.value = config.itauMiles;
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
  const finalPaxLabel = targetEl.querySelector('#voeFinalPaxLabel');
  const bannerSubline = targetEl.querySelector('#voeBannerSubline');
  const profitLabel = targetEl.querySelector('#voeProfitLabel');
  const profitPaxLabel = targetEl.querySelector('#voeProfitPaxLabel');

  const itauBox = targetEl.querySelector('#voeItauBox');
  const itauTag = targetEl.querySelector('#voeItauDiscountTag');
  const itauStatus = targetEl.querySelector('#voeItauStatus');
  const itauChips = targetEl.querySelectorAll('.voe-itau-chip');
  const itauMilesInput = targetEl.querySelector('#voeItauMilesInput');

  // Controlar visibilidad del contenedor de millas según switcher
  if (itauBox) {
    itauBox.classList.toggle('active', !!config.itauActive);
  }

  // Actualizar botones del switcher de millas
  targetEl.querySelectorAll('#voeItauSwitcher .voe-switch-btn').forEach(btn => {
    const isItau = btn.dataset.itau === 'on';
    btn.classList.toggle('active', config.itauActive ? isItau : !isItau);
  });

  if (itauMilesInput && document.activeElement !== itauMilesInput) {
    itauMilesInput.value = config.itauMiles || 0;
  }

  // Actualizar chips activos de millas
  if (itauChips) {
    itauChips.forEach(chip => {
      chip.classList.toggle('active', parseInt(chip.dataset.miles) === (config.itauMiles || 0));
    });
  }

  if (!d) {
    if (finalLabel) finalLabel.textContent = 'Error: % ≥ 100';
    if (finalPaxLabel) finalPaxLabel.textContent = '—';
    if (profitLabel) profitLabel.textContent = '—';
    if (profitPaxLabel) profitPaxLabel.textContent = '—';
    return;
  }

  // Estado del Descuento Itaú Volar
  if (itauTag && itauStatus) {
    if (config.itauActive && d.itauDiscount > 0) {
      itauTag.textContent = `- USD ${money(d.itauDiscount)}`;
      itauTag.className = 'voe-itau-box-badge active';
      itauStatus.textContent = `✓ Descuento de USD ${money(d.itauDiscount)} aplicado (-$${(d.miles * d.mileValue).toFixed(2)})`;
      itauStatus.className = 'voe-itau-msg ok';
    } else if (config.itauActive && d.miles > 0 && d.miles < d.minMiles) {
      itauTag.textContent = `Mín. ${d.minMiles.toLocaleString('es-UY')}`;
      itauTag.className = 'voe-itau-box-badge';
      itauStatus.textContent = `⚠️ Requiere mínimo ${d.minMiles.toLocaleString('es-UY')} millas (ingresadas: ${d.miles.toLocaleString('es-UY')})`;
      itauStatus.className = 'voe-itau-msg warning';
    } else {
      itauTag.textContent = 'Sin canje';
      itauTag.className = 'voe-itau-box-badge';
      itauStatus.textContent = `Mínimo ${d.minMiles.toLocaleString('es-UY')} millas · USD ${d.mileValue}/milla`;
      itauStatus.className = 'voe-itau-msg';
    }
  }

  // Formato para mostrar: PRECIO TOTAL EN DESTAQUE Y PRECIO POR PASAJERO EN CHIQUITO
  const paxCount = config.passengers || 1;
  const paxSuffix = paxCount > 1 ? ` (${paxCount} pax)` : '';

  const totalToPay = config.itauActive && d.itauDiscount > 0 ? d.finalToPay : d.final;
  const paxToPay = config.itauActive && d.itauDiscount > 0 ? d.finalToPayPax : d.finalPax;

  if (finalLabel) finalLabel.textContent = `USD ${money(totalToPay)}`;
  if (finalPaxLabel) {
    finalPaxLabel.textContent = `USD ${money(paxToPay)} / pax${paxSuffix}`;
  }

  if (config.itauActive && d.itauDiscount > 0) {
    if (finalTitle) finalTitle.textContent = 'TOTAL A COBRAR (CON MILLAS)';
    if (bannerSubline) {
      bannerSubline.style.display = 'block';
      bannerSubline.textContent = `Tarifa base: USD ${money(d.final)} · Descuento: -USD ${money(d.itauDiscount)} (${d.miles.toLocaleString('es-UY')} mi)`;
    }
  } else {
    if (finalTitle) finalTitle.textContent = 'TOTAL A COBRAR';
    if (bannerSubline) {
      bannerSubline.style.display = 'none';
      bannerSubline.textContent = '';
    }
  }

  // GANANCIA NETA EN DESTAQUE Y POR PAX EN CHIQUITO
  if (profitLabel) profitLabel.textContent = `USD ${money(d.profit)}`;
  if (profitPaxLabel) {
    profitPaxLabel.textContent = `USD ${money(d.profitPax)} / pax${paxSuffix}`;
  }
}

function copyQuotation() {
  const d = calc(currentNet);
  if (!d) return;

  const totalToPay = config.itauActive && d.itauDiscount > 0 ? d.finalToPay : d.final;
  const paxToPay = config.itauActive && d.itauDiscount > 0 ? d.finalToPayPax : d.finalPax;
  const paxCount = config.passengers || 1;

  const modeText = currentMode === 'gwc' ? ' [GWC]' : ' [Manual]';
  let text = `✈️ Cotización de Vuelo${modeText}: USD ${money(totalToPay)}`;

  if (paxCount > 1) {
    text += ` Total (USD ${money(paxToPay)} / pax para ${paxCount} pasajeros)`;
  } else {
    text += ` (1 pasajero)`;
  }

  if (config.itauActive && d.itauDiscount > 0) {
    text += ` [Incluye descuento Itaú Volar: -USD ${money(d.itauDiscount)} por ${d.miles.toLocaleString('es-UY')} millas | Tarifa base: USD ${money(d.final)}]`;
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
      itauActive: !!config.itauActive,
      itauDiscount: 0,
      finalToPay: 0,
      finalToPayPax: 0
    };
  }

  const pct = config.margin + config.bok;
  if (pct >= 100) return null;
  const final = net / (1 - pct / 100);
  const profit = final - net;

  // Descuento de Millas Itaú Volar (solo si está activo el conmutador)
  let itauDiscount = 0;
  const miles = config.itauMiles || 0;
  const minMiles = config.itauMinMiles !== undefined ? config.itauMinMiles : 5000;
  const mileValue = config.itauMileValue !== undefined ? config.itauMileValue : 0.0125;

  if (config.itauActive && miles >= minMiles) {
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
    itauActive: !!config.itauActive,
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
      displayMode: config.displayMode,
      itauActive: config.itauActive,
      itauMiles: config.itauMiles
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