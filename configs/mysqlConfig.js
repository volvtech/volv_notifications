require('dotenv').config();
const mysql = require('mysql');

var pool = mysql.createPool({
    host: `${process.env.MYSQL_HOST}`,
    user: `${process.env.MYSQL_USERNAME}`,
    password: `${process.env.MYSQL_PASSWORD}`,
    waitForConnections: true,
    charset: 'utf8mb4',
});

var getConnection = function () {
    return new Promise((resolve, reject) => {
        pool.getConnection(function (err, connection) {
            if (err) {
                reject(err);
            } else {
                resolve(connection)
            };
        });
    });
}

var execute = function (execQuery, databaseName) {
    return new Promise((resolve, reject) => {
        pool.getConnection(function (err, connection) {
            if (err) {
                reject(err);
            } else {
                connection.changeUser({
                    database: `${databaseName}`
                });
                connection.query(execQuery, function (error, results, fields) {
                    connection.release();
                    resolve([error, results, fields]);
                });
            }
        });
    });
}



module.exports = {
    getConnection,
    execute
};