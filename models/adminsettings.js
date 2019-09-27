'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var adminSettingSchema = new mongoose.Schema({
    JWT_SECRET: { type: String },
    created: { type: Date },
    lastUpdated: { type: Date }
});

var AdminSetting = mongoose.model('AdminSetting', adminSettingSchema);
module.exports = AdminSetting;

