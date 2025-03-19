const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true }
});

module.exports = mongoose.model('Wishlist', WishlistSchema);
