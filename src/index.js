import { auth, provider } from "./firebase.js"
import{onAuthStateChanged, signInWithPopup

} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("googleLoginBtn");
  const status = document.getElementById("statusMsg");

  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "home.html";
   });

  btn.addEventListener("click", async () => {
    status.className = "status";
    status.textContent = "Opening Google sign-in...";
    try {
      await signInWithPopup(auth, provider);
      window.location.href = "home.html";
    } catch (err) {
      console.error(err);
      status.className = "status error";
      if (err.code === "auth/popup-blocked") {
        status.textContent = "⚠️ Popup blocked! In Safari go to Settings → Websites → Pop-up Windows → set 127.0.0.1 to Allow.";
      } else if (err.code === "auth/unauthorized-domain") {
        status.textContent = "⚠️ Go to Firebase Console → Authentication → Settings → Authorized Domains → Add 127.0.0.1";
      } else {
        status.textContent = "❌ " + err.message;
      }
    }
  });
});