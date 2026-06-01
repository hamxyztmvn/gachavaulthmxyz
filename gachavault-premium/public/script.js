const API = '/api';
let currentUser = null, isAdmin = false;

// ========== HELPERS ==========
async function fetchAPI(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw err;
  }
  return res.json();
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function loadPublicSettings() {
  try {
    const res = await fetch('/api/public-settings');
    if (res.ok) {
      const settings = await res.json();
      document.getElementById('siteNameDisplay').innerHTML = settings.siteName.includes(' ') ?
        settings.siteName.split(' ').slice(0, -1).join(' ') + ' <span>' + settings.siteName.split(' ').pop() + '</span>' :
        '<span>' + settings.siteName + '</span>';
      document.getElementById('logoDisplay').textContent = settings.logo;
      document.getElementById('popupLink').href = settings.channelLink;
      document.getElementById('popupTitle').textContent = settings.channelPopupTitle;
      document.getElementById('popupDesc').textContent = settings.channelPopupDesc;
    }
  } catch (e) {}
}

// ========== AUTH & SESSION ==========
async function checkSession() {
  try {
    const data = await fetchAPI('/api/session');
    currentUser = data.user;
    isAdmin = data.isAdmin;
    document.getElementById('btnLogin').classList.toggle('hidden', !!currentUser);
    document.getElementById('btnDashboard').classList.toggle('hidden', !currentUser);
    document.getElementById('btnLogout').classList.toggle('hidden', !currentUser);
    if (currentUser) document.getElementById('coinBalance').textContent = currentUser.credits;
    document.getElementById('navAdmin').classList.toggle('hidden', !isAdmin);
  } catch (e) {}
}

async function login() {
  const username = document.getElementById('authUsername').value;
  const password = document.getElementById('authPassword').value;
  if (!username || !password) return showToast('Isi username dan password', 'error');
  try {
    const res = await fetchAPI('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    closeModal('loginModal');
    await checkSession();
    showToast(res.message, 'success');
  } catch (e) { showToast(e.error, 'error'); }
}

async function register() {
  const username = document.getElementById('authUsername').value;
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const refCode = document.getElementById('authRefCode').value;
  if (!username || !email || !password) return showToast('Lengkapi semua field', 'error');
  try {
    const res = await fetchAPI('/api/register', { method: 'POST', body: JSON.stringify({ username, email, password, refCode }) });
    closeModal('loginModal');
    await checkSession();
    showToast(res.message, 'success');
  } catch (e) { showToast(e.error, 'error'); }
}

async function logout() {
  await fetchAPI('/api/logout', { method: 'POST' });
  currentUser = null;
  isAdmin = false;
  document.getElementById('coinBalance').textContent = '0';
  checkSession();
  navigateTo('gacha');
}

// ========== GACHA ==========
let gachaCooldown = false;
async function startGacha() {
  if (!currentUser) return showToast('Login dulu!', 'error');
  if (gachaCooldown) return;
  try {
    const res = await fetchAPI('/api/gacha', { method: 'POST' });
    gachaCooldown = true;
    document.getElementById('gachaInfo').textContent = 'Mengacak...';
    const reels = document.querySelectorAll('.reel');
    reels.forEach(r => r.classList.add('spinning'));
    
    setTimeout(() => {
      reels.forEach(r => r.classList.remove('spinning'));
      document.getElementById('gachaInfo').textContent = 'Putar untuk menang!';
      displayResult(res.prize);
      document.getElementById('coinBalance').textContent = res.credits;
      if (currentUser) currentUser.credits = res.credits;

      let cd = res.cooldown;
      const timerEl = document.getElementById('cooldownTimer');
      timerEl.textContent = `Tunggu ${cd} detik...`;
      const interval = setInterval(() => {
        cd--;
        timerEl.textContent = `Tunggu ${cd} detik...`;
        if (cd <= 0) {
          clearInterval(interval);
          timerEl.textContent = '';
          gachaCooldown = false;
        }
      }, 1000);
    }, 2000);
  } catch (e) { showToast(e.error, 'error'); gachaCooldown = false; }
}

function displayResult(prize) {
  const div = document.getElementById('gachaResult');
  div.innerHTML = `
    <span class="rarity-${prize.rarity}">${prize.rarity.toUpperCase()}</span>
    <h3>${prize.name}</h3>
    <p>${prize.description || ''}</p>
    ${prize.downloadToken ? `<button class="btn-glass neon" onclick="downloadPrize('${prize.downloadToken}')">📥 Download</button>` : ''}
  `;
  div.classList.add('show');
}

function downloadPrize(token) {
  window.open(`/api/user/download/${token}`, '_blank');
}

// ========== UPLOAD ==========
async function submitFile() {
  if (!currentUser) return showToast('Login dulu!', 'error');
  const fileInput = document.getElementById('fileInput');
  if (!fileInput.files[0]) return showToast('Pilih file dulu', 'error');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('category', document.getElementById('uploadCategory').value);
  formData.append('description', document.getElementById('uploadDesc').value);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) showToast(data.message, 'success');
    else showToast(data.error, 'error');
  } catch (e) { showToast('Gagal upload', 'error'); }
}

// ========== PRIZES ==========
async function loadMyPrizes() {
  if (!currentUser) return;
  const prizes = await fetchAPI('/api/user/prizes');
  const div = document.getElementById('prizesList');
  div.innerHTML = prizes.map(p => `
    <div class="glass p-2">
      <span class="rarity-${p.rarity}">${p.rarity}</span>
      <h4>${p.name}</h4>
      ${!p.downloaded ? `<button class="btn-glass neon" onclick="downloadPrize('${p.downloadToken}')">Download</button>` : '<span>✅ Sudah diunduh</span>'}
    </div>
  `).join('');
}

// ========== ADMIN ==========
async function adminLogin() {
  const key = document.getElementById('adminKey').value;
  try {
    const res = await fetchAPI('/api/admin/login', { method: 'POST', body: JSON.stringify({ key }) });
    isAdmin = true;
    document.getElementById('navAdmin').classList.remove('hidden');
    document.getElementById('adminLoginForm').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    showAdminStats();
  } catch (e) { showToast(e.error, 'error'); }
}

async function showAdminStats() {
  const stats = await fetchAPI('/api/admin/stats');
  document.getElementById('adminDashboard').innerHTML = `
    <div class="stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px,1fr)); gap:12px;">
      <div class="glass p-2">👥 Users: ${stats.totalUsers}</div>
      <div class="glass p-2">🎰 Gacha: ${stats.totalGacha}</div>
      <div class="glass p-2">🎁 Prizes: ${stats.totalPrizes}</div>
      <div class="glass p-2">📤 Uploads: ${stats.totalUploads}</div>
      <div class="glass p-2">🪙 Coins: ${stats.totalCoins}</div>
    </div>
  `;
}

// ========== NAVIGATION ==========
function navigateTo(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.remove('hidden');
  const navEl = document.querySelector(`[data-tab="${tab}"]`);
  if (navEl) navEl.classList.add('active');
  if (tab === 'prizes') loadMyPrizes();
}

document.querySelector('.nav-glass').addEventListener('click', e => {
  if (e.target.classList.contains('nav-item')) {
    navigateTo(e.target.dataset.tab);
  }
});

// ========== MODALS & POPUP ==========
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function checkPopup() {
  if (localStorage.getItem('popupDismissed')) return;
  document.getElementById('channelPopup').classList.remove('hidden');
}

function followedChannel() {
  if (document.getElementById('dontShowAgain').checked) {
    localStorage.setItem('popupDismissed', 'true');
  }
  document.getElementById('channelPopup').classList.add('hidden');
}

function closeChannelPopup() {
  document.getElementById('channelPopup').classList.add('hidden');
}

// ========== INIT ==========
function createParticles() {
  const container = document.getElementById('particles');
  for (let i=0; i<30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random()*100+'%';
    p.style.width = p.style.height = Math.random()*5+2+'px';
    p.style.animationDelay = Math.random()*8+'s';
    container.appendChild(p);
  }
}

window.addEventListener('load', async () => {
  createParticles();
  await loadPublicSettings();
  await checkSession();
  checkPopup();
  navigateTo('gacha');
});

// Drag & drop untuk upload
const uploadZone = document.querySelector('.upload-zone');
if (uploadZone) {
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.style.borderColor = 'var(--neon)'; });
  uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = ''; });
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    const fileInput = document.getElementById('fileInput');
    fileInput.files = e.dataTransfer.files;
    document.getElementById('uploadFileName').textContent = fileInput.files[0]?.name || '';
  });
}

document.getElementById('fileInput').addEventListener('change', function() {
  document.getElementById('uploadFileName').textContent = this.files[0]?.name || '';
});
