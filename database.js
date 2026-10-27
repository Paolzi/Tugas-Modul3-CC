const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'inventory.db');

let db = null;

// Pastikan direktori data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper untuk menyimpan database ke file disk
function saveToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Gagal menyimpan database ke disk:', err);
  }
}

// Inisialisasi Database
async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('✓ Database SQLite berhasil dimuat dari file disk:', DB_PATH);
    } catch (err) {
      console.warn('File database korup atau tidak dapat dibaca, membuat database baru:', err.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('✓ Database SQLite baru berhasil diinisialisasi.');
  }

  // Buat tabel jika belum ada
  db.run(`
    CREATE TABLE IF NOT EXISTS barang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_barang TEXT UNIQUE NOT NULL,
      nama_barang TEXT NOT NULL,
      kategori TEXT NOT NULL,
      harga REAL NOT NULL,
      stok INTEGER NOT NULL,
      deskripsi TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Periksa apakah tabel kosong, jika ya buat data awal (seed)
  const countResult = db.exec('SELECT COUNT(*) as count FROM barang');
  const totalRows = (countResult[0] && countResult[0].values[0][0]) || 0;

  if (totalRows === 0) {
    console.log('Menambahkan data awal (seeding sample data)...');
    const now = new Date().toISOString();
    const seedItems = [
      ['BRG-001', 'Laptop ASUS VivoBook 14', 'Elektronik', 8500000, 12, 'Laptop Intel Core i5, RAM 8GB, SSD 512GB untuk kebutuhan komputasi harian.', now, now],
      ['BRG-002', 'Mouse Wireless Logitech M330', 'Aksesoris Komputer', 215000, 35, 'Mouse silent click ergonomis dengan koneksi nirkabel 2.4GHz.', now, now],
      ['BRG-003', 'Keyboard Mechanical RGB', 'Aksesoris Komputer', 480000, 7, 'Keyboard mechanical blue switch dengan lampu latar RGB 16 mode.', now, now],
      ['BRG-004', 'Monitor LED 24 Inch IPS 75Hz', 'Elektronik', 1650000, 15, 'Monitor bezel-less Full HD dengan panel IPS sudut pandang luas.', now, now],
      ['BRG-005', 'Flashdisk SanDisk Ultra 64GB', 'Penyimpanan', 85000, 50, 'USB 3.0 kecepatan transfer tinggi hingga 130MB/s.', now, now],
      ['BRG-006', 'Meja Kerja Minimalis Ergonomis', 'Perabot Kantor', 720000, 4, 'Meja kayu solid modern dengan rangka besi kokoh tahan beban 80kg.', now, now]
    ];

    const stmt = db.prepare(`
      INSERT INTO barang (kode_barang, nama_barang, kategori, harga, stok, deskripsi, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    seedItems.forEach(item => stmt.run(item));
    stmt.free();
    saveToDisk();
    console.log(`✓ Berhasil menambahkan ${seedItems.length} data awal barang.`);
  }

  saveToDisk();
  return db;
}

// Convert hasil SQL query ke format Array of Objects
function queryRows(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Generate kode barang baru otomatis (BRG-001, BRG-002, dst)
function generateKodeBarang() {
  const res = queryRows('SELECT kode_barang FROM barang ORDER BY id DESC LIMIT 1');
  if (res.length === 0) return 'BRG-001';
  const lastCode = res[0].kode_barang;
  const match = lastCode.match(/BRG-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `BRG-${String(nextNum).padStart(3, '0')}`;
  }
  return `BRG-${Date.now().toString().slice(-4)}`;
}

// Ambil semua barang dengan fitur pencarian & filter
function getAll({ search, kategori, sortBy = 'id', sortOrder = 'DESC' } = {}) {
  let sql = 'SELECT * FROM barang WHERE 1=1';
  const params = [];

  if (search && search.trim()) {
    sql += ' AND (nama_barang LIKE ? OR kode_barang LIKE ? OR deskripsi LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (kategori && kategori.trim() && kategori !== 'Semua') {
    sql += ' AND kategori = ?';
    params.push(kategori.trim());
  }

  // Sanitasi kolom sortir
  const validSortCols = ['id', 'nama_barang', 'kategori', 'harga', 'stok', 'created_at'];
  const sortCol = validSortCols.includes(sortBy) ? sortBy : 'id';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  sql += ` ORDER BY ${sortCol} ${order}`;

  return queryRows(sql, params);
}

// Ambil barang berdasarkan ID
function getById(id) {
  const rows = queryRows('SELECT * FROM barang WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}

// Tambah barang baru (CREATE)
function create({ kode_barang, nama_barang, kategori, harga, stok, deskripsi }) {
  const kode = (kode_barang && kode_barang.trim()) ? kode_barang.trim().toUpperCase() : generateKodeBarang();
  const now = new Date().toISOString();

  // Validasi kode unik
  const existing = queryRows('SELECT id FROM barang WHERE kode_barang = ?', [kode]);
  if (existing.length > 0) {
    throw new Error(`Kode barang '${kode}' sudah digunakan oleh barang lain.`);
  }

  const parsedHarga = Math.max(0, parseFloat(harga) || 0);
  const parsedStok = Math.max(0, parseInt(stok, 10) || 0);

  db.run(`
    INSERT INTO barang (kode_barang, nama_barang, kategori, harga, stok, deskripsi, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    kode,
    nama_barang.trim(),
    kategori ? kategori.trim() : 'Umum',
    parsedHarga,
    parsedStok,
    deskripsi ? deskripsi.trim() : '',
    now,
    now
  ]);

  saveToDisk();

  // Ambil record yang baru saja dibuat
  const lastInserted = queryRows('SELECT * FROM barang WHERE kode_barang = ?', [kode]);
  return lastInserted[0];
}

// Perbarui barang (UPDATE)
function update(id, { kode_barang, nama_barang, kategori, harga, stok, deskripsi }) {
  const current = getById(id);
  if (!current) {
    return null;
  }

  const kode = (kode_barang && kode_barang.trim()) ? kode_barang.trim().toUpperCase() : current.kode_barang;

  // Cek duplikasi kode pada ID lain
  const duplicate = queryRows('SELECT id FROM barang WHERE kode_barang = ? AND id != ?', [kode, id]);
  if (duplicate.length > 0) {
    throw new Error(`Kode barang '${kode}' sudah digunakan oleh barang lain.`);
  }

  const now = new Date().toISOString();
  const parsedHarga = harga !== undefined ? Math.max(0, parseFloat(harga) || 0) : current.harga;
  const parsedStok = stok !== undefined ? Math.max(0, parseInt(stok, 10) || 0) : current.stok;

  db.run(`
    UPDATE barang 
    SET kode_barang = ?, nama_barang = ?, kategori = ?, harga = ?, stok = ?, deskripsi = ?, updated_at = ?
    WHERE id = ?
  `, [
    kode,
    nama_barang ? nama_barang.trim() : current.nama_barang,
    kategori ? kategori.trim() : current.kategori,
    parsedHarga,
    parsedStok,
    deskripsi !== undefined ? deskripsi.trim() : current.deskripsi,
    now,
    id
  ]);

  saveToDisk();
  return getById(id);
}

// Hapus barang (DELETE)
function remove(id) {
  const current = getById(id);
  if (!current) return false;

  db.run('DELETE FROM barang WHERE id = ?', [id]);
  saveToDisk();
  return true;
}

// Ambil ringkasan statistik inventaris
function getStats() {
  const totalItemsRes = queryRows('SELECT COUNT(*) as total_items, SUM(stok) as total_stock, SUM(harga * stok) as total_value FROM barang');
  const categoriesRes = queryRows('SELECT DISTINCT kategori FROM barang');
  const lowStockRes = queryRows('SELECT COUNT(*) as low_stock FROM barang WHERE stok <= 5');

  const row = totalItemsRes[0] || {};
  return {
    totalItems: row.total_items || 0,
    totalStock: row.total_stock || 0,
    totalValue: row.total_value || 0,
    totalCategories: categoriesRes.length,
    lowStockItems: (lowStockRes[0] && lowStockRes[0].low_stock) || 0,
    categories: categoriesRes.map(c => c.kategori)
  };
}

module.exports = {
  initDatabase,
  getAll,
  getById,
  create,
  update,
  remove,
  getStats,
  generateKodeBarang
};
