const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const db = new sqlite3.Database('./deviceEnroll.db', (err) => {
  if (err) {
    console.error('Gagal membuka database', err.message);
  } else {
    console.log('Connected ke SQLite database');
  }
});

// Buat tabel dengan kolom baru jika belum ada
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS devices (
    deviceId TEXT PRIMARY KEY,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT,
    ipAddress TEXT,
    deviceModel TEXT,
    osVersion TEXT,
    adbPort INTEGER,
    enrolledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(deviceId) REFERENCES devices(deviceId)
  )`);
});

// Endpoint admin daftarkan device baru
app.post('/admin/device', (req, res) => {
  const { deviceId, description } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  const checkQuery = 'SELECT deviceId FROM devices WHERE deviceId = ?';
  db.get(checkQuery, [deviceId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      return res.status(400).json({ error: 'Device sudah terdaftar' });
    } else {
      const insertQuery = 'INSERT INTO devices (deviceId, description) VALUES (?, ?)';
      db.run(insertQuery, [deviceId, description || ''], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Device berhasil didaftarkan', deviceId, description });
      });
    }
  });
});

// Endpoint enroll device dengan info tambahan
app.post('/device/enroll', (req, res) => {
  const {
    deviceId,
    ipAddress,
    deviceModel,
    osVersion,
    adbPort
  } = req.body;

  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  // Cek deviceId valid
  const checkQuery = 'SELECT deviceId FROM devices WHERE deviceId = ?';
  db.get(checkQuery, [deviceId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(403).json({ error: 'Device tidak valid atau belum didaftarkan' });

    // Insert enroll dengan data tambahan
    const insertEnroll = `
      INSERT INTO enrollments (deviceId, ipAddress, deviceModel, osVersion, adbPort) 
      VALUES (?, ?, ?, ?, ?)
    `;
    db.run(insertEnroll, [deviceId, ipAddress || '', deviceModel || '', osVersion || '', adbPort || null], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        message: 'Enroll berhasil',
        enrollmentId: this.lastID,
        deviceId,
        ipAddress,
        deviceModel,
        osVersion,
        adbPort,
        enrolledAt: new Date().toISOString()
      });
    });
  });
});

// Endpoint untuk dapatkan list semua device terdaftar
app.get('/admin/devices', (req, res) => {
  const query = 'SELECT deviceId, description FROM devices ORDER BY deviceId';
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ devices: rows });
  });
});

// Endpoint untuk dapatkan list enrollments dengan detail device
app.get('/admin/enrollments', (req, res) => {
  const query = `
    SELECT e.id, e.deviceId, e.ipAddress, e.deviceModel, e.osVersion, e.adbPort, e.enrolledAt, d.description
    FROM enrollments e
    LEFT JOIN devices d ON e.deviceId = d.deviceId
    ORDER BY e.enrolledAt DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({ enrollments: rows });
  });
});


const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
