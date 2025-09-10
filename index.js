// ===================================================================
// 1. IMPORT SEMUA LIBRARY YANG DIBUTUHKAN
// ===================================================================
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ===================================================================
// 2. INISIALISASI & KONFIGURASI
// ===================================================================
const app = express();
app.use(cors());
// ... (bagian import)

const app = express();
app.use(cors()); // <-- PASTIKAN BARIS INI ADA DI ATAS
app.use(express.json({ limit: '50mb' })); // <-- Tambahkan ini juga dari perbaikan sebelumnya
// ... (sisa kode)

// Konfigurasi Cloudinary (wajib diisi di Environment Variables Railway)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Konfigurasi Multer untuk penyimpanan di Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat-app-images',
    format: async (req, file) => 'png', // mendukung format jpg, png, dll.
    public_id: (req, file) => `image-${Date.now()}`,
  },
});
const upload = multer({ storage: storage });

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ===================================================================
// 3. KONEKSI KE DATABASE MONGODB ATLAS
// ===================================================================
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Sukses terhubung ke MongoDB Atlas.'))
  .catch((err) => console.error('Gagal terhubung ke MongoDB:', err));

// ===================================================================
// 4. SKEMA & MODEL DATABASE
// ===================================================================
const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  message: { type: String, default: '' },
  imageUrl: { type: String, default: '' }, // Field untuk URL gambar
  isModerator: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// ===================================================================
// 5. API ENDPOINTS
// ===================================================================
// Rute untuk Health Check Railway
app.get('/', (req, res) => {
  res.status(200).send('Health check successful. Server is running.');
});

// BARU: Rute untuk mengunggah gambar
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
  }
  // Mengembalikan URL aman yang diberikan oleh Cloudinary
  res.status(200).json({ imageUrl: req.file.path });
});

// ===================================================================
// 6. LOGIKA UTAMA SOCKET.IO
// ===================================================================
io.on('connection', async (socket) => {
  console.log(`User terhubung dengan ID: ${socket.id}`);

  try {
    const chatHistory = await Message.find({}).sort({ timestamp: 1 }).limit(100);
    socket.emit('chat_history', chatHistory);
  } catch (error) {
    console.error('Gagal mengambil riwayat chat:', error);
  }

  socket.on('send_message', async (data) => {
    const FUZI_SECRET_PASSWORD = "qwerty";
    let isModerator = false;
    if (data.user && data.user.toLowerCase() === 'fuzi' && data.password === FUZI_SECRET_PASSWORD) {
        isModerator = true;
    }

    const newMessage = new Message({
      user: data.user,
      message: data.message,
      imageUrl: data.imageUrl || '', // Simpan URL gambar jika ada
      isModerator: isModerator,
    });
    
    try {
      const savedMessage = await newMessage.save();
      socket.broadcast.emit('receive_message', savedMessage);
    } catch (error) {
      console.error("!!! ERROR: Gagal menyimpan pesan:", error);
    }
  });

  socket.on('delete_message', async (data) => {
      try {
          const message = await Message.findById(data.messageId);
          if (message && (message.user === data.user || data.isModerator)) {
              message.isDeleted = true;
              message.message = "[Pesan ini telah dihapus]";
              message.imageUrl = ''; // Hapus juga URL gambar saat pesan dihapus
              const updatedMessage = await message.save();
              io.emit('message_updated', updatedMessage);
          }
      } catch (error) {
          console.error("!!! ERROR: Gagal menghapus pesan:", error);
      }
  });

  socket.on('disconnect', () => {
    console.log(`User terputus: ${socket.id}`);
  });
});

// ===================================================================
// 7. JALANKAN SERVER
// ===================================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
