const express = require('express');
const app = express();
const http = require('http');
const routes = require('./routes/notification_routes');
require("events").EventEmitter.prototype._maxListeners = 0;

const dotenv = require('dotenv');
dotenv.config();
//Set View Engine To EJS
app.set("view engine", "ejs");

// Set Static Directory
app.use(express.static("views"));
// app.use("views",express.static("render"));

//Get the post data from client
app.use(
    express.urlencoded({
        extended: false,
    })
);
app.use(express.json());

//Api routes
app.use(routes);

//server initialization
const httpServer = http.createServer(app);

//server connection
httpServer.listen(process.env.PORT, "localhost", () =>
    console.log(`Web Application Running on port ${process.env.PORT}!`)
);
httpServer.setTimeout(2000000);