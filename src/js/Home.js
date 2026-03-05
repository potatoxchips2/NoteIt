import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const goToNotesBtn = document.getElementById("go-to-notes");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeText = document.getElementById("welcomeText");

// Protect page — redirect to login if not signed in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (welcomeText) {
    welcomeText.textContent = `Welcome ${user.displayName || user.email} 👋`;
  }
});

// Go to notes page
if (goToNotesBtn) {
  goToNotesBtn.addEventListener("click", () => {
    window.location.href = "newnote.html";
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}