'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var AdminSettingSchema = new mongoose.Schema({
    JWT_SECRET: {type: String},
    created: { type: Date },
    lastUpdated: { type: Date }
});

var AdminSetting = mongoose.model('AdminSetting', AdminSettingSchema);
module.exports = AdminSetting;
    
