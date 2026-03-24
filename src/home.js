import { auth,db } from"./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, serverTimestamp } from
 "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
    
  document.addEventListener("DOMContentLoaded", () => {;
    let currentUser = null;
    let allNotes = [];

    // ── AUTH GUARD ──
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      currentUser = user;
      document.getElementById("welcomeMsg").textContent =
        "Hey, " + (user.displayName ? user.displayName.split(" ")[0] : user.email) + " 👋";
      loadNotes();
    });

    // ── LOGOUT ──
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });

    // ── COMPOSER TOGGLE ──
    document.getElementById("newNoteBtn").addEventListener("click", () => {
      document.getElementById("composer").classList.add("open");
      document.getElementById("noteTitle").focus();
    });
    document.getElementById("cancelBtn").addEventListener("click", () => {
      document.getElementById("composer").classList.remove("open");
      document.getElementById("noteTitle").value = "";
      document.getElementById("noteBody").value = "";
    });

    // ── SAVE NOTE ──
    document.getElementById("saveBtn").addEventListener("click", async () => {
      const title = document.getElementById("noteTitle").value.trim();
      const body = document.getElementById("noteBody").value.trim();
      const folder = document.getElementById("noteFolder").value;

      if (!title) { showToast("Please add a title!", true); return; }
      if (!body)  { showToast("Note can't be empty!", true); return; }
      if (!currentUser) return;

      try {
        await addDoc(collection(db, "notes"), {
          title: title,
          text: body,
          folder: folder,
          userId: currentUser.uid,
          createdAt: serverTimestamp()
        });
        document.getElementById("noteTitle").value = "";
        document.getElementById("noteBody").value = "";
        document.getElementById("composer").classList.remove("open");
        showToast("Note saved ✓");
        loadNotes();
      } catch (err) {
        console.error(err);
        showToast("Error saving note: " + err.message, true);
      }
    });

    // ── LOAD NOTES ──
    async function loadNotes() {
      const grid = document.getElementById("notesGrid");
      grid.innerHTML = '<div class="loading">Loading...</div>';

      try {
        const q = query(
          collection(db, "notes"),
          where("userId", "==", currentUser.uid)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          grid.innerHTML = `
            <div class="empty">
              <div class="empty-icon">📭</div>
              <div class="empty-title">No notes yet</div>
              <div class="empty-sub">Hit "+ New Note" to get started</div>
            </div>`;
          return;
        }

        grid.innerHTML = "";

        allNotes = [];
        snapshot.forEach((docSnap, i) => {
          const data = docSnap.data();
          allNotes.push({ id: docSnap.id, ...data });
          const date = data.createdAt?.toDate
            ? data.createdAt.toDate().toLocaleDateString("en-US", { month:"short", day:"numeric" })
            : "Just now";
          renderNotes(allNotes);
        });

        function renderNotes(notes) {
  const grid = document.getElementById("notesGrid");
  grid.innerHTML = "";

  notes.forEach((data, i) => {
    const date = data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleDateString("en-US", { month:"short", day:"numeric" })
      : "Just now";

    const card = document.createElement("div");
    card.className = `note-card tag-${data.folder || "other"}`;
    card.style.animationDelay = (i * 0.05) + "s";

    card.innerHTML = `
      <div class="note-folder">${folderLabel(data.folder)}</div>
      <div class="note-title">${escHtml(data.title || "Untitled")}</div>
      <div class="note-preview">${escHtml(data.text || "")}</div>
      <div class="note-footer">
        <span>${date}</span>
        <button class="btn-delete" data-id="${data.id}">🗑 Delete</button>
      </div>`;

    grid.appendChild(card);
    });

    // reattach delete listeners
    document.querySelectorAll(".btn-delete").forEach(btn => {
      btn.onclick = async () => {
        await deleteDoc(doc(db, "notes", btn.dataset.id));
        showToast("Note deleted");
        loadNotes();
      };
    });
  }

  document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();

  const filtered = allNotes.filter(note =>
    (note.title && note.title.toLowerCase().includes(query)) ||
    (note.text && note.text.toLowerCase().includes(query))
  );

  renderNotes(filtered);
  });

        // Delete handlers
        grid.querySelectorAll(".btn-delete").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            try {
              await deleteDoc(doc(db, "notes", id));
              showToast("Note deleted.");
              loadNotes();
            } catch (err) {
              showToast("Error: " + err.message, true);
            }
          });
        });

      } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="loading">Error loading notes: ${err.message}</div>`;
      }
    }

    function folderLabel(f) {
      return { school:"📚 School", work:"💼 Work", personal:"🏠 Personal", other:"📌 Other" }[f] || "📌 Other";
    }

    function escHtml(str) {
      return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    let toastTimer;
    function showToast(msg, isErr = false) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.className = "toast show" + (isErr ? " err" : "");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.className = "toast", 3000);
    }
  });