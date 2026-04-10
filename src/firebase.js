import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQag1nQJPGm-LnxSCfIfUI42DNQ8Ev1_w",
  authDomain: "noteit-8b57d.firebaseapp.com",
  projectId: "noteit-8b57d",
  storageBucket: "noteit-8b57d.firebasestorage.app",
  messagingSenderId: "913521285762",
  appId: "1:913521285762:web:6f6eb3e2a377f78b2a729b",
  measurementId: "G-TK4K3XLZZR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

