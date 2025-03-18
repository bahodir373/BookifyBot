const mongoose = require('mongoose');
const bookSchema = new mongoose.Schema({
  title: String,
  description: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
  fileId: String, // Telegramda saqlangan fayl ID
  category: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Book', bookSchema);
