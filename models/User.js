const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: Number, required: true, unique: true },
    fullName: String,
    username: String,
    phone: String,
    subscribedChannels: [String],
    createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('BookifyUser', userSchema);
