// models/User.js
const mongoose = require('mongoose');

const WatchItem = new mongoose.Schema({
  name: String,
  watched: { type: Boolean, default: false },
  poster: { type: String, default: '' }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  watchlist: { type: [WatchItem], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);