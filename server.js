require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./models/User');

const app = express();
app.use(express.json());
app.use(cors());
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret123';

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('✅ MongoDB Connected'))
  .catch(err=> console.error('❌ MongoDB Error:', err));

// Middleware for checking token
// Normalise + de-duplicate a watchlist (same TMDB title, or same name for old items)
const toDate = v => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d : undefined; };
function cleanList(list) {
  const map = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const name = String(raw?.name || '').trim().slice(0, 200);
    if (!name) continue;
    const mediaType = ['movie', 'tv'].includes(raw.mediaType) ? raw.mediaType : '';
    const tmdbId = Number(raw.tmdbId) || 0;
    const key = tmdbId ? `${mediaType}:${tmdbId}` : `n:${name.toLowerCase()}`;
    const prev = map.get(key);
    if (prev) {
      prev.watched = prev.watched || !!raw.watched;
      if (!prev.addedAt) prev.addedAt = toDate(raw.addedAt);
    } else {
      map.set(key, {
        name, watched: !!raw.watched, poster: String(raw.poster || ''),
        tmdbId, mediaType, year: String(raw.year || '').slice(0, 4),
        addedAt: toDate(raw.addedAt)
      });
    }
  }
  return [...map.values()];
}

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(payload.id);
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// 🔐 Login or Auto-Register
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  let user = await User.findOne({ username });
  let created = false;
  if (!user) {
    created = true;
    const hash = await bcrypt.hash(password, 10);
    user = new User({ username, password: hash });
    await user.save();
  } else {
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
  }

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, created });
});

// 📥 Get Watchlist (read-only: it never modifies the database)
app.get('/api/watchlist', auth, async (req, res) => {
  res.json({ watchlist: cleanList(req.user.watchlist) });
});

// 💾 Save Watchlist (atomic $set, with data-loss protection)
app.post('/api/watchlist', auth, async (req, res) => {
  const cleaned = cleanList(req.body.watchlist);
  const old = req.user.watchlist || [];
  // never replace a saved list with an empty one unless the client says it was deliberate
  if (cleaned.length === 0 && old.length > 0 && !req.body.confirmEmpty) {
    return res.status(409).json({ error: 'Refusing to replace a saved list with an empty one' });
  }
  const set = { watchlist: cleaned };
  // if a save would remove more than one title, keep the previous list so it can be restored
  if (old.length - cleaned.length > 1) set.watchlistBackup = cleanList(old);
  await User.updateOne({ _id: req.user._id }, { $set: set });
  res.json({ success: true, watchlist: cleaned });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
