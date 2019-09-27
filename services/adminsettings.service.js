"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");

module.exports = {
	name: "adminsettings",
	mixins: [
		DbService("adminsettings"),
		CacheCleanerMixin([
			"cache.clean.users"
		])
	],

	/**
	 * Default settings
	 */
	settings: {

	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Get the jwt secret key from admin settings.
		 *
		 * @actions
		 *
		 * @returns {String}
		 */
		jwtsecret: {
			handler() { 
				return this.findJWTSecret();
			}
		},
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Find the JWT_SECRET from Admin Settings
		 */
		findJWTSecret() {
			return this.adapter.findOne({});
		},
	}
};
