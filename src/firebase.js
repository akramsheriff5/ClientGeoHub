// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCBQQbW8tgfIxTlE_yr7l3z_HAywAeT_-8",
  authDomain: "markmywork-a0b86.firebaseapp.com",
  projectId: "markmywork-a0b86",
  storageBucket: "markmywork-a0b86.firebasestorage.app",
  messagingSenderId: "402375247959",
  appId: "1:402375247959:web:948b0383d2f322180dfb12",
  measurementId: "G-CJZMS6HVFW"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app); 