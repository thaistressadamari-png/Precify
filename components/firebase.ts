import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA113Vu3Qds1Ewijwcg64ZseqjuQTpLJ50",
  authDomain: "precify-8bab5.firebaseapp.com",
  projectId: "precify-8bab5",
  storageBucket: "precify-8bab5.firebasestorage.app",
  messagingSenderId: "612404494201",
  appId: "1:612404494201:web:b0f6aa8812e4e8e9e439a8",
  measurementId: "G-T9BV2M7SZD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
