import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const noteInput = document.getElementById("noteInput");
const saveNoteBtn = document.getElementById("saveNoteBtn");
const notesList = document.getElementById("notesList");

function renderNotes(docs) {
  notesList.innerHTML = "";
  docs.forEach((doc) => {
    const li = document.createElement("li");
    li.textContent = doc.data().text;
    notesList.appendChild(li);
  });
}

async function loadNotes(user) {
  const q = query(
    collection(db, "notes"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  renderNotes(snapshot.docs);
}

// Wait for auth to be ready before loading notes
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  loadNotes(user);
});

saveNoteBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const text = noteInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "notes"), {
    text: text,
    userId: user.uid,
    createdAt: serverTimestamp()
  });

  noteInput.value = "";
  loadNotes(user);
});