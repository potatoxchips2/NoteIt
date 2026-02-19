// Log in 

import { auth, provider } from "./firebase";
import { signInWithPopup } from "firebase/auth";

const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log(result.user);
  } catch (error) {
    console.error(error);
  }
};

<button onClick={handleGoogleLogin}>
  Sign in with Google
</button>

import { onAuthStateChanged } from "firebase/auth";

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in:", user.email);
  } else {
    console.log("Not logged in");
  }
});
