const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan file statis frontend dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// =================== REST API ENDPOINTS ===================

// Health check endpoint (Sangat berguna untuk Azure App Service Health Probe)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Aplikasi Web CRUD Inventaris Barang berjalan lancar di Azure App Service!',
    environment: process.env.NODE_ENV || 'development',
    azureAppService: Boolean(process.env.WEBSITE_SITE_NAME),
    siteName: process.env.WEBSITE_SITE_NAME || 'Local Environment',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// GET /api/stats - Ringkasan statistik inventaris
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil data statistik', error: error.message });
  }
});

// GET /api/generate-code - Dapatkan rekomendasi kode barang berikutnya
app.get('/api/generate-code', (req, res) => {
  try {
    const nextCode = db.generateKodeBarang();
    res.json({ success: true, nextCode });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal membuat kode barang', error: error.message });
  }
});

// GET /api/barang - Ambil semua barang (dengan filter pencarian, kategori, dan sorting)
app.get('/api/barang', (req, res) => {
  try {
    const { search, kategori, sortBy, sortOrder } = req.query;
    const items = db.getAll({ search, kategori, sortBy, sortOrder });
    res.json({
      success: true,
      total: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil data barang', error: error.message });
  }
});

// GET /api/barang/:id - Ambil satu barang berdasarkan ID
app.get('/api/barang/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const item = db.getById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil detail barang', error: error.message });
  }
});

// POST /api/barang - Tambah barang baru (CREATE)
app.post('/api/barang', (req, res) => {
  try {
    const { kode_barang, nama_barang, kategori, harga, stok, deskripsi } = req.body;

    // Validasi input
    if (!nama_barang || !nama_barang.trim()) {
      return res.status(400).json({ success: false, message: 'Nama barang wajib diisi' });
    }
    if (harga === undefined || harga === null || harga === '' || isNaN(harga) || Number(harga) < 0) {
      return res.status(400).json({ success: false, message: 'Harga harus berupa angka dan minimal 0' });
    }
    if (stok === undefined || stok === null || stok === '' || isNaN(stok) || Number(stok) < 0) {
      return res.status(400).json({ success: false, message: 'Stok harus berupa angka bulat dan minimal 0' });
    }

    const newItem = db.create({
      kode_barang,
      nama_barang,
      kategori: kategori || 'Umum',
      harga: Number(harga),
      stok: Number(stok),
      deskripsi: deskripsi || ''
    });

    res.status(201).json({
      success: true,
      message: 'Barang berhasil ditambahkan ke inventaris!',
      data: newItem
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/barang/:id - Perbarui barang (UPDATE)
app.put('/api/barang/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { kode_barang, nama_barang, kategori, harga, stok, deskripsi } = req.body;

    if (!nama_barang || !nama_barang.trim()) {
      return res.status(400).json({ success: false, message: 'Nama barang wajib diisi' });
    }
    if (harga !== undefined && (isNaN(harga) || Number(harga) < 0)) {
      return res.status(400).json({ success: false, message: 'Harga harus berupa angka dan minimal 0' });
    }
    if (stok !== undefined && (isNaN(stok) || Number(stok) < 0)) {
      return res.status(400).json({ success: false, message: 'Stok harus berupa angka bulat dan minimal 0' });
    }

    const updated = db.update(id, {
      kode_barang,
      nama_barang,
      kategori,
      harga: Number(harga),
      stok: Number(stok),
      deskripsi
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }

    res.json({
      success: true,
      message: 'Data barang berhasil diperbarui!',
      data: updated
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/barang/:id - Hapus barang (DELETE)
app.delete('/api/barang/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = db.remove(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }

    res.json({
      success: true,
      message: 'Barang berhasil dihapus dari inventaris!'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menghapus barang', error: error.message });
  }
});

// Fallback untuk SPA / Frontend jika route tidak cocok
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mulai inisialisasi database lalu jalankan server
db.initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Server Inventaris Barang Berjalan di Port: ${PORT}`);
      console.log(`🔗 Akses Lokal : http://localhost:${PORT}`);
      console.log(`☁️  Mode Azure   : ${process.env.WEBSITE_SITE_NAME ? 'Aktif (' + process.env.WEBSITE_SITE_NAME + ')' : 'Lokal / Non-Azure'}`);
      console.log(`====================================================`);
    });
  })
  .catch((err) => {
    console.error('Kritis: Gagal menginisialisasi database SQLite:', err);
    process.exit(1);
  });
