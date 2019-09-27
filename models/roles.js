'use strict';

var mongoose = require('mongoose');

var roleSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
   description: {
        type: String
    },
    permission_id: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'permission'
    }],
    status: {
        type: Boolean,
        default: true
    },
    deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

var Role = mongoose.model('Role', roleSchema);
module.exports = Role;
