import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCkTHZxPxxCU9duApGXrcQdh9-fB7YxtRU",
  authDomain: "noteit-e97f4.firebaseapp.com",
  projectId: "noteit-e97f4",
  storageBucket: "noteit-e97f4.firebasestorage.app",
  messagingSenderId: "574621367786",
  appId: "1:574621367786:web:7c8310e2547900d5e38693",
  measurementId: "G-XM2VPC9D3K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);