const passEl    = document.getElementById('passengers');
const saveBtn   = document.getElementById('saveBtn');
const toggleBtn = document.getElementById('toggleBtn');
const toggleLbl = document.getElementById('toggleLabel');
const toggleDot = document.getElementById('toggleDot');
const toast     = document.getElementById('toast');

let toastTimer = null;

// ── Cargar config guardada ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get({ passengers:1, margin:10, bok:0.8, enabled:true });
  passEl.value = cfg.passengers;
  setToggleUI(cfg.enabled);
  updateConfigChip(cfg.margin, cfg.bok);
});

// ── Guardar ─────────────────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  const passengers = parseInt(passEl.value);

  if (isNaN(passengers) || passengers < 1 || passengers > 20)
    return showToast('Pasajeros: ingresá entre 1 y 20', 'err');

  await chrome.storage.sync.set({ passengers, enabled: true });
  setToggleUI(true);
  showToast('✓ Guardado', 'ok');

  // Notificar al content script activo
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (tab?.id)
    chrome.tabs.sendMessage(tab.id, { type:'CONFIG_UPDATED', config:{ passengers } })
      .catch(() => {});
});

// ── Toggle activar/desactivar ────────────────────────────────────────
toggleBtn.addEventListener('click', async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled:true });
  const next = !enabled;
  await chrome.storage.sync.set({ enabled:next });
  setToggleUI(next);
  showToast(next ? '✓ Activada' : '⊘ Desactivada', 'ok');

  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (tab?.id)
    chrome.tabs.sendMessage(tab.id, { type:'TOGGLE_STATE', enabled:next }).catch(() => {});
});

// ── UI helpers ──────────────────────────────────────────────────────
function setToggleUI(enabled) {
  toggleLbl.textContent  = enabled ? 'Calculadora activa' : 'Calculadora inactiva';
  toggleDot.style.background = enabled ? '#34C759' : '#FF3B30';
}

function updateConfigChip(margin, bok) {
  const chip = document.getElementById('configInfo');
  if (!chip) return;
  const m = parseFloat(margin) || 10;
  const b = parseFloat(bok)    || 0.8;
  chip.textContent = `Margen: ${m}% · Bok/Arancel: ${b}%`;
}

function showToast(msg, type) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Validación en tiempo real ────────────────────────────────────────
passEl.addEventListener('input', e => {
  const v = parseInt(e.target.value);
  if (!isNaN(v)) e.target.value = Math.min(20, Math.max(1, v));
});

