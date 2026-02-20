import { auth, provider } from "./firebase.js";
import { signInWithPopup } from "firebase/auth";

console.log("login.js loaded");

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("google-login");
    console.log("Button:", loginBtn);

    loginBtn.addEventListener("click", async () => {
        console.log("Button clicked");

        try {
            const result = await signInWithPopup(auth, provider);
            console.log("Logged in:", result.user.email);

            window.location.href = "home.html";

        } catch (error) {
            console.error("Login error:", error);
        }
    });
});
