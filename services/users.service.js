"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { hashIterations, hashLength } = require('../helpers/constants')
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const axios = require('axios');
const multer = require('multer');

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");
var storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, './uploads');
	},
	filename: function (req, file, callback) {
		callback(null, file.fieldname + '-' + Date.now());
	}
});

var formidable = require('formidable');
var fs = require('fs');

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
		/** Public fields */
		fields: ["_id", "username", "email", "bio", "image"],

		/** Validator schema for entity */
		entityValidator: {
			username: { type: "string", min: 2, pattern: /^[a-zA-Z0-9]+$/ },
			password: { type: "string", min: 6 },
			email: { type: "email" },
			mobileNo: { type: "number" },
			image: { type: "string", optional: true },
			userType: { type: "string" },
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
						// return this.getOTP(entity.mobileNo)
						// 	.then(res => {
						// 		entity.smsSessionDetails = res.data.Details;
						// var upload = multer({ storage: storage }).array('userPhoto', 2);
						return this.adapter.insert(entity)
							.then(doc => this.transformDocuments(ctx, {}, doc))
							.then(user => this.transformEntity(user, true, ctx.meta.token, ctx))
							.then(json => this.entityChanged("created", json, ctx).then(() => json));
						// }).catch((err) => {
						// 	return Promise.reject(new MoleculerClientError("SMS Sending Failed!", 422, "", [{ field: "mobileNo", message: "SMS Failed" }]));
						// }) 
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
						email: { type: "email", optional: true },
						username: { type: "string" },
						password: { type: "string", min: 1 }
					}
				}
			},
			handler(ctx) {
				const { email, password, username } = ctx.params.user;

				return this.Promise.resolve()
					.then(() => this.adapter.findOne({ $or: [{ 'email': email }, { 'username': username }] }))
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
					.then(user => this.transformEntity(user, true, ctx.meta.token, ctx))
					.catch((err) => {
						return this.Promise.reject(new MoleculerClientError("Something went wrong. Please try again!", 422, "", [{ field: "Password", message: "is incorrect" }]));
					});
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
					this.getJWTSecret(ctx).then((jwtsecret) => {
						jwt.verify(ctx.params.token, jwtsecret, (err, decoded) => {
							if (err)
								return reject(err);
							resolve(decoded);
						});
					})

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
		 * Upload file.
		 * Auth is required!
		 *
		 * @actions
		 *
		 * @returns {Object} User entity
		 */
		uploadFile: {
			auth: "required",
			cache: {
				keys: ["#userID"]
			},
			params: {
				user: { type: "object" }
			},
			handler(ctx) {
				console.log('Inside upload call'); 
				var upload = multer({ storage: storage }).array('userPhoto', 2);
				return this.getById(ctx.meta.user._id)
					.then(user => {
						if (!user)
							return this.Promise.reject(new MoleculerClientError("User not found!", 400));
						// upload().then(res => {
						// 	//console.log(req.body);
						// 	//console.log(req.files);
						// 	// if (err) {
						// 	// 	console.log(err)
						// 	// 	return this.Promise.reject(new MoleculerClientError("User not found!", 400));
						// 	// }
						// 	// return this.transformEntity(user, true, ctx.meta.token)
						// 	return this.transformDocuments(ctx, {}, user);
						// });
						var form = new formidable.IncomingForm();
						form.parse(params, function (err, fields, files) {
							var oldpath = files.filetoupload.path;
							var newpath = 'D:/Tausif/Projects/Code/MEAN/moleculer/tqbook/' + files.filetoupload.name;
							fs.rename(oldpath, newpath, function (err) {
							  if (err) throw err;
							  user.newpath = newpath;
							  return this.transformDocuments(ctx, {}, user);
							});
					   });
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
			return new Promise((resolve, reject) => {
				this.getJWTSecret(ctx).then(jwtsecret => {
					const today = new Date();
					const exp = new Date(today);
					exp.setDate(today.getDate() + 60);
					resolve(jwt.sign({
						id: user._id,
						username: user.username,
						exp: Math.floor(exp.getTime() / 1000)
					}, jwtsecret))
				}).catch((err) => {
					reject(new MoleculerClientError("Error in registration. Please try again!", 404));
				})
			})
		},

		/**
		 * Retrieve the JWT Secret key from DB. Generate JWT token if neccessary.
		 *
		 */
		getJWTSecret(ctx) {
			return new Promise((resolve, reject) => {
				ctx.call("adminsettings.jwtsecret").then(res => {
					resolve(res.JWT_SECRET)
				}).catch((err) => {
					reject(new MoleculerClientError("JWT not found!", 404));
				})
			})
		},

		getOTP(mobileNo) {
			let smsAPI = 'https://2factor.in/API/V1/' + process.env.API_KEY_SMS + '/SMS/+91' + mobileNo + '/AUTOGEN/REGISTRATION'
			return new Promise((resolve, reject) => {
				axios.get(smsAPI)
					.then(res => {
						resolve(res)
					})
					.catch(function (error) {
						reject(error);
					})
			})
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
				if (withToken && token) {
					user.token = token
					return { user };
				} else {
					return this.generateJWT(user, ctx).then((res) => {
						user.token = res
						return { user };
					});
				}
			}

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
