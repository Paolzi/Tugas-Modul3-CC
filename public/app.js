/**
 * CloudStore Inventaris - Frontend Client Logic
 * Tugas Mandiri Praktikum Komputasi Awan Modul 3
 */

// State Aplikasi
const state = {
  items: [],
  filteredItems: [],
  stats: {},
  currentView: 'table', // 'table' | 'grid'
  searchQuery: '',
  selectedCategory: 'Semua',
  sortBy: 'id',
  sortOrder: 'DESC',
  itemToDelete: null,
  activeDetailItem: null,
  theme: localStorage.getItem('cloudstore_theme') || 'dark'
};

// DOM Elements Cache
const DOM = {
  // Stats
  statTotalItems: document.getElementById('stat-total-items'),
  statTotalStock: document.getElementById('stat-total-stock'),
  statTotalValue: document.getElementById('stat-total-value'),
  statLowStock: document.getElementById('stat-low-stock'),
  azureStatusText: document.getElementById('azure-status-text'),

  // Controls
  inputSearch: document.getElementById('input-search'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  selectCategory: document.getElementById('select-category'),
  selectSort: document.getElementById('select-sort'),
  btnViewTable: document.getElementById('btn-view-table'),
  btnViewGrid: document.getElementById('btn-view-grid'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  themeIcon: document.getElementById('theme-icon'),

  // Views
  tableWrapper: document.getElementById('table-wrapper'),
  tableBody: document.getElementById('inventory-table-body'),
  gridWrapper: document.getElementById('grid-wrapper'),
  loadingSpinner: document.getElementById('loading-spinner'),
  emptyState: document.getElementById('empty-state'),
  visibleCount: document.getElementById('visible-count'),
  totalCount: document.getElementById('total-count'),

  // Modals
  modalCreate: document.getElementById('modal-create'),
  modalEdit: document.getElementById('modal-edit'),
  modalDetail: document.getElementById('modal-detail'),
  modalDelete: document.getElementById('modal-delete'),

  // Forms
  formCreate: document.getElementById('form-create-item'),
  formEdit: document.getElementById('form-edit-item'),

  // Create Form inputs
  createKode: document.getElementById('create-kode'),
  createNama: document.getElementById('create-nama'),
  createKategori: document.getElementById('create-kategori'),
  createHarga: document.getElementById('create-harga'),
  createHargaPreview: document.getElementById('create-harga-preview'),
  createStok: document.getElementById('create-stok'),
  createStokBadge: document.getElementById('create-stok-badge'),
  createDeskripsi: document.getElementById('create-deskripsi'),
  btnGenCode: document.getElementById('btn-gen-code'),

  // Edit Form inputs
  editId: document.getElementById('edit-id'),
  editKode: document.getElementById('edit-kode'),
  editNama: document.getElementById('edit-nama'),
  editKategori: document.getElementById('edit-kategori'),
  editHarga: document.getElementById('edit-harga'),
  editHargaPreview: document.getElementById('edit-harga-preview'),
  editStok: document.getElementById('edit-stok'),
  editDeskripsi: document.getElementById('edit-deskripsi'),

  // Delete Modal elements
  deleteItemName: document.getElementById('delete-item-name'),
  deleteItemCode: document.getElementById('delete-item-code'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),

  // Detail Modal elements
  detailNama: document.getElementById('detail-nama'),
  detailKode: document.getElementById('detail-kode'),
  detailKategori: document.getElementById('detail-kategori'),
  detailHarga: document.getElementById('detail-harga'),
  detailStok: document.getElementById('detail-stok'),
  detailTotalValue: document.getElementById('detail-total-value'),
  detailStatusPill: document.getElementById('detail-status-pill'),
  detailDeskripsi: document.getElementById('detail-deskripsi'),
  detailCreated: document.getElementById('detail-created'),
  detailUpdated: document.getElementById('detail-updated'),
  btnDetailEdit: document.getElementById('btn-detail-edit'),

  // Open modal buttons
  btnOpenCreateModal: document.getElementById('btn-open-create-modal'),
  btnEmptyAdd: document.getElementById('btn-empty-add'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};

// ======================= HELPER FUNCTIONS =======================

// Format angka ke format mata uang Rupiah
function formatRupiah(amount) {
  if (isNaN(amount) || amount === null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Format Tanggal ISO ke format lokal Indonesia yang rapi
function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

// Sanitasi string untuk mencegah celah keamanan XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Kembalikan badge HTML berdasarkan jumlah stok barang
function getStockBadge(stok) {
  const stockNum = parseInt(stok, 10) || 0;
  if (stockNum === 0) {
    return `<span class="stock-pill stock-danger"><i data-lucide="x-circle"></i> Habis</span>`;
  }
  if (stockNum <= 5) {
    return `<span class="stock-pill stock-warning"><i data-lucide="alert-triangle"></i> Sisa ${stockNum}</span>`;
  }
  return `<span class="stock-pill stock-safe"><i data-lucide="check-circle-2"></i> ${stockNum} Unit</span>`;
}

// Refresh Lucide Icons pada DOM yang baru dirender
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ======================= TOAST NOTIFICATIONS =======================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-octagon';
  if (type === 'info') iconName = 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <span class="toast-msg">${escapeHTML(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ======================= API CLIENT CALLS =======================

// Ambil status kesehatan server & status Azure
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'healthy') {
      if (data.azureAppService) {
        DOM.azureStatusText.textContent = `Azure: ${data.siteName}`;
      } else {
        DOM.azureStatusText.textContent = `Local Server Online`;
      }
    }
  } catch (err) {
    DOM.azureStatusText.textContent = `Offline / Disconnected`;
  }
}

// Ambil data statistik dari backend
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const result = await res.json();
    if (result.success) {
      const stats = result.data;
      DOM.statTotalItems.textContent = stats.totalItems.toLocaleString('id-ID');
      DOM.statTotalStock.textContent = stats.totalStock.toLocaleString('id-ID');
      DOM.statTotalValue.textContent = formatRupiah(stats.totalValue);
      DOM.statLowStock.textContent = stats.lowStockItems.toLocaleString('id-ID');

      // Update dropdown kategori jika ada kategori baru
      updateCategoryDropdown(stats.categories);
    }
  } catch (err) {
    console.error('Gagal mengambil statistik:', err);
  }
}

// Update opsi dropdown kategori
function updateCategoryDropdown(categories = []) {
  const currentVal = DOM.selectCategory.value;
  const existingOptions = Array.from(DOM.selectCategory.options).map(o => o.value);

  categories.forEach(cat => {
    if (!existingOptions.includes(cat) && cat) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      DOM.selectCategory.appendChild(opt);
    }
  });

  DOM.selectCategory.value = currentVal;
}

// Ambil daftar barang dengan parameter filter dan sorting
async function fetchItems() {
  DOM.loadingSpinner.classList.remove('hidden');
  DOM.tableWrapper.classList.add('hidden');
  DOM.gridWrapper.classList.add('hidden');
  DOM.emptyState.classList.add('hidden');

  try {
    const params = new URLSearchParams({
      search: state.searchQuery,
      kategori: state.selectedCategory,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    });

    const res = await fetch(`/api/barang?${params.toString()}`);
    const result = await res.json();

    if (result.success) {
      state.items = result.data;
      renderItems();
      fetchStats();
    } else {
      showToast(result.message || 'Gagal memuat barang', 'error');
    }
  } catch (err) {
    showToast('Koneksi terputus ke server database', 'error');
  } finally {
    DOM.loadingSpinner.classList.add('hidden');
  }
}

// Generate kode barang baru otomatis dari server
async function fetchNextCode() {
  try {
    const res = await fetch('/api/generate-code');
    const data = await res.json();
    if (data.success && data.nextCode) {
      DOM.createKode.value = data.nextCode;
    }
  } catch (err) {
    DOM.createKode.value = `BRG-${Date.now().toString().slice(-4)}`;
  }
}

// ======================= RENDERING LOGIC =======================
function renderItems() {
  const items = state.items;
  DOM.visibleCount.textContent = items.length;
  DOM.totalCount.textContent = items.length;

  if (items.length === 0) {
    DOM.tableWrapper.classList.add('hidden');
    DOM.gridWrapper.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');

  if (state.currentView === 'table') {
    renderTable(items);
    DOM.tableWrapper.classList.remove('hidden');
    DOM.gridWrapper.classList.add('hidden');
  } else {
    renderGrid(items);
    DOM.gridWrapper.classList.remove('hidden');
    DOM.tableWrapper.classList.add('hidden');
  }

  refreshIcons();
}

// Render data dalam bentuk Tabel
function renderTable(items) {
  DOM.tableBody.innerHTML = '';

  items.forEach(item => {
    const totalNilai = (Number(item.harga) || 0) * (Number(item.stok) || 0);
    const tr = document.createElement('tr');
    tr.id = `row-item-${item.id}`;
    tr.innerHTML = `
      <td>
        <span class="item-code-badge">${escapeHTML(item.kode_barang)}</span>
      </td>
      <td>
        <div class="item-name-cell">
          <span class="item-name-text">${escapeHTML(item.nama_barang)}</span>
          ${item.deskripsi ? `<span class="item-desc-text" title="${escapeHTML(item.deskripsi)}">${escapeHTML(item.deskripsi)}</span>` : ''}
        </div>
      </td>
      <td>
        <span class="category-tag">${escapeHTML(item.kategori)}</span>
      </td>
      <td class="text-right price-cell">
        ${formatRupiah(item.harga)}
      </td>
      <td class="text-center">
        ${getStockBadge(item.stok)}
      </td>
      <td class="text-right total-cell">
        ${formatRupiah(totalNilai)}
      </td>
      <td class="text-center">
        <div class="action-buttons">
          <button class="table-action-btn btn-view" title="Lihat Detail" onclick="openDetailModal(${item.id})">
            <i data-lucide="eye"></i>
          </button>
          <button class="table-action-btn btn-edit" title="Edit Barang" onclick="openEditModal(${item.id})">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="table-action-btn btn-delete" title="Hapus Barang" onclick="openDeleteModal(${item.id})">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;
    DOM.tableBody.appendChild(tr);
  });
}

// Render data dalam bentuk Grid Cards
function renderGrid(items) {
  DOM.gridWrapper.innerHTML = '';

  items.forEach(item => {
    const totalNilai = (Number(item.harga) || 0) * (Number(item.stok) || 0);
    const card = document.createElement('div');
    card.className = 'grid-card';
    card.id = `card-item-${item.id}`;

    card.innerHTML = `
      <div>
        <div class="grid-header">
          <span class="item-code-badge">${escapeHTML(item.kode_barang)}</span>
          <span class="category-tag">${escapeHTML(item.kategori)}</span>
        </div>
        <h3 class="grid-title">${escapeHTML(item.nama_barang)}</h3>
        <p class="grid-desc">${escapeHTML(item.deskripsi || 'Tidak ada deskripsi khusus.')}</p>
      </div>

      <div>
        <div class="grid-stats-row">
          <div class="grid-stat-col">
            <span class="grid-stat-label">Harga Satuan</span>
            <span class="grid-stat-val text-emerald">${formatRupiah(item.harga)}</span>
          </div>
          <div class="grid-stat-col">
            <span class="grid-stat-label">Stok Fisik</span>
            <span class="grid-stat-val">${getStockBadge(item.stok)}</span>
          </div>
        </div>

        <div class="grid-actions">
          <button class="table-action-btn btn-view" title="Lihat Detail" onclick="openDetailModal(${item.id})">
            <i data-lucide="eye"></i>
          </button>
          <button class="table-action-btn btn-edit" title="Edit Barang" onclick="openEditModal(${item.id})">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="table-action-btn btn-delete" title="Hapus Barang" onclick="openDeleteModal(${item.id})">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;

    DOM.gridWrapper.appendChild(card);
  });
}

// ======================= MODAL CONTROLS =======================

function openModal(modalEl) {
  modalEl.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalEl) {
  modalEl.classList.add('hidden');
  document.body.style.overflow = '';
}

// Modal Tambah Barang
async function openCreateModal() {
  DOM.formCreate.reset();
  await fetchNextCode();
  DOM.createHargaPreview.textContent = 'Rp 0';
  DOM.createStokBadge.textContent = 'Status: 0 unit';
  openModal(DOM.modalCreate);
  setTimeout(() => DOM.createNama.focus(), 100);
  refreshIcons();
}

// Modal Edit Barang
function openEditModal(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;

  DOM.editId.value = item.id;
  DOM.editKode.value = item.kode_barang;
  DOM.editNama.value = item.nama_barang;
  DOM.editKategori.value = item.kategori;
  DOM.editHarga.value = item.harga;
  DOM.editHargaPreview.textContent = formatRupiah(item.harga);
  DOM.editStok.value = item.stok;
  DOM.editDeskripsi.value = item.deskripsi || '';

  openModal(DOM.modalEdit);
  setTimeout(() => DOM.editNama.focus(), 100);
  refreshIcons();
}

// Modal Detail Barang
function openDetailModal(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;

  state.activeDetailItem = item;
  const totalNilai = (Number(item.harga) || 0) * (Number(item.stok) || 0);

  DOM.detailNama.textContent = item.nama_barang;
  DOM.detailKode.textContent = item.kode_barang;
  DOM.detailKategori.textContent = item.kategori;
  DOM.detailHarga.textContent = formatRupiah(item.harga);
  DOM.detailStok.textContent = `${item.stok} Unit`;
  DOM.detailTotalValue.textContent = formatRupiah(totalNilai);
  DOM.detailStatusPill.innerHTML = getStockBadge(item.stok);
  DOM.detailDeskripsi.textContent = item.deskripsi || 'Tidak ada deskripsi khusus.';
  DOM.detailCreated.textContent = formatDate(item.created_at);
  DOM.detailUpdated.textContent = formatDate(item.updated_at);

  openModal(DOM.modalDetail);
  refreshIcons();
}

// Modal Konfirmasi Hapus
function openDeleteModal(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;

  state.itemToDelete = item;
  DOM.deleteItemName.textContent = item.nama_barang;
  DOM.deleteItemCode.textContent = item.kode_barang;

  openModal(DOM.modalDelete);
  refreshIcons();
}

// Buat fungsi modal bisa dipanggil secara global dari inline onclick
window.openDetailModal = openDetailModal;
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;

// ======================= FORM SUBMISSIONS (CRUD) =======================

// SUBMIT TAMBAH BARANG (CREATE)
DOM.formCreate.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    kode_barang: DOM.createKode.value.trim(),
    nama_barang: DOM.createNama.value.trim(),
    kategori: DOM.createKategori.value.trim() || 'Umum',
    harga: parseFloat(DOM.createHarga.value) || 0,
    stok: parseInt(DOM.createStok.value, 10) || 0,
    deskripsi: DOM.createDeskripsi.value.trim()
  };

  if (!payload.nama_barang) {
    showToast('Nama barang wajib diisi!', 'error');
    DOM.createNama.focus();
    return;
  }

  const submitBtn = document.getElementById('btn-submit-create');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;margin:0"></span> Menyimpan...`;

  try {
    const res = await fetch('/api/barang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.success) {
      showToast(result.message || 'Barang berhasil ditambahkan!', 'success');
      closeModal(DOM.modalCreate);
      fetchItems();
    } else {
      showToast(result.message || 'Gagal menambahkan barang', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan saat menyimpan barang', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i data-lucide="check"></i> <span>Simpan Barang</span>`;
    refreshIcons();
  }
});

// SUBMIT EDIT BARANG (UPDATE)
DOM.formEdit.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = parseInt(DOM.editId.value, 10);
  const payload = {
    kode_barang: DOM.editKode.value.trim(),
    nama_barang: DOM.editNama.value.trim(),
    kategori: DOM.editKategori.value.trim() || 'Umum',
    harga: parseFloat(DOM.editHarga.value) || 0,
    stok: parseInt(DOM.editStok.value, 10) || 0,
    deskripsi: DOM.editDeskripsi.value.trim()
  };

  if (!payload.nama_barang) {
    showToast('Nama barang wajib diisi!', 'error');
    DOM.editNama.focus();
    return;
  }

  const submitBtn = document.getElementById('btn-submit-edit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;margin:0"></span> Menyimpan...`;

  try {
    const res = await fetch(`/api/barang/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.success) {
      showToast(result.message || 'Data barang berhasil diperbarui!', 'success');
      closeModal(DOM.modalEdit);
      fetchItems();
    } else {
      showToast(result.message || 'Gagal memperbarui data barang', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan saat memperbarui barang', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i data-lucide="save"></i> <span>Simpan Perubahan</span>`;
    refreshIcons();
  }
});

// SUBMIT HAPUS BARANG (DELETE)
DOM.btnConfirmDelete.addEventListener('click', async () => {
  if (!state.itemToDelete) return;

  const id = state.itemToDelete.id;
  DOM.btnConfirmDelete.disabled = true;
  DOM.btnConfirmDelete.innerHTML = `<span class="spinner" style="width:16px;height:16px;margin:0"></span> Menghapus...`;

  try {
    const res = await fetch(`/api/barang/${id}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.success) {
      showToast(result.message || 'Barang berhasil dihapus!', 'success');
      closeModal(DOM.modalDelete);
      state.itemToDelete = null;
      fetchItems();
    } else {
      showToast(result.message || 'Gagal menghapus barang', 'error');
    }
  } catch (err) {
    showToast('Gagal menghapus barang dari server', 'error');
  } finally {
    DOM.btnConfirmDelete.disabled = false;
    DOM.btnConfirmDelete.innerHTML = `<i data-lucide="trash-2"></i> <span>Ya, Hapus Barang</span>`;
    refreshIcons();
  }
});

// ======================= EVENT LISTENERS =======================

// Tombol Tutup Modal (semua elemen dengan attribute data-close-modal)
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close-modal]');
  if (closeBtn) {
    const targetModalId = closeBtn.getAttribute('data-close-modal');
    const targetModal = document.getElementById(targetModalId);
    if (targetModal) closeModal(targetModal);
  }

  // Klik di luar jendela modal (backdrop) untuk menutup
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target);
  }
});

// Escape key listener untuk menutup modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    [DOM.modalCreate, DOM.modalEdit, DOM.modalDetail, DOM.modalDelete].forEach(modal => {
      if (modal && !modal.classList.contains('hidden')) {
        closeModal(modal);
      }
    });
  }
});

// Tombol Buka Modal Tambah Barang
DOM.btnOpenCreateModal.addEventListener('click', openCreateModal);
DOM.btnEmptyAdd.addEventListener('click', openCreateModal);

// Auto-generate code button
DOM.btnGenCode.addEventListener('click', fetchNextCode);

// Live preview harga saat mengetik di form create & edit
DOM.createHarga.addEventListener('input', () => {
  DOM.createHargaPreview.textContent = formatRupiah(DOM.createHarga.value);
});

DOM.createStok.addEventListener('input', () => {
  const val = parseInt(DOM.createStok.value, 10) || 0;
  DOM.createStokBadge.textContent = `Status: ${val} unit (${val <= 5 ? 'Perlu Restock' : 'Aman'})`;
});

DOM.editHarga.addEventListener('input', () => {
  DOM.editHargaPreview.textContent = formatRupiah(DOM.editHarga.value);
});

// Tombol edit langsung dari modal detail
DOM.btnDetailEdit.addEventListener('click', () => {
  if (state.activeDetailItem) {
    closeModal(DOM.modalDetail);
    openEditModal(state.activeDetailItem.id);
  }
});

// Live Search dengan debounce
let searchDebounceTimer = null;
DOM.inputSearch.addEventListener('input', () => {
  const query = DOM.inputSearch.value.trim();
  DOM.btnClearSearch.classList.toggle('hidden', query.length === 0);

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    state.searchQuery = query;
    fetchItems();
  }, 250);
});

DOM.btnClearSearch.addEventListener('click', () => {
  DOM.inputSearch.value = '';
  DOM.btnClearSearch.classList.add('hidden');
  state.searchQuery = '';
  fetchItems();
});

// Filter Kategori
DOM.selectCategory.addEventListener('change', () => {
  state.selectedCategory = DOM.selectCategory.value;
  fetchItems();
});

// Sort Pilihan
DOM.selectSort.addEventListener('change', () => {
  const [col, order] = DOM.selectSort.value.split('-');
  state.sortBy = col;
  state.sortOrder = order;
  fetchItems();
});

// View Switcher (Table vs Grid)
DOM.btnViewTable.addEventListener('click', () => {
  state.currentView = 'table';
  DOM.btnViewTable.classList.add('active');
  DOM.btnViewGrid.classList.remove('active');
  renderItems();
});

DOM.btnViewGrid.addEventListener('click', () => {
  state.currentView = 'grid';
  DOM.btnViewGrid.classList.add('active');
  DOM.btnViewTable.classList.remove('active');
  renderItems();
});

// Segarkan data
DOM.btnRefresh.addEventListener('click', () => {
  fetchItems();
  checkHealth();
  showToast('Data inventaris berhasil disegarkan', 'info');
});

// Theme Switcher
function applyTheme(theme) {
  state.theme = theme;
  document.body.className = `theme-${theme}`;
  localStorage.setItem('cloudstore_theme', theme);
  DOM.themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
  refreshIcons();
}

DOM.btnThemeToggle.addEventListener('click', () => {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
});

// ======================= INISIALISASI =======================
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  refreshIcons();
  checkHealth();
  fetchItems();
  fetchStats();
});
