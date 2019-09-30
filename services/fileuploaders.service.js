"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");
const fs = require("fs");
const path = require("path");
const mkdir = require("mkdirp").sync;

const uploadDir = path.join(__dirname, "../uploads");
mkdir(uploadDir);

module.exports = {
	name: "fileuploaders",
	mixins: [
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
		uploadFile: {
			handler(ctx) {
				return new this.Promise((resolve, reject) => {
					//reject(new Error("Disk out of space"));
					const filePath = path.join(uploadDir, ctx.meta.filename || this.randomName());
					console.log('ctx.meta!!!!!!!!', ctx.meta)
					const f = fs.createWriteStream(filePath);
					f.on("close", () => {
						console.log(`Uploaded file stored in '${filePath}'`);
						resolve({ filePath, meta: ctx.meta });
					});
					f.on("error", err => console.log(err));

					// ctx.params.pipe(f);
				});
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

		/**
		 * Retrieve the random name of newly uploaded file
		 *
		 */
		randomName() {
			return "pic_" + Date.now() + ".png";
		},
	}
};
