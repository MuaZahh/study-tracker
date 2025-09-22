import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace with your Firebase config
// Get this from Firebase Console > Project Settings > Web App
const firebaseConfig = {
  apiKey: "AIzaSyCikri5MQY7nW4xkuwoRRsoz8-TbSZGlv4",
  authDomain: "study-tracker-56d8c.firebaseapp.com",
  projectId: "study-tracker-56d8c",
  storageBucket: "study-tracker-56d8c.firebasestorage.app",
  messagingSenderId: "214027867172",
  appId: "1:214027867172:web:310114b6459717e132f4b1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);