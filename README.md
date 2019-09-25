# TBooq Application

## Getting started

### To get the Node server running locally:

- Clone this repo
- `npm install` to install all required dependencies
- `npm run dev` to start the local server
- the API is available at http://localhost:3000/api

#### MongoDB persistent store
Basically to use MongoDB, set the `MONGO_URI` environment variable.
```
MONGO_URI=mongodb://localhost/tbooq
```

#### Multiple instances
You can run multiple instances of services. Moleculer uses TCP transporter to communicate all instances. No need any additional configuration, it uses UDP for discovery.



### Dependencies

- [moleculer](https://github.com/moleculerjs/moleculer) - Microservices framework for NodeJS
- [moleculer-web](https://github.com/moleculerjs/moleculer-web) - Official API Gateway service for Moleculer
- [moleculer-db](https://github.com/moleculerjs/moleculer-db/tree/master/packages/moleculer-db#readme) - Database store service for Moleculer
- [moleculer-db-adapter-mongo](https://github.com/moleculerjs/moleculer-db/tree/master/packages/moleculer-db-adapter-mongo#readme) - Database store service for MongoDB *(optional)*
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) - To generate JWTs used by authentication
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) - Hashing user password
- [lodash](https://github.com/lodash/lodash) - Utility library
- [slug](https://github.com/dodo/node-slug) - To encode titles into a URL-friendly format
- [ioredis](https://github.com/luin/ioredis) - [Redis](https://redis.io) server for caching *(optional)*

### Application Structure

- `moleculer.config.js` - Moleculer ServiceBroker configuration file.
- `services/` - This folder contains the services.
- `public/` - This folder contains the front-end static files.
- `models/` - This folder contains all the schemas
- `routes/` - This folder contains the aliases for the routes
- `helpers/` - This folder contains the helpers file for micro services

## Test

*Local tests is missing currently.*
```
$ npm test
```

In development with watching

```
$ npm run ci
```

## Contact
Copyright (c) 2019 TBooq
