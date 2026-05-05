const toggleCheck = document.getElementById('enabledToggle');
const toggleLbl   = document.getElementById('toggleLabel');
const toast       = document.getElementById('toast');
const calculateBtn = document.getElementById('calculateNetBtn');

let toastTimer = null;
let calcConfig = { passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' };
let currentCalcNet = null;

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get({ passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' });
  calcConfig = { ...calcConfig, ...cfg };
  toggleCheck.checked = cfg.enabled;
  setToggleUI(cfg.enabled);
});

toggleCheck.addEventListener('change', async () => {
  const next = toggleCheck.checked;
  await chrome.storage.sync.set({ enabled: next });
  setToggleUI(next);
  showToast(next ? '✓ Calculadora Activada' : '⊘ Calculadora Desactivada', 'ok');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_STATE', enabled: next }).catch(() => {});
  }
});

function setToggleUI(enabled) {
  toggleLbl.textContent = enabled ? 'Calculadora activa' : 'Calculadora inactiva';
}

function showToast(msg, type) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// Floating Calculator Modal Functions
calculateBtn.addEventListener('click', () => {
  showFloatingCalculator();
});

function showFloatingCalculator() {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'calc-modal-overlay';

  // Create floating calculator popup
  const floatingPopup = document.createElement('div');
  floatingPopup.className = 'calc-floating-popup';

  floatingPopup.innerHTML = `
    <div class="calc-floating-header">
      <div class="calc-floating-brand">
        <img class="calc-floating-brand-icon" src="icons/icon48.png" alt="Logo">
        <span class="calc-floating-brand-name">EM Flights</span>
      </div>
      <button class="calc-floating-close">✕</button>
    </div>
    <div class="calc-floating-body">
      <!-- Calculator content will be populated by JavaScript -->
    </div>
  `;

  modalOverlay.appendChild(floatingPopup);
  document.body.appendChild(modalOverlay);

  // Add close functionality
  const closeBtn = floatingPopup.querySelector('.calc-floating-close');
  closeBtn.addEventListener('click', () => {
    modalOverlay.remove();
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  });

  // Render calculator content
  renderFloatingCalculatorBody(floatingPopup);
}

function renderFloatingCalculatorBody(popupElement) {
  const body = popupElement.querySelector('.calc-floating-body');
  const d = calc(currentCalcNet || 0);

  body.innerHTML = `
    <!-- Price Input Section (Top) -->
    <div class="calc-section">
      <div class="calc-section-title">
        💰 Precio Base
      </div>
      <input type="number" class="calc-price-input" id="floatingCalcNetInput" value="${currentCalcNet || ''}" placeholder="Ingrese precio neto GWC" step="0.01" min="0">
    </div>

    <!-- Configuration Section (Middle) -->
    <div class="calc-section">
      <div class="calc-section-title">
        ⚙️ Configuración
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="calc-input-control">
          <span class="calc-input-label">Pasajeros</span>
          <div class="calc-input-group">
            <button class="calc-step-btn" data-key="passengers" data-v="-1">−</button>
            <input type="number" class="calc-number-input" data-key="passengers" value="${calcConfig.passengers}" step="1" min="1">
            <button class="calc-step-btn" data-key="passengers" data-v="1">+</button>
          </div>
        </div>

        <div class="calc-input-control">
          <span class="calc-input-label">Margen %</span>
          <div class="calc-input-group">
            <button class="calc-step-btn" data-key="margin" data-v="-0.5">−</button>
            <input type="number" class="calc-number-input" data-key="margin" value="${calcConfig.margin}" step="0.1">
            <button class="calc-step-btn" data-key="margin" data-v="0.5">+</button>
          </div>
        </div>

        <div class="calc-input-control">
          <span class="calc-input-label">Booking %</span>
          <div class="calc-input-group">
            <button class="calc-step-btn" data-key="bok" data-v="-0.1">−</button>
            <input type="number" class="calc-number-input" data-key="bok" value="${calcConfig.bok}" step="0.1">
            <button class="calc-step-btn" data-key="bok" data-v="0.1">+</button>
          </div>
        </div>

        <div style="display: flex; justify-content: center; margin-top: 8px;">
          <div class="calc-mode-switcher">
            <button class="calc-mode-btn ${calcConfig.displayMode === 'total' ? 'active' : ''}" data-m="total">Total</button>
            <button class="calc-mode-btn ${calcConfig.displayMode === 'pax' ? 'active' : ''}" data-m="pax">Por Pax</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Section (Bottom) -->
    <div class="calc-section">
      <div class="calc-section-title">
        📊 Resultados
      </div>

      ${d ? `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="calc-result-card calc-result-card primary">
          <div class="calc-result-label">Precio Final ${calcConfig.displayMode === 'total' ? '(Total)' : '(Por Pax)'}</div>
          <div class="calc-result-value" id="floatingCalcFinalLabel">USD ${money(calcConfig.displayMode === 'total' ? d.final : d.finalPax)}</div>
        </div>

        <div class="calc-result-card calc-result-card success">
          <div class="calc-result-label">Ganancia ${calcConfig.displayMode === 'total' ? '(Total)' : '(Por Pax)'}</div>
          <div class="calc-result-value" id="floatingCalcProfitLabel">USD ${money(calcConfig.displayMode === 'total' ? d.profit : d.profitPax)}</div>
        </div>
      </div>
      ` : `
      <div class="calc-result-card calc-result-card error">
        <div class="calc-result-label">Estado</div>
        <div class="calc-result-value">Ingrese un precio válido<br><small>El precio neto debe ser mayor a 0</small></div>
      </div>
      `}
    </div>
  `;

  // Add event listeners
  const netInput = body.querySelector('#floatingCalcNetInput');
  if (netInput) {
    netInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      currentCalcNet = isNaN(val) || val <= 0 ? null : val;
      renderFloatingCalculatorBody(popupElement);
    });
    // Auto-focus on price input after a brief delay to ensure DOM is ready
    setTimeout(() => netInput.focus(), 100);
  }

  // Mode switcher buttons
  body.querySelectorAll('.calc-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      calcConfig.displayMode = btn.dataset.m;
      chrome.storage.sync.set({ displayMode: calcConfig.displayMode });
      renderFloatingCalculatorBody(popupElement);
    });
  });

  // Enhanced step buttons (+/-)
  body.querySelectorAll('.calc-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const val = parseFloat(btn.dataset.v);
      calcConfig[key] = Math.max(0, parseFloat((calcConfig[key] + val).toFixed(2)));
      if (key === 'passengers') calcConfig[key] = Math.max(1, calcConfig[key]);
      chrome.storage.sync.set(calcConfig);
      renderFloatingCalculatorBody(popupElement);

      // Add visual feedback
      btn.style.transform = 'scale(0.9)';
      setTimeout(() => btn.style.transform = '', 150);
    });
  });

  // Number input fields
  body.querySelectorAll('.calc-number-input[data-key]').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = input.dataset.key;
      let val = parseFloat(e.target.value);
      if (isNaN(val)) return;
      if (key === 'passengers' && val < 1) val = 1;
      if (val < 0) val = 0;
      calcConfig[key] = val;
      chrome.storage.sync.set(calcConfig);
      renderFloatingCalculatorBody(popupElement);
    });

    input.addEventListener('blur', (e) => {
      // Ensure valid values on blur
      const key = input.dataset.key;
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) {
        val = key === 'passengers' ? 1 : 0;
      }
      if (key === 'passengers' && val < 1) val = 1;
      e.target.value = val;
      calcConfig[key] = val;
      chrome.storage.sync.set(calcConfig);
    });
  });
}

function renderCalculatorBody() {
  const body = embeddedCalc.querySelector('.calculator-body');
  const d = calc(currentCalcNet || 0);

  body.innerHTML = `
    <div class="calc-info-row">
      <div class="calc-info-chip">
        <span class="calc-chip-label">Precio neto GWC</span>
        <input type="number" class="calc-manual-input" id="calcNetInput" value="${currentCalcNet || ''}" placeholder="Ingrese precio neto" step="0.01" min="0">
      </div>
      <div class="calc-info-chip">
        <span class="calc-chip-label">Pasajeros</span>
        <div class="calc-step-group">
          <button class="calc-step" data-key="passengers" data-v="-1">-</button>
          <span class="calc-chip-value" id="passengersValue">${calcConfig.passengers}</span>
          <button class="calc-step" data-key="passengers" data-v="1">+</button>
        </div>
      </div>
    </div>

    <div class="calc-switcher">
      <button class="calc-switch-btn ${calcConfig.displayMode === 'total' ? 'active' : ''}" data-m="total">Total</button>
      <button class="calc-switch-btn ${calcConfig.displayMode === 'pax' ? 'active' : ''}" data-m="pax">Por Pax</button>
    </div>

    <div class="calc-info-row">
      <div class="calc-info-chip">
        <span class="calc-chip-label">Margen (%)</span>
        <div class="calc-step-group">
          <button class="calc-step" data-key="margin" data-v="-0.5">-</button>
          <span class="calc-chip-value" id="marginValue">${calcConfig.margin}</span>
          <button class="calc-step" data-key="margin" data-v="0.5">+</button>
        </div>
      </div>
      <div class="calc-info-chip">
        <span class="calc-chip-label">Bok (%)</span>
        <div class="calc-step-group">
          <button class="calc-step" data-key="bok" data-v="-0.1">-</button>
          <span class="calc-chip-value" id="bokValue">${calcConfig.bok}</span>
          <button class="calc-step" data-key="bok" data-v="0.1">+</button>
        </div>
      </div>
    </div>

    ${d ? `
    <div class="calc-card calc-card-blue">
      <div class="calc-card-title">Precio final al cliente <span style="font-weight:400">(${calcConfig.displayMode === 'total' ? 'Total' : 'Pax'})</span></div>
      <div class="calc-card-main" id="calcFinalLabel">USD ${money(calcConfig.displayMode === 'total' ? d.final : d.finalPax)}</div>
    </div>

    <div class="calc-card calc-card-green">
      <div class="calc-card-title">Ganancia neta <span style="font-weight:400">(${calcConfig.displayMode === 'total' ? 'Total' : 'Pax'})</span></div>
      <div class="calc-card-main" id="calcProfitLabel">USD ${money(calcConfig.displayMode === 'total' ? d.profit : d.profitPax)}</div>
    </div>
    ` : `
    <div class="calc-card" style="text-align: center; background: rgba(220, 38, 38, 0.08); border-left: 4px solid #DC2626;">
      <div class="calc-card-title">Ingrese un precio válido</div>
      <div style="font-size: 12px; color: var(--text-sec);">El precio neto debe ser mayor a 0</div>
    </div>
    `}
  `;

  // Add event listeners
  const netInput = body.querySelector('#calcNetInput');
  if (netInput) {
    netInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      currentCalcNet = isNaN(val) || val <= 0 ? null : val;
      renderCalculatorBody();
    });
  }

  body.querySelectorAll('.calc-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      calcConfig.displayMode = btn.dataset.m;
      chrome.storage.sync.set({ displayMode: calcConfig.displayMode });
      renderCalculatorBody();
    });
  });

  body.querySelectorAll('.calc-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const val = parseFloat(btn.dataset.v);
      calcConfig[key] = Math.max(0, parseFloat((calcConfig[key] + val).toFixed(2)));
      if (key === 'passengers') calcConfig[key] = Math.max(1, calcConfig[key]);
      chrome.storage.sync.set(calcConfig);
      renderCalculatorBody();
    });
  });
}

// Calculation functions (adapted from content.js)
function calc(net) {
  if (!net || net <= 0) return null;
  const pct = calcConfig.margin + calcConfig.bok;
  if (pct >= 100) return null;
  const final = net / (1 - pct / 100);
  return {
    net,
    pct,
    final,
    finalPax: final / calcConfig.passengers,
    profit: final - net,
    profitPax: (final - net) / calcConfig.passengers,
    pax: calcConfig.passengers
  };
}

function money(n) {
  return isNaN(n) ? '—' : Math.round(n).toLocaleString('es-UY');
}

