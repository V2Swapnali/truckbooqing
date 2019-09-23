module.exports = {
    // Login
    "POST /users/login": "users.login",

    // Users
    "REST /users": "users",

    // Current user
    "GET /user": "users.me",
    "PUT /user": "users.updateMyself",

    // Profile
    "GET /profiles/:username": "users.profile",
    "POST /profiles/:username/follow": "users.follow",
    "DELETE /profiles/:username/follow": "users.unfollow",
}