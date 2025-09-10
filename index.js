// ===================================================================
// KODE LENGKAP - server/index.js
// ===================================================================
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// --- Inisialisasi & Konfigurasi ---
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'chat-app-files', resource_type: 'auto' },
});
const upload = multer({ storage: storage });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] }});

// --- Koneksi Database ---
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Sukses terhubung ke MongoDB Atlas.'))
  .catch((err) => console.error('Gagal terhubung ke MongoDB:', err));

// --- Skema & Model Database ---
const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  message: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  stickerId: { type: String, default: '' },
  isModerator: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// --- API Endpoints ---
app.get('/', (req, res) => {
  res.status(200).send('Health check successful. Server is running.');
});
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
  }
  const url = req.file.path;
  const isVideo = req.file.resource_type === 'video';
  res.status(200).json({
    imageUrl: isVideo ? '' : url,
    videoUrl: isVideo ? url : ''
  });
});

// --- Logika Socket.IO ---
io.on('connection', async (socket) => {
  // ... (sisa logika socket.io tidak berubah)
  // ...
});

// --- Jalankan Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
