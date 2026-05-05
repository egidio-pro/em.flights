const toggleCheck = document.getElementById('enabledToggle');
const toggleLbl   = document.getElementById('toggleLabel');
const toast       = document.getElementById('toast');
const calculateBtn = document.getElementById('calculateNetBtn');
const embeddedCalc = document.getElementById('embeddedCalculator');

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

// Embedded Calculator Functions
calculateBtn.addEventListener('click', () => {
  if (embeddedCalc.style.display === 'none' || embeddedCalc.style.display === '') {
    showEmbeddedCalculator();
  } else {
    hideEmbeddedCalculator();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('calculator-close')) {
    hideEmbeddedCalculator();
  }
});

function showEmbeddedCalculator() {
  embeddedCalc.style.display = 'block';
  renderCalculatorBody();
  calculateBtn.innerHTML = '<span style="font-size: 13px; font-weight: 600; color: var(--accent);">Ocultar calculadora</span>';
}

function hideEmbeddedCalculator() {
  embeddedCalc.style.display = 'none';
  calculateBtn.innerHTML = '<span style="font-size: 13px; font-weight: 600; color: var(--accent);">Calcular el neto</span>';
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

