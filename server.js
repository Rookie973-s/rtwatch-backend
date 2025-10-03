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

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret123';

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('✅ MongoDB Connected'))
  .catch(err=> console.error('❌ MongoDB Error:', err));

// Middleware for checking token
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
  if (!user) {
    const hash = await bcrypt.hash(password, 10);
    user = new User({ username, password: hash });
    await user.save();
  } else {
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
  }

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// 📥 Get Watchlist
app.get('/api/watchlist', auth, async (req, res) => {
  res.json({ watchlist: req.user.watchlist || [] });
});

// 💾 Save Watchlist
app.post('/api/watchlist', auth, async (req, res) => {
  req.user.watchlist = req.body.watchlist || [];
  await req.user.save();
  res.json({ success: true });
});

app.listen(PORT, () => console.log('🚀Server running on port ${PORT}')
);