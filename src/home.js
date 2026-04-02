import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
    
  document.addEventListener("DOMContentLoaded", () => {;
    let currentUser = null;
    let editingNoteId = null;

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

    /* ── SAVE NOTE ──
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
          folderColor: getFolderColor(folder), 
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
    */

    // SAVE AND EDIT NOTE
    document.getElementById("saveBtn").addEventListener("click", async () => {
      const title = document.getElementById("noteTitle").value.trim();
      const body = document.getElementById("noteBody").value.trim();
      const folder = document.getElementById("noteFolder").value;

      if (!title) { showToast("Please add a title!", true); return; }
      if (!body)  { showToast("Note can't be empty!", true); return; }
      if (!currentUser) return;

      try {
        // Update existing note
        if (editingNoteId) {
          await updateDoc(doc(db, "notes", editingNoteId), {
            title: title,
            text: body,
            folder: folder,
        });
        showToast("Note saved ✓");
        editingNoteId = null;
        } else {
          // Create new note
          await addDoc(collection(db, "notes"), {
            title: title,
            text: body,
            folder: folder,
            userId: currentUser.uid,
            createdAt: serverTimestamp()
          });
          showToast("Note saved ✓");
      }

      document.getElementById("noteTitle").value = "";
      document.getElementById("noteBody").value = "";
      document.getElementById("composer").classList.remove("open");
      loadNotes();
      
      } catch (err) {
        console.error(err);
        showToast("Error: " + err.message, true);
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
        snapshot.forEach((docSnap, i) => {
          const data = docSnap.data();
          const date = data.createdAt?.toDate
            ? data.createdAt.toDate().toLocaleDateString("en-US", { month:"short", day:"numeric" })
            : "Just now";

          const card = document.createElement("div");
          card.className = `note-card tag-${data.folder || "other"}`;
          card.style.setProperty('--folder-color', data.folderColor || '#8FBF9A');
          card.style.animationDelay = (i * 0.05) + "s";
          card.innerHTML = `
            <div class="note-folder">${folderLabel(data.folder)}</div>
            <div class="note-title">${escHtml(data.title || "Untitled")}</div>
            <div class="note-preview">${escHtml(data.text || "")}</div>
            <div class="note-footer">
              <span>${date}</span>
              <div class="note-action">
                <button class="btn-pdf" data-title="${escHtml(data.title)}" data-text="${escHtml(data.text)}">📄 PDF</button>
                <button class="btn-txt" data-title="${escHtml(data.title)}" data-text="${escHtml(data.text)}">📝 TXT</button>
                <button class="btn-copy" data-title="${escHtml(data.title)}" data-text="${escHtml(data.text)}">📋 Copy</button>
                <button class="btn-edit" data-id="${docSnap.id}">✏️ Edit</button>
                <button class="btn-delete" data-id="${docSnap.id}">🗑 Delete</button>
              </div>
            </div>`;
          grid.appendChild(card);
        });
// PDF export handlers
grid.querySelectorAll(".btn-pdf").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    exportToPDF(btn.dataset.title, btn.dataset.text);
  });
});

// TXT download handlers
grid.querySelectorAll(".btn-txt").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    exportToTXT(btn.dataset.title, btn.dataset.text);
  });
});

// Copy to clipboard handlers
grid.querySelectorAll(".btn-copy").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(btn.dataset.title + "\n\n" + btn.dataset.text);
      showToast("Copied to clipboard ✓");
    } catch (err) {
      showToast("Could not copy!", true);
    }
  });
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

        // EDIT HANDLERS
        grid.querySelectorAll(".btn-edit").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;

            const note = snapshot.docs.find(d => d.id === id);
            if (!note) return;
            const data = note.data(); 
            document.getElementById("noteTitle").value = data.title || "";
            document.getElementById("noteBody").value = data.text || "";
            document.getElementById("noteFolder").value = data.folder || "other";
            document.getElementById("composer").classList.add("open");
            editingNoteId = id;
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

  function getFolderColor(folder) {
    return {
      school: "#8FBF9A",
      work: "#7FA8FF",
      personal: "#F28FA9",
        other: "#9AA3AF"
    }[folder] || "#8FBF9A";
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
  // ── EXPORT TO PDF ──
function exportToPDF(title, text) {
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 680px; margin: 60px auto; color: #111; line-height: 1.8; }
    h1 { font-size: 2rem; border-bottom: 3px solid #c8f04a; padding-bottom: 12px; margin-bottom: 8px; }
    .meta { font-size: .82rem; color: #888; margin-bottom: 36px; }
    p { font-size: 1rem; white-space: pre-wrap; }
    .footer { margin-top: 60px; font-size: .72rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
  </style></head><body>
  <h1>${title}</h1>
  <div class="meta">Exported from NoteIT — ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
  <p>${text}</p>
  <div class="footer">NoteIT — Your notes, organized & synced everywhere.</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); }, 500);
}

// ── EXPORT TO TXT ──
function exportToTXT(title, text) {
  const content = `${title}\n${"=".repeat(title.length)}\n\nExported from NoteIT on ${new Date().toLocaleDateString()}\n\n${text}`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".txt";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Downloaded as .txt ✓");
}