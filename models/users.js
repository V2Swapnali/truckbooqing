'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new mongoose.Schema({
    firstname: { type: String,required: true},
    lastname: { type: String, required: true},
    username: { type: String },
    email: { type: String, required: true},
    password: { type: String, default:'123456'},
    verifying_token: { type: String},
    Address: { type: String }, 
    city: { type: String}, 
    profile_image: { type: String},
    profileName :{ type : String, default: '1496375001457.png'},
    mobileNo :  { type: String },
    teleNo: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    role_id: { type: Schema.Types.ObjectId, ref: 'Role'},
    userType: { type: String},   // need to remove later
    deleted: {
        type: Boolean,
        default: false
    },
    access_token: { type: String},
    selectedLanguage: { type: String},
    homeToken: { type: String},
    isverified:{ type: Boolean, default: false },
    isLoggedIn: { type: Boolean, default: false },
    loggedInTime: { type: Date },
    lastActivityTime: { type: Date },
    licenseNumber:{type:String},
    salt : {type: String},
    smsSessionDetails: {type: String}
},{
    timestamps: true,
    toObject: {
    virtuals: true
    },
    toJSON: {
    virtuals: true 
    }
});

var User = mongoose.model('User', UserSchema);
module.exports = User;
    
