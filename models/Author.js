const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema({
  name: String,
  bio: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Author', authorSchema);
