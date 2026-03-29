'use strict';

const config = {
    DB_URI: process.env.DB_URI || 'mongodb://localhost:27017/mydatabase',
    DB_OPTIONS: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
};

module.exports = config;
