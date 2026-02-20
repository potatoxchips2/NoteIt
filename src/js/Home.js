import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

const notesBtn = document.getElementById("go-to-notes");
const logoutBtn = document.getElementById("logout");

// Protect page
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});

// Go to notes page
notesBtn.addEventListener("click", () => {
    window.location.href = "index.html";
});

// Logout
logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
});
