module.exports = {
    // Login
    "POST /users/login": "users.login",

    //Upload
    "POST /users/upload": "users.uploadFile",

    // Users
    "REST /users": "users",

    // Current user
    "GET /user": "users.me",
    "PUT /user": "users.updateMyself"
}