const toggleCheck = document.getElementById('enabledToggle');
const toggleLbl   = document.getElementById('toggleLabel');
const toast       = document.getElementById('toast');

let toastTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get({ enabled: true });
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

