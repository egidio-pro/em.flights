'use strict';

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
    // Intento directo de envío de mensaje
    await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MANUAL_CALC', config: calcConfig });
    showToast('✓ Calculadora Manual abierta', 'ok');
    setTimeout(() => window.close(), 400);
  } catch (err) {
    // Si el content script no estaba cargado en esta pestaña, inyectar dinámicamente
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
}

function showToast(msg, type = 'ok') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}