"use strict"; 

const DbService	= require("moleculer-db");
const dotenv = require('dotenv');
const MongooseAdapter = require("moleculer-db-adapter-mongoose");

dotenv.config();

module.exports = function(collection) {
	if (process.env.NODE_ENV == 'development') {
		return {
			mixins: [DbService],
			adapter: new MongooseAdapter(process.env.MONGO_URI),
			model: require(`../models/${collection}.js`)
		};
	}
};
