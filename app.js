import express from 'express';
import mongoose from 'mongoose';

const app = express();
const PORT = 3000;
const MONGO_URI = 'mongodb+srv://nareshsirvi:123Naresh@cluster0.qpr3xle.mongodb.net/express'
const API_TOKEN = '12345';

const urlSchema = new mongoose.Schema({
  originalUrl: String,
  shortCode: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  hitCount: { type: Number, default: 0 }
});
const Url = mongoose.model('Url', urlSchema);

const logger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};

const auth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token || token !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use(express.json());
app.use(logger);

app.post('/shorturls', auth, async (req, res) => {
  try {
    const { url, validity = 60, shortcode } = req.body;
    const shortCode = shortcode || Math.random().toString(36).substring(2, 8);
    const expiresAt = new Date(Date.now() + validity * 60 * 1000);
    await Url.create({ originalUrl: url, shortCode, expiresAt });
    res.status(201).json({
      shortlink: `${req.protocol}://${req.get('host')}/shorturls/go/${shortCode}`,
      expiry: expiresAt
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/shorturls/go/:shortCode', async (req, res) => {
  try {
    const urlDoc = await Url.findOne({ shortCode: req.params.shortCode });
    if (!urlDoc) throw new Error('Short URL not found');
    if (new Date() > urlDoc.expiresAt) throw new Error('URL expired');
    urlDoc.hitCount++;
    await urlDoc.save();
    res.redirect(urlDoc.originalUrl);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/shorturls/:shortCode', auth, async (req, res) => {
  try {
    const doc = await Url.findOne({ shortCode: req.params.shortCode });
    if (!doc) return res.status(404).json({ error: 'Short URL not found' });
    res.json({
      originalUrl: doc.originalUrl,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      hitCount: doc.hitCount
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

mongoose.connect(MONGO_URI).then(() => {
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(` Server running at http://localhost:${PORT}`));
}).catch(err => console.error(' MongoDB connection failed:', err));
