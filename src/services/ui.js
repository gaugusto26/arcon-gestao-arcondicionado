export let modalOverlay = null;
export let modalTitle = null;
export let modalBody = null;
export let closeModalBtn = null;

export const CONSTANTS = {
  BRANDS: ['EOS', 'AGRATTO', 'LG', 'Samsung', 'Gree', 'Midea', 'Springer', 'Carrier', 'Fujitsu', 'Daikin', 'Electrolux', 'Philco', 'Consul', 'Hitachi', 'Comfee', 'Elgin'],
  BTUS: [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000],
  PAYMENT_METHODS: ['PIX', 'Dinheiro', 'Cartao', 'Prazo (30 dias)']
};

export function initializeUIElements() {
  modalOverlay = document.getElementById('modal-overlay');
  modalTitle = document.getElementById('modal-title');
  modalBody = document.getElementById('modal-body');
  closeModalBtn = document.getElementById('btn-close-modal');

  if (closeModalBtn) closeModalBtn.onclick = closeModal;
}

export function openModal(title) {
  if (!modalOverlay) initializeUIElements();
  if (modalTitle) modalTitle.textContent = title;
  if (modalOverlay) modalOverlay.classList.add('active');
}

export function closeModal() {
  if (modalOverlay) modalOverlay.classList.remove('active');
}

export function getAvatarUrl(avatar) {
  if (avatar && avatar.startsWith('data:image')) return avatar;
  // Fallback: SVG com inicial do nome/seed
  const initial = (avatar || '?')[0].toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#1e3a5f"/><text x="40" y="54" font-size="34" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getLogo(brand) {
  const name = (brand || 'Samsung').toLowerCase();
  const ext = name === 'samsung' ? 'jpg' : 'png';
  return `brands/${name}.${ext}`;
}

export function formatDate(value) {
  if (!value) return '---';
  return new Date(value).toLocaleDateString('pt-BR');
}

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function daysUntilDate(value) {
  if (!value) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const fileToBase64 = file => new Promise((resolve, reject) => {
  if (!file) return resolve(null);
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
});
