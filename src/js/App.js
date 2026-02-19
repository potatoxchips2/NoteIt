// Log in 

import { auth, provider } from "./firebase.js";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";

const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log(result.user);

    // redirect after login
    window.location.href = "home.html";

  } catch (error) {
    console.error(error);
  }
};

const loginBtn = document.getElementById("google-login");

loginBtn.addEventListener("click", handleGoogleLogin);

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in:", user.email);
  } else {
    console.log("Not logged in");
  }
});
