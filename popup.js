const toggleCheck = document.getElementById('enabledToggle');
const toggleLbl = document.getElementById('toggleLabel');
const toast = document.getElementById('toast');
const openManualCalcBtn = document.getElementById('openManualCalc');

let toastTimer = null;
let calcConfig = { passengers: 1, margin: 10, bok: 0.8, enabled: true, displayMode: 'total' };

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

openManualCalcBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showToast('Error: sin tab', 'error');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MANUAL_CALC', config: calcConfig });
    showToast('✓ Calculadora Manual abierta', 'ok');
  } catch (err) {
    showToast('Error abriendo calculadora', 'error');
  }
});

function setToggleUI(enabled) {
  toggleLbl.textContent = enabled ? 'Calculadora activa' : 'Calculadora inactiva';
}

function showToast(msg, type = 'ok') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

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