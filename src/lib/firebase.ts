// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGL6jCEV8SIhIfuS-O6ylG14gh5WYfCYM",
  authDomain: "satelital-9416f.firebaseapp.com",
  projectId: "satelital-9416f",
  storageBucket: "satelital-9416f.appspot.com",
  messagingSenderId: "803736254270",
  appId: "1:803736254270:web:59f1d326ef4e592061de6f"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

    