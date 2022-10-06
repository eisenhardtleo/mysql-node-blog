const mysql = require("mysql2/promise");

const options = {
    host: process.env.DB_HOST,
    port : process.env.DB_PORT,
    database : process.env.DB_NAME,
    user : process.env.DB_USER,
    password : process.env.DB_PWD
};
const pool = mysql.createPool(options);

module.exports = pool;