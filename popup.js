'use strict';

const toggleCheck = document.getElementById('enabledToggle');
const toggleLbl = document.getElementById('toggleLabel');
const toast = document.getElementById('toast');
const openManualCalcBtn = document.getElementById('openManualCalc');
const itauMileValueInput = document.getElementById('itauMileValue');
const itauMinMilesInput = document.getElementById('itauMinMiles');
const itauHint = document.getElementById('itauHint');

let toastTimer = null;
let saveTimer = null;
let calcConfig = {
  passengers: 1,
  margin: 10,
  bok: 0.8,
  enabled: true,
  displayMode: 'total',
  itauMileValue: 0.0125,
  itauMinMiles: 5000
};

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get({
    passengers: 1,
    margin: 10,
    bok: 0.8,
    enabled: true,
    displayMode: 'total',
    itauMileValue: 0.0125,
    itauMinMiles: 5000
  });
  calcConfig = { ...calcConfig, ...cfg };

  toggleCheck.checked = calcConfig.enabled;
  setToggleUI(calcConfig.enabled);

  if (itauMileValueInput) itauMileValueInput.value = calcConfig.itauMileValue;
  if (itauMinMilesInput) itauMinMilesInput.value = calcConfig.itauMinMiles;
  updateItauHint();
});

toggleCheck.addEventListener('change', async () => {
  const next = toggleCheck.checked;
  calcConfig.enabled = next;
  await chrome.storage.sync.set({ enabled: next });
  setToggleUI(next);
  showToast(next ? '✓ Calculadora Activada' : '⊘ Calculadora Desactivada', 'ok');

  broadcastConfig();
});

// Guardado de configuración de Millas Itaú Volar
if (itauMileValueInput) {
  itauMileValueInput.addEventListener('input', () => {
    calcConfig.itauMileValue = parseFloat(itauMileValueInput.value) || 0.0125;
    updateItauHint();
    debouncedSaveItau();
  });
}

if (itauMinMilesInput) {
  itauMinMilesInput.addEventListener('input', () => {
    calcConfig.itauMinMiles = parseInt(itauMinMilesInput.value) || 5000;
    updateItauHint();
    debouncedSaveItau();
  });
}

function updateItauHint() {
  if (!itauHint) return;
  const min = calcConfig.itauMinMiles || 5000;
  const val = calcConfig.itauMileValue || 0.0125;
  const discount = (min * val).toFixed(2);
  itauHint.textContent = `${min.toLocaleString('es-UY')} millas = USD ${discount} de descuento`;
}

function debouncedSaveItau() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.sync.set({
      itauMileValue: calcConfig.itauMileValue,
      itauMinMiles: calcConfig.itauMinMiles
    });
    showToast('✓ Millas Itaú guardadas', 'ok');
    broadcastConfig();
  }, 400);
}

async function broadcastConfig() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'CONFIG_UPDATED',
      config: calcConfig
    }).catch(() => {});
  }
}

// Apertura de la calculadora manual (independiente del dominio)
openManualCalcBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showToast('Abre una pestaña primero', 'error');
    return;
  }

  // Comprobar si es una página restringida por el sistema de Chrome
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
    showToast('Abre cualquier página web normal', 'error');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MANUAL_CALC', config: calcConfig });
    showToast('✓ Calculadora Manual abierta', 'ok');
    setTimeout(() => window.close(), 400);
  } catch (err) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MANUAL_CALC', config: calcConfig });
          showToast('✓ Calculadora Manual abierta', 'ok');
          setTimeout(() => window.close(), 400);
        } catch (e2) {
          showToast('Error al conectar con la pestaña', 'error');
        }
      }, 150);
    } catch (injErr) {
      showToast('Abre una web accesible para usarla', 'error');
    }
  }
});

function setToggleUI(enabled) {
  toggleLbl.textContent = enabled ? 'Calculadora activa' : 'Calculadora inactiva';
  const statusPill = document.getElementById('statusPill');
  if (statusPill) {
    statusPill.textContent = enabled ? '● SISTEMA EN LÍNEA' : '○ SISTEMA DESCONECTADO';
    statusPill.className = `switch-status ${enabled ? '' : 'off'}`;
  }
}

function showToast(msg, type = 'ok') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}