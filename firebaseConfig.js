// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const { initializeFirestore } = require("firebase/firestore");
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyADXkAgdufbAOW8U22dhVEB6m_OG5pyhIQ",
  authDomain: "song-project-e8928.firebaseapp.com",
  projectId: "song-project-e8928",
  storageBucket: "song-project-e8928.appspot.com",
  messagingSenderId: "447573251168",
  appId: "1:447573251168:web:5893af6bcdb23610af5f05",
  measurementId: "G-LYGV6PHDKT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

module.exports = {db};

