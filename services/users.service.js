"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { hashIterations, hashLength } = require('../helpers/constants')
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const axios = require('axios');

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");

module.exports = {
	name: "users",
	mixins: [
		DbService("users"),
		CacheCleanerMixin([
			"cache.clean.users"
		])
	],

	/**
	 * Default settings
	 */
	settings: {
		/** Secret for JWT */
		JWT_SECRET: process.env.JWT_SECRET,

		/** Public fields */
		fields: ["_id", "username", "email", "bio", "image"],

		/** Validator schema for entity */
		entityValidator: {
			username: { type: "string", min: 2, pattern: /^[a-zA-Z0-9]+$/ },
			password: { type: "string", min: 6 },
			email: { type: "email" },
			mobileNo: { type: "number" },
			image: { type: "string", optional: true },
		}
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Register a new user
		 *
		 * @actions
		 * @param {Object} user - User entity
		 *
		 * @returns {Object} Created entity & token
		 */
		create: {
			params: {
				user: { type: "object" }
			},
			handler(ctx) {
				let entity = ctx.params.user;
				return this.validateEntity(entity)
					.then(() => {
						if (entity.username)
							return this.adapter.findOne({ username: entity.username })
								.then(found => {
									if (found)
										return Promise.reject(new MoleculerClientError("Username is exist!", 422, "", [{ field: "username", message: "is exist" }]));

								});
					})
					.then(() => {
						if (entity.email)
							return this.adapter.findOne({ email: entity.email })
								.then(found => {
									if (found)
										return Promise.reject(new MoleculerClientError("Email is exist!", 422, "", [{ field: "email", message: "is exist" }]));
								});

					})
					.then(() => {
						entity.salt = crypto.randomBytes(16).toString('hex');
						entity.password = crypto.pbkdf2Sync(entity.password, entity.salt, hashIterations, hashLength, `sha512`).toString(`hex`);
						entity.image = entity.image || null;
						entity.createdAt = new Date();
						let smsAPI = 'https://2factor.in/API/V1/' + process.env.API_KEY_SMS + '/SMS/+91' + entity.mobileNo + '/AUTOGEN'
						axios.get(smsAPI)
							.then(res => {
								if (res.Status == 'Error')
									return Promise.reject(new MoleculerClientError("Error in SMS!", 422, "", [{ field: "SMS", message: "not sent" }]))
								entity.smsSessionDetails = res.Details
								return this.adapter.insert(entity)
									.then(doc => this.transformDocuments(ctx, {}, doc))
									.then(user => this.transformEntity(user, true, ctx.meta.token))
									.then(json => this.entityChanged("created", json, ctx).then(() => json));
							})
							.catch(function (error) {
								console.log(error);
							})
					});
			}
		},

		/**
		 * Login with username & password
		 *
		 * @actions
		 * @param {Object} user - User credentials
		 *
		 * @returns {Object} Logged in user with token
		 */
		login: {
			params: {
				user: {
					type: "object", props: {
						email: { type: "email" },
						password: { type: "string", min: 1 }
					}
				}
			},
			handler(ctx) {
				const { email, password } = ctx.params.user;

				return this.Promise.resolve()
					.then(() => this.adapter.findOne({ email }))
					.then(user => {
						if (!user)
							return this.Promise.reject(new MoleculerClientError("Email or password is invalid!", 422, "", [{ field: "email", message: "is not found" }]));
						const passHash = crypto.pbkdf2Sync(password, user.salt, hashIterations, hashLength, `sha512`).toString(`hex`);
						if (user.password === passHash) {
							return this.transformDocuments(ctx, {}, user);
						} else {
							return this.Promise.reject(new MoleculerClientError("Wrong password!", 422, "", [{ field: "Password", message: "is incorrect" }]));
						}
					})
					.then(user => this.transformEntity(user, true, ctx.meta.token, ctx));
			}
		},

		/**
		 * Get user by JWT token (for API GW authentication)
		 *
		 * @actions
		 * @param {String} token - JWT token
		 *
		 * @returns {Object} Resolved user
		 */
		resolveToken: {
			cache: {
				keys: ["token"],
				ttl: 60 * 60 // 1 hour
			},
			params: {
				token: "string"
			},
			handler(ctx) {
				return new this.Promise((resolve, reject) => {
					jwt.verify(ctx.params.token, this.settings.JWT_SECRET, (err, decoded) => {
						if (err)
							return reject(err);

						resolve(decoded);
					});

				})
					.then(decoded => {
						if (decoded.id)
							return this.getById(decoded.id);
					});
			}
		},

		/**
		 * Get current user entity.
		 * Auth is required!
		 *
		 * @actions
		 *
		 * @returns {Object} User entity
		 */
		me: {
			auth: "required",
			cache: {
				keys: ["#userID"]
			},
			handler(ctx) {
				return this.getById(ctx.meta.user._id)
					.then(user => {
						if (!user)
							return this.Promise.reject(new MoleculerClientError("User not found!", 400));

						return this.transformDocuments(ctx, {}, user);
					})
					.then(user => this.transformEntity(user, true, ctx.meta.token));
			}
		},

		/**
		 * Update current user entity.
		 * Auth is required!
		 *
		 * @actions
		 *
		 * @param {Object} user - Modified fields
		 * @returns {Object} User entity
		 */
		updateMyself: {
			auth: "required",
			params: {
				user: {
					type: "object", props: {
						username: { type: "string", min: 2, optional: true, pattern: /^[a-zA-Z0-9]+$/ },
						password: { type: "string", min: 6, optional: true },
						email: { type: "email", optional: true },
						image: { type: "string", optional: true },
					}
				}
			},
			handler(ctx) {
				const newData = ctx.params.user;
				return this.Promise.resolve()
					.then(() => {
						if (newData.username)
							return this.adapter.findOne({ username: newData.username })
								.then(found => {
									if (found && found._id.toString() !== ctx.meta.user._id.toString())
										return Promise.reject(new MoleculerClientError("Username is exist!", 422, "", [{ field: "username", message: "is exist" }]));

								});
					})
					.then(() => {
						if (newData.email)
							return this.adapter.findOne({ email: newData.email })
								.then(found => {
									if (found && found._id.toString() !== ctx.meta.user._id.toString())
										return Promise.reject(new MoleculerClientError("Email is exist!", 422, "", [{ field: "email", message: "is exist" }]));
								});

					})
					.then(() => {
						newData.updatedAt = new Date();
						const update = {
							"$set": newData
						};
						return this.adapter.updateById(ctx.meta.user._id, update);
					})
					.then(doc => this.transformDocuments(ctx, {}, doc))
					.then(user => this.transformEntity(user, true, ctx.meta.token))
					.then(json => this.entityChanged("updated", json, ctx).then(() => json));

			}
		},

		/**
		 * Get a user profile.
		 *
		 * @actions
		 *
		 * @param {String} username - Username
		 * @returns {Object} User entity
		 */
		profile: {
			cache: {
				keys: ["#userID", "username"]
			},
			params: {
				username: { type: "string" }
			},
			handler(ctx) {
				return this.adapter.findOne({ username: ctx.params.username })
					.then(user => {
						if (!user)
							return this.Promise.reject(new MoleculerClientError("User not found!", 404));

						return this.transformDocuments(ctx, {}, user);
					})
					.then(user => this.transformProfile(ctx, user, ctx.meta.user));
			}
		},
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Generate a JWT token from user entity
		 *
		 * @param {Object} user
		 */
		generateJWT(user, ctx) {
			const today = new Date();
			const exp = new Date(today);
			exp.setDate(today.getDate() + 60);
			return jwt.sign({
				id: user._id,
				username: user.username,
				exp: Math.floor(exp.getTime() / 1000)
			}, this.settings.JWT_SECRET)
			// new Promise((resolve, reject) => {
			// 	ctx.call("adminsettings.jwtsecret").then(res => {
			// 		const today = new Date();
			// 		const exp = new Date(today);
			// 		exp.setDate(today.getDate() + 60);
			// 		resolve(jwt.sign({
			// 			id: user._id,
			// 			username: user.username,
			// 			exp: Math.floor(exp.getTime() / 1000)
			// 		}, res.JWT_SECRET))
			// 	})
			// })
		},

		/**
		 * Retrieve the JWT Secret key from DB. Generate JWT token if neccessary.
		 *
		 */
		async getJWTSecret(ctx) {
			let res = await ctx.call("adminsettings.jwtsecret");
			return res.JWT_SECRET;
		},

		/**
		 * Transform returned user entity. Generate JWT token if neccessary.
		 *
		 * @param {Object} user
		 * @param {Boolean} withToken
		 */
		transformEntity(user, withToken, token, ctx) {
			if (user) {
				//user.image = user.image || "https://www.gravatar.com/avatar/" + crypto.createHash("md5").update(user.email).digest("hex") + "?d=robohash";
				if (withToken)
					user.token = token || this.generateJWT(user, ctx);
			}
			return { user };
		},

		/**
		 * Transform returned user entity as profile.
		 *
		 * @param {Context} ctx
		 * @param {Object} user
		 * @param {Object?} loggedInUser
		 */
		transformProfile(ctx, user, loggedInUser) {
			//user.image = user.image || "https://www.gravatar.com/avatar/" + crypto.createHash("md5").update(user.email).digest("hex") + "?d=robohash";
			user.image = user.image || "https://static.productionready.io/images/smiley-cyrus.jpg";

			if (loggedInUser) {
				return ctx.call("follows.has", { user: loggedInUser._id.toString(), follow: user._id.toString() })
					.then(res => {
						user.following = res;
						return { profile: user };
					});
			}

			user.following = false;

			return { profile: user };
		}
	},

	events: {
		"cache.clean.users"() {
			if (this.broker.cacher)
				this.broker.cacher.clean(`${this.name}.*`);
		},
		"cache.clean.follows"() {
			if (this.broker.cacher)
				this.broker.cacher.clean(`${this.name}.*`);
		}
	}
};
