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
  enabled: true,
  itauMileValue: 0.0125,
  itauMinMiles: 5000
};

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get({
    enabled: true,
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

// Los content scripts escuchan chrome.storage.onChanged: no hace falta enviar mensajes
toggleCheck.addEventListener('change', async () => {
  const next = toggleCheck.checked;
  calcConfig.enabled = next;
  await chrome.storage.sync.set({ enabled: next });
  setToggleUI(next);
  showToast(next ? 'Calculadora Activada' : 'Calculadora Desactivada', next ? 'ok' : 'error');
});

// Guardado de configuración de Millas Itaú Volar (acepta 0, rechaza negativos / vacíos)
if (itauMileValueInput) {
  itauMileValueInput.addEventListener('input', () => {
    const v = parseFloat(itauMileValueInput.value);
    if (!Number.isFinite(v) || v < 0) return;
    calcConfig.itauMileValue = v;
    updateItauHint();
    debouncedSaveItau();
  });
}

if (itauMinMilesInput) {
  itauMinMilesInput.addEventListener('input', () => {
    const v = parseInt(itauMinMilesInput.value, 10);
    if (!Number.isFinite(v) || v < 0) return;
    calcConfig.itauMinMiles = v;
    updateItauHint();
    debouncedSaveItau();
  });
}

function updateItauHint() {
  if (!itauHint) return;
  const min = calcConfig.itauMinMiles;
  const val = calcConfig.itauMileValue;
  const discount = (min * val).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  itauHint.textContent = `${min.toLocaleString('es-UY')} millas = USD ${discount} de descuento`;
}

function debouncedSaveItau() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.sync.set({
      itauMileValue: calcConfig.itauMileValue,
      itauMinMiles: calcConfig.itauMinMiles
    });
    showToast('Millas Itaú guardadas', 'ok');
  }, 400);
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
    await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MANUAL_CALC' }, { frameId: 0 });
    showToast('Calculadora Manual abierta', 'ok');
    setTimeout(() => window.close(), 400);
  } catch (err) {
    try {
      const [{ result: alreadyInjected } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!window.__emFlightsInjected
      }).catch(() => [{}]);

      if (!alreadyInjected) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      }

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MANUAL_CALC' }, { frameId: 0 });
          showToast('Calculadora Manual abierta', 'ok');
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