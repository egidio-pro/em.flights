const toggleBtn = document.getElementById('toggleBtn');
const toggleLbl = document.getElementById('toggleLabel');
const toggleDot = document.getElementById('toggleDot');
const toast     = document.getElementById('toast');

let toastTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get({ enabled: true });
  setToggleUI(cfg.enabled);
});

toggleBtn.addEventListener('click', async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  const next = !enabled;
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
  toggleDot.style.background = enabled ? '#34C759' : '#FF3B30';
  toggleDot.style.boxShadow = enabled ? '0 0 8px rgba(52, 199, 89, 0.5)' : 'none';
}

function showToast(msg, type) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

