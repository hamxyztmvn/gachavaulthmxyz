require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express();

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret';
const ADMIN_KEY = process.env.ADMIN_KEY || 'HAMXYZ-ADMIN-2026';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI, ttl: 14 * 24 * 60 * 60 }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true }
}));

// Multer memory storage (max 2MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.zip', '.rar', '.apk', '.pdf', '.docx', '.txt', '.jpg', '.png', '.js', '.py', '.html', '.json'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format file tidak diizinkan'));
  }
});

// ==================== MODELS ====================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 3 },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  refCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  credits: { type: Number, default: 100 },
  referralCount: { type: Number, default: 0 },
  gachaCount: { type: Number, default: 0 },
  lastGachaTime: Date,
  ownedPrizes: [{
    prizeId: String,
    name: String,
    rarity: String,
    obtainedAt: Date,
    downloadToken: String,
    downloaded: { type: Boolean, default: false }
  }],
  banned: { type: Boolean, default: false }
}, { timestamps: true });

const prizeSchema = new mongoose.Schema({
  name: String,
  thumbnail: { type: String, default: '' },
  description: { type: String, default: '' },
  category: { type: String, enum: ['Script', 'Panel', 'Function', 'APK', 'Source Code', 'Database', 'E-Book', 'Tools', 'Lainnya'], default: 'Lainnya' },
  rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'], default: 'common' },
  isBuiltIn: { type: Boolean, default: true },
  fileBuffer: Buffer,
  mimeType: String,
  originalName: String,
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' }
}, { timestamps: true });

const fileUploadSchema = new mongoose.Schema({
  originalName: String,
  mimeType: String,
  fileBuffer: Buffer,
  size: Number,
  category: String,
  description: String,
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  prizeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prize' }
}, { timestamps: true });

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', userSchema);
const Prize = mongoose.model('Prize', prizeSchema);
const FileUpload = mongoose.model('FileUpload', fileUploadSchema);
const Setting = mongoose.model('Setting', settingSchema);

// ==================== SEEDER ====================
async function seed() {
  const prizeCount = await Prize.countDocuments();
  if (prizeCount === 0) {
    await Prize.insertMany([
      { name: 'WhatsApp Bot Premium v4', category: 'Script', rarity: 'rare', isBuiltIn: true, description: 'Bot WhatsApp full fitur.' },
      { name: 'Panel Pterodactyl VIP', category: 'Panel', rarity: 'epic', isBuiltIn: true, description: 'Panel manajemen server VIP.' },
      { name: 'Function Bug WA 2026', category: 'Function', rarity: 'legendary', isBuiltIn: true, description: 'Script bug WhatsApp terbaru.' },
      { name: 'APK Netflix Premium Mod', category: 'APK', rarity: 'uncommon', isBuiltIn: true, description: 'APK Netflix premium gratis.' },
      { name: 'Source Code Website E-Commerce', category: 'Source Code', rarity: 'rare', isBuiltIn: true, description: 'Full source code React+Node.js.' },
      { name: 'E-Book Hacking Dasar', category: 'E-Book', rarity: 'common', isBuiltIn: true, description: 'Panduan hacking pemula.' },
      { name: 'Tool Auto Claim Kuota', category: 'Tools', rarity: 'uncommon', isBuiltIn: true, description: 'Script auto claim kuota.' },
      { name: 'Database Premium 10M Data', category: 'Database', rarity: 'mythic', isBuiltIn: true, description: 'Database marketing 10 juta data.' }
    ]);
  }
  const settingCount = await Setting.countDocuments();
  if (settingCount === 0) {
    await Setting.insertMany([
      { key: 'siteName', value: 'GachaVault' },
      { key: 'logo', value: '⚡' },
      { key: 'channelLink', value: 'https://whatsapp.com/channel/0029VaFakeChannelExample' },
      { key: 'channelPopupTitle', value: 'Wajib Ikuti Channel Resmi!' },
      { key: 'channelPopupDesc', value: 'Dapatkan update terbaru dan hadiah eksklusif.' },
      { key: 'gachaCooldown', value: 10 },
      { key: 'gachaCost', value: 10 },
      { key: 'refBonus', value: 150 },
      { key: 'newUserRefBonus', value: 50 },
      { key: 'defaultCredits', value: 100 },
      { key: 'dropRates', value: { common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 2, mythic: 1 } },
      { key: 'themeColor', value: '#6c5ce7' },
      { key: 'adminKey', value: ADMIN_KEY }
    ]);
  }
}
seed();

// ==================== HELPERS ====================
function isAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login diperlukan' });
  next();
}
function isAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Akses admin saja' });
  next();
}
function generateRefCode(username) {
  return 'HAMXYZ' + username.substring(0,3).toUpperCase() + Math.random().toString(36).substring(2,6).toUpperCase();
}

// ==================== ROUTES ====================
// Public settings
app.get('/api/public-settings', async (req, res) => {
  const keys = ['siteName', 'logo', 'channelLink', 'channelPopupTitle', 'channelPopupDesc'];
  const settings = await Setting.find({ key: { $in: keys } });
  const result = {};
  settings.forEach(s => result[s.key] = s.value);
  res.json(result);
});

// Auth
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, refCode } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Semua field wajib diisi' });
    if (username.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter' });
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
    const exist = await User.findOne({ $or: [{ username }, { email }] });
    if (exist) return res.status(400).json({ error: 'Username/email sudah terdaftar' });
    const hashed = await bcrypt.hash(password, 12);
    const user = new User({ username, email, password: hashed, refCode: generateRefCode(username) });
    let bonus = parseInt((await Setting.findOne({ key: 'defaultCredits' }))?.value || 100);
    if (refCode) {
      const referrer = await User.findOne({ refCode });
      if (referrer) {
        user.referredBy = referrer._id;
        const newBonus = parseInt((await Setting.findOne({ key: 'newUserRefBonus' }))?.value || 50);
        const refBonus = parseInt((await Setting.findOne({ key: 'refBonus' }))?.value || 150);
        bonus += newBonus;
        referrer.credits += refBonus;
        referrer.referralCount++;
        await referrer.save();
      }
    }
    user.credits = bonus;
    await user.save();
    req.session.userId = user._id;
    req.session.isAdmin = false;
    res.json({ success: true, message: `Akun berhasil dibuat! Bonus ${bonus} koin.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ $or: [{ username }, { email: username }] });
    if (!user) return res.status(400).json({ error: 'User tidak ditemukan' });
    if (user.banned) return res.status(403).json({ error: 'Akun diblokir' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Password salah' });
    req.session.userId = user._id;
    req.session.isAdmin = false;
    res.json({ success: true, message: `Selamat datang, ${user.username}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/session', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = await User.findById(req.session.userId).select('-password');
  res.json({ user, isAdmin: req.session.isAdmin || false });
});

// Gacha
app.post('/api/gacha', isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const cost = parseInt((await Setting.findOne({ key: 'gachaCost' }))?.value || 10);
    const cooldown = parseInt((await Setting.findOne({ key: 'gachaCooldown' }))?.value || 10);
    if (user.credits < cost) return res.status(400).json({ error: 'Koin tidak cukup' });
    if (user.lastGachaTime) {
      const elapsed = (Date.now() - user.lastGachaTime.getTime()) / 1000;
      if (elapsed < cooldown) return res.status(400).json({ error: `Tunggu ${Math.ceil(cooldown - elapsed)} detik lagi` });
    }
    const dropRates = (await Setting.findOne({ key: 'dropRates' }))?.value || { common:50,uncommon:25,rare:15,epic:7,legendary:2,mythic:1 };
    let total = Object.values(dropRates).reduce((a,b)=>a+b,0);
    let r = Math.random() * total;
    let rarity = 'common';
    for (const [k, v] of Object.entries(dropRates)) {
      r -= v;
      if (r <= 0) { rarity = k; break; }
    }
    const prize = await Prize.aggregate([{ $match: { rarity, status: 'approved' } }, { $sample: { size: 1 } }]);
    if (prize.length === 0) return res.status(404).json({ error: 'Hadiah kosong' });
    const won = prize[0];
    user.credits -= cost;
    user.gachaCount++;
    user.lastGachaTime = new Date();
    const token = uuidv4();
    user.ownedPrizes.push({ prizeId: won._id.toString(), name: won.name, rarity: won.rarity, obtainedAt: new Date(), downloadToken: token, downloaded: false });
    await user.save();
    res.json({ success: true, prize: { name: won.name, rarity: won.rarity, description: won.description, category: won.category, downloadToken: won.fileBuffer ? token : null }, credits: user.credits, cooldown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download
app.get('/api/user/download/:token', isAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  const entry = user.ownedPrizes.find(p => p.downloadToken === req.params.token && !p.downloaded);
  if (!entry) return res.status(404).json({ error: 'Hadiah tidak ditemukan atau sudah diunduh' });
  const prize = await Prize.findById(entry.prizeId);
  if (!prize || !prize.fileBuffer) return res.status(404).json({ error: 'File tidak tersedia' });
  entry.downloaded = true;
  await user.save();
  res.set('Content-Type', prize.mimeType || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${prize.originalName || prize.name}"`);
  res.send(prize.fileBuffer);
});

// User prizes
app.get('/api/user/prizes', isAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.json(user.ownedPrizes);
});

// Upload file
app.post('/api/upload', isAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File diperlukan' });
  const { category, description } = req.body;
  const upload = new FileUpload({
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileBuffer: req.file.buffer,
    size: req.file.size,
    category: category || 'Lainnya',
    description: description || '',
    uploader: req.session.userId,
    status: 'pending'
  });
  await upload.save();
  res.json({ success: true, message: 'File diunggah, menunggu persetujuan admin.' });
});

// Referral
app.get('/api/referral', isAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.json({ refCode: user.refCode, refCount: user.referralCount });
});

// ==================== ADMIN ====================
app.post('/api/admin/login', async (req, res) => {
  const { key } = req.body;
  const adminKey = (await Setting.findOne({ key: 'adminKey' }))?.value || ADMIN_KEY;
  if (key === adminKey) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(403).json({ error: 'Kunci admin salah' });
  }
});

app.get('/api/admin/stats', isAdmin, async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalGacha = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$gachaCount' } } }]))[0]?.total || 0;
  const totalPrizes = await Prize.countDocuments({ status: 'approved' });
  const totalUploads = await FileUpload.countDocuments();
  const totalCoins = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$credits' } } }]))[0]?.total || 0;
  res.json({ totalUsers, totalGacha, totalPrizes, totalUploads, totalCoins });
});

app.get('/api/admin/users', isAdmin, async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

app.put('/api/admin/users/:id', isAdmin, async (req, res) => {
  const { credits, banned, password } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (credits !== undefined) user.credits = credits;
  if (banned !== undefined) user.banned = banned;
  if (password) user.password = await bcrypt.hash(password, 12);
  await user.save();
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/files', isAdmin, async (req, res) => {
  const files = await FileUpload.find().populate('uploader', 'username');
  res.json(files);
});

app.put('/api/admin/files/:id', isAdmin, async (req, res) => {
  const { status, rarity } = req.body;
  const upload = await FileUpload.findById(req.params.id);
  if (!upload) return res.status(404).json({ error: 'File tidak ditemukan' });
  upload.status = status;
  if (status === 'approved') {
    const prize = new Prize({
      name: upload.originalName,
      category: upload.category,
      rarity: rarity || 'common',
      description: upload.description,
      isBuiltIn: false,
      fileBuffer: upload.fileBuffer,
      mimeType: upload.mimeType,
      originalName: upload.originalName,
      uploader: upload.uploader,
      status: 'approved'
    });
    await prize.save();
    upload.prizeId = prize._id;
  }
  await upload.save();
  res.json({ success: true });
});

app.get('/api/admin/settings', isAdmin, async (req, res) => {
  const settings = await Setting.find();
  res.json(settings);
});

app.put('/api/admin/settings', isAdmin, async (req, res) => {
  const { key, value } = req.body;
  await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
  res.json({ success: true });
});

app.post('/api/admin/prizes', isAdmin, async (req, res) => {
  const { name, category, rarity, description } = req.body;
  const prize = new Prize({ name, category, rarity: rarity || 'common', description, isBuiltIn: true, status: 'approved' });
  await prize.save();
  res.json({ success: true });
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;
