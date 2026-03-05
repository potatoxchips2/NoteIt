import { auth, provider } from "./firebase.js";
import {
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const googleBtn = document.getElementById("googleLoginBtn");

googleBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = "home.html";
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "home.html";
  }
});