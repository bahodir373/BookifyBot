require('dotenv').config()
const mongoose = require('mongoose')

const dbConnect = async () => {
	mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('> MongoDB ga ulandi'))
    .catch(err => console.log('MongoDB xato:', err));
}

module.exports = {dbConnect}