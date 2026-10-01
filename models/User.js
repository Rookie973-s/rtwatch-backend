// models/User.js
const mongoose = require('mongoose');

const WatchItem = new mongoose.Schema({
  name:      { type: String, required: true },
  watched:   { type: Boolean, default: false },
  poster:    { type: String, default: '' },
  tmdbId:    { type: Number, default: 0 },
  mediaType: { type: String, enum: ['movie', 'tv', ''], default: '' },
  year:      { type: String, default: '' },
  addedAt:   { type: Date }          // when the user added it (was never stored before)
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  watchlist: { type: [WatchItem], default: [] },
  watchlistBackup: { type: [WatchItem], default: [] }   // last list before any big shrink
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
