const functions = require("firebase-functions");

module.exports = {
  apiKey: functions.config().project.key,
  authDomain: "social-comm.firebaseapp.com",
  projectId: functions.config().project.id,
  storageBucket: "social-comm.appspot.com",
  messagingSenderId: "138076014246",
  appId: functions.config().app.id,
  measurementId: "G-T6GENF8Q65",
  databaseURL: "social-com.firebaseio.com",
};
