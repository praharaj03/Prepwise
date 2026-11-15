// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCxcLU9GTrAQF9ADlFA_b3ThC3-4FWQ4RM",
  authDomain: "intervu-1a3d7.firebaseapp.com",
  projectId: "intervu-1a3d7",
  storageBucket: "intervu-1a3d7.firebasestorage.app",
  messagingSenderId: "275683814058",
  appId: "1:275683814058:web:40ce59f61824d81187bed3",
  measurementId: "G-RLXD60V2GX"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);