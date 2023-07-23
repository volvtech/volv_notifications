var admin = require("firebase-admin");

var serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: "https://volvapp-afd6d.firebaseio.com"
});


module.exports=admin;