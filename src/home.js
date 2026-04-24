import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
    
  document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let editingNoteId = null;
    let currentFilter = "all";
    let currentView = "notes";
    let searchTerm = "";
    let selectedFolderFilter = null;
    let currentSort = "newest";
    let savedNoteRange = null;
    const BUILTIN_FOLDERS = [
      { key: "school", label: "School" },
      { key: "work", label: "Work" },
      { key: "personal", label: "Personal" }
    ];

    updateFilterTabs();
    updateSectionTitle();
    syncPrimaryActions();

    // ── AUTH GUARD ──
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      currentUser = user;
      syncUserSettings(user);

      document.getElementById("welcomeMsg").textContent =
        "Hey, " + (user.displayName ? user.displayName.split(" ")[0] : user.email) + " 👋";
      loadFolderSidebar();
      loadFolderDropdown();
      loadFolderManager();
      loadNotes();
    });

    // ── LOGOUT ──
    async function handleLogout() {
      await signOut(auth);
      window.location.href = "index.html";
    }

    document.getElementById("settingsLogoutBtn").addEventListener("click", handleLogout);
    document.getElementById("folderSettingsBtn").addEventListener("click", () => setActiveView("folders"));
    document.getElementById("folderManagerClose").addEventListener("click", closeFolderManager);
    document.getElementById("folderManagerOverlay").addEventListener("click", (event) => {
      if (event.target.id === "folderManagerOverlay") {
        closeFolderManager();
      }
    });

    // ── FOLDER SELECT LOGIC ──
    document.getElementById("noteFolder").addEventListener("change", function () {
      const input = document.getElementById("newFolderInput");
      const color = document.getElementById("folderColorPicker");
      
      const show = this.value === "other";

      input.style.display = show ? "block" : "none";  
      color.style.display = show ? "block" : "none";
    });

    const noteBody = document.getElementById("noteBody");
    noteBody?.addEventListener("mouseup", rememberNoteSelection);
    noteBody?.addEventListener("keyup", rememberNoteSelection);
    noteBody?.addEventListener("focus", rememberNoteSelection);
    noteBody?.addEventListener("input", () => {
      rememberNoteSelection();
      updateFormatButtons();
    });
    document.addEventListener("selectionchange", () => {
      rememberNoteSelection();
      updateFormatButtons();
    });

    document.querySelectorAll(".textformatBar button").forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyTextFormat(button.dataset.format);
      });
    });

    // ── COMPOSER TOGGLE ──
    document.getElementById("newNoteBtn").addEventListener("click", () => {
      setActiveView("notes");
      document.getElementById("composer").classList.add("open");
      document.getElementById("noteAccentPicker").value = getCurrentAccentColor();
      syncPrimaryActions();
      document.getElementById("noteTitle").focus();
    });
    document.getElementById("cancelBtn").addEventListener("click", () => {
      document.getElementById("composer").classList.remove("open");
      document.getElementById("noteTitle").value = "";
      setNoteBodyContent("");
      document.getElementById("noteAccentPicker").value = getCurrentAccentColor();
      syncPrimaryActions();
    });

    document.getElementById("folderCreateForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      const nameInput = document.getElementById("folderCreateInput");
      const colorInput = document.getElementById("folderCreateColor");
      const folderName = nameInput.value.trim();
      const folderColor = colorInput.value || "#8FBF9A";

      if (!folderName) {
        showToast("Please enter a folder name.", true);
        nameInput.focus();
        return;
      }

      if (BUILTIN_FOLDERS.some((folder) => folder.key === folderName.toLowerCase())) {
        showToast("That name is already used by a default folder.", true);
        nameInput.focus();
        return;
      }

      try {
        const existingFolder = await findExistingCustomFolder(folderName);
        if (existingFolder) {
          showToast("A folder with that name already exists.", true);
          nameInput.focus();
          return;
        }

        await addDoc(collection(db, "folders"), {
          name: folderName,
          color: folderColor,
          userId: currentUser.uid,
        });

        nameInput.value = "";
        colorInput.value = "#8FBF9A";
        showToast("Folder created ✓");
        await loadFolderSidebar();
        await loadFolderDropdown();
        await loadFolderManager();
      } catch (err) {
        console.error(err);
        showToast("Could not create folder: " + (err.message || "unknown error"), true);
      }
    });

    // FAVORITE FILTER //
    document.getElementById("allNotesTab").addEventListener("click", () => {
      currentFilter = "all";
      selectedFolderFilter = null;

      document.querySelectorAll(".nav-tab")
        .forEach(el => el.classList.remove("active"));        

      setActiveView("notes");
      updateFilterTabs();
      loadNotes();
    });

    document.getElementById("favoritesTab").addEventListener("click", () => {
      currentFilter = "favorites";
      selectedFolderFilter = null;

      document.querySelectorAll("#folderList .nav-tab")
        .forEach(el => el.classList.remove("active"));
        
      setActiveView("notes");
      updateFilterTabs();
      loadNotes();
    });

    document.getElementById("archivedTab").addEventListener("click", () => {
      currentFilter = "archived";
      selectedFolderFilter = null;

      document.querySelectorAll("#folderList .nav-tab")
        .forEach(el => el.classList.remove("active"));

      setActiveView("notes");
      updateFilterTabs();
      loadNotes();
    });

    document.getElementById("searchInput").addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      loadNotes();
    });

    document.getElementById("sortSelect").addEventListener("change", (event) => {
      currentSort = event.target.value;
      loadNotes();
    });

    const supportFab = document.getElementById("supportFab");
    const supportPanel = document.getElementById("supportPanel");
    const supportClose = document.getElementById("supportClose");
    const supportForm = document.getElementById("supportForm");
    const supportTopic = document.getElementById("supportTopic");
    const supportMessage = document.getElementById("supportMessage");
    const supportSubmit = document.getElementById("supportSubmit");
    const profileMenuBtn = document.getElementById("profileMenuBtn");
    const profilePanel = document.getElementById("profilePanel");

    function setProfilePanel(isOpen) {
      profilePanel.classList.toggle("open", isOpen);
      profilePanel.setAttribute("aria-hidden", String(!isOpen));
      profileMenuBtn.setAttribute("aria-expanded", String(isOpen));
    }

    function setSupportPanel(isOpen) {
      supportPanel.classList.toggle("open", isOpen);
      supportPanel.setAttribute("aria-hidden", String(!isOpen));
      supportFab.setAttribute("aria-expanded", String(isOpen));
    }

    profileMenuBtn.addEventListener("click", () => {
      setProfilePanel(!profilePanel.classList.contains("open"));
    });

    supportFab.addEventListener("click", () => {
      setSupportPanel(!supportPanel.classList.contains("open"));
    });

    supportClose.addEventListener("click", () => {
      setSupportPanel(false);
    });

    document.getElementById("openSupportFromSettings").addEventListener("click", () => {
      setProfilePanel(false);
      setSupportPanel(true);
    });

    document.getElementById("settingsThemeBtn").addEventListener("click", () => {
      document.getElementById("themeToggle").click();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && profilePanel.classList.contains("open")) {
        setProfilePanel(false);
      }
      if (event.key === "Escape" && supportPanel.classList.contains("open")) {
        setSupportPanel(false);
      }
      if (event.key === "Escape" && currentView === "folders") {
        closeFolderManager();
      }
    });

    document.addEventListener("click", (event) => {
      const closeBtn = event.target instanceof Element ? event.target.closest("#folderManagerClose") : null;
      if (closeBtn) {
        closeFolderManager(event);
        return;
      }

      if (!profilePanel.contains(event.target) && !profileMenuBtn.contains(event.target)) {
        setProfilePanel(false);
      }
    });

    supportForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const topic = supportTopic.value.trim();
      const message = supportMessage.value.trim();

      if (!currentUser) {
        showToast("You must be signed in to send support messages.", true);
        return;
      }

      if (!message) {
        showToast("Please enter a support message.", true);
        supportMessage.focus();
        return;
      }

      supportSubmit.disabled = true;
      supportSubmit.textContent = "Sending...";

      try {
        await addDoc(collection(db, "supportMessages"), {
          topic,
          message,
          userId: currentUser.uid,
          userEmail: currentUser.email || "",
          userName: currentUser.displayName || "",
          createdAt: serverTimestamp(),
          status: "new",
        });

        supportForm.reset();
        setSupportPanel(false);
        showToast("Support message sent ✓");
      } catch (err) {
        console.error(err);
        showToast("Could not send support message: " + (err.message || "unknown error"), true);
      } finally {
        supportSubmit.disabled = false;
        supportSubmit.textContent = "Send to Support";
      }
    });
    
    // SAVE AND EDIT NOTE
    document.getElementById("saveBtn").addEventListener("click", async () => {
      const title = document.getElementById("noteTitle").value.trim();
      const body = getNoteBodyText();
      const formattedBody = getNoteBodyHtml();

      const selectedFolder = document.getElementById("noteFolder").value;
      const newFolder = document.getElementById("newFolderInput")?.value.trim();
      const pickedColor = document.getElementById("folderColorPicker")?.value;
      const noteAccentColor = document.getElementById("noteAccentPicker")?.value || pickedColor || getFolderColor(selectedFolder);

      const folder = selectedFolder === "other" && newFolder
        ? newFolder
        : selectedFolder;

      const folderColor = selectedFolder === "other" && newFolder
        ? pickedColor
        :getFolderColor(folder);

      if (!title) { showToast("Please add a title!", true); return; }
      if (!body)  { showToast("Note can't be empty!", true); return; }
      if (!currentUser) return;

      try {
        // Update existing note
        if (editingNoteId) {
          
          if (selectedFolder === "other") {
            if (!newFolder) {
              showToast("Please enter a folder name", true);
              return;
            }

          const existingFolder = await findExistingCustomFolder(newFolder);
          if (!existingFolder) {
            await addDoc(collection(db, "folders"), {
              name: newFolder,
              color: pickedColor,
              userId: currentUser.uid,
            });
          }
        }
        await updateDoc(doc(db, "notes", editingNoteId), {
          title: title,
          text: body,
          formattedText: formattedBody,
          folder: folder,
          folderColor: folderColor,
          noteAccentColor: noteAccentColor,
        });

        showToast("Note saved ✓");
        editingNoteId = null;
        } else {
          if (selectedFolder === "other") {
            if (!newFolder) {
              showToast("Please enter a folder name", true);
              return;
          }
          try {
            const existingFolder = await findExistingCustomFolder(newFolder);
            if (!existingFolder) {
              await addDoc(collection(db, "folders"), {
                name: newFolder,
                color: pickedColor,
                userId: currentUser.uid,
              });
            }
          } catch (err) {
            console.error("FOLDER ERROR:", err);
            showToast("Folder error: " + err.message, true);
            return;
          }
        }
      
          // Create new note
          await addDoc(collection(db, "notes"), {
            title: title,
            text: body,
            formattedText: formattedBody,
            folder: folder,
            folderColor: folderColor,
            noteAccentColor: noteAccentColor,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
            isFavorite: false,
            isArchived: false,
          });
          showToast("Note saved ✓");
        }

        document.getElementById("noteTitle").value = "";
        setNoteBodyContent("");
        document.getElementById("composer").classList.remove("open");

        document.getElementById("newFolderInput").value = "";
        document.getElementById("newFolderInput").style.display = "none"; 

        document.getElementById("folderColorPicker").style.display = "none";
        document.getElementById("noteAccentPicker").value = getCurrentAccentColor();
        loadFolderSidebar();
        loadFolderDropdown();
        loadFolderManager();
        loadNotes();
        syncPrimaryActions();
      
      } catch (err) {
        console.error(err);
        showToast("Error: " + err.message, true);
      }
    });

  // ── SIDEBAR FOLDER ──
async function loadFolderSidebar() {
  const container = document.getElementById("folderList");
  if (!container) return;

  container.innerHTML = `<div style="opacity:.5;">Loading folders...</div>`;

  try {
    const q = query(
      collection(db, "folders"),
      where("userId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(q);
    const notesSnapshot = await getDocs(query(
      collection(db, "notes"),
      where("userId", "==", currentUser.uid)
    ));

    const folderCounts = {};
    notesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.folder || data.isArchived) return;

      const folder = data.folder;

      folderCounts[folder] = (folderCounts[folder] || 0) + 1;
    });

    container.innerHTML = "";
    const seenFolders = new Set();
    const folders = BUILTIN_FOLDERS.map((folder) => ({
      name: folder.key,
      label: folder.label
    }));

    BUILTIN_FOLDERS.forEach((folder) => {
      seenFolders.add(folder.key.toLowerCase());
    });

    snapshot.forEach(doc => {
      const f = doc.data();
      const normalizedName = String(f.name || "").trim();
      if (!normalizedName) return;
      const lookupKey = normalizedName.toLowerCase();
      if (seenFolders.has(lookupKey)) return;

      seenFolders.add(lookupKey);
      folders.push({
        name: normalizedName,
        label: normalizedName
      });
    });

    folders.forEach((folder) => {
      const btn = document.createElement("button");
      btn.className = "nav-tab";
      const count = folderCounts[folder.name] || 0;

      btn.innerHTML = `
        <span>${folder.label}</span>
        <span class="nav-count">${count}</span>
      `;
      container.appendChild(btn);

      btn.addEventListener("click", () => {
        currentFilter = "folder";
        selectedFolderFilter = folder.name;

        document.querySelectorAll(".nav-tab")
          .forEach(el => el.classList.remove("active"));

        btn.classList.add("active");

        setActiveView("notes");
        updateSectionTitle();
        loadNotes();
      });
    });

  } catch (err) {
    console.error(err);

    container.innerHTML = `
      <div style="color:#ff6b6b;font-size:.8rem;">
        Unable to load folders (blocked)
      </div>
    `;
  }
}

  // DROPDOWN LOADER

async function loadFolderDropdown() {
  const select = document.getElementById("noteFolder");
  if (!select) return;

  select.innerHTML = "";
  const seenFolderNames = new Set(BUILTIN_FOLDERS.map((folder) => folder.key));

  BUILTIN_FOLDERS.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.key;
    option.textContent = folder.label;
    select.appendChild(option);
  });

  const createOption = document.createElement("option");
  createOption.value = "other";
  createOption.textContent = " + Create New Folder ";
  select.appendChild(createOption);

  try {
    const q = query(
      collection(db, "folders"),
      where("userId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(doc => {
      const f = doc.data();
      const normalizedName = String(f.name || "").trim();
      if (!normalizedName) return;
      const lookupKey = normalizedName.toLowerCase();
      if (seenFolderNames.has(lookupKey)) {
        return;
      }
      seenFolderNames.add(lookupKey);

      const option = document.createElement("option");
      option.value = normalizedName;
      option.textContent = normalizedName;

      select.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadFolderManager() {
  const defaultFolderList = document.getElementById("defaultFolderList");
  const folderManagerList = document.getElementById("folderManagerList");
  if (!defaultFolderList || !folderManagerList) return;

  defaultFolderList.innerHTML = "";
  BUILTIN_FOLDERS.forEach((folder) => {
    const item = document.createElement("div");
    item.className = "folder-static-item";
    item.innerHTML = `
      <span>${folder.label}</span>
      <span class="folder-badge">Fixed</span>
    `;
    defaultFolderList.appendChild(item);
  });

  if (!currentUser) {
    folderManagerList.innerHTML = `<div class="loading">Loading folders...</div>`;
    return;
  }

  folderManagerList.innerHTML = `<div class="loading">Loading folders...</div>`;

  try {
    const snapshot = await getDocs(query(
      collection(db, "folders"),
      where("userId", "==", currentUser.uid)
    ));

    const folders = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .filter((folder) => {
        const normalizedName = String(folder.name || "").trim();
        return normalizedName && !BUILTIN_FOLDERS.some((item) => item.key === normalizedName.toLowerCase());
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    if (!folders.length) {
      folderManagerList.innerHTML = `
        <div class="folder-manager-empty">
          <div class="empty-title">No custom folders yet</div>
          <div class="empty-sub">Create one from the note editor, then rename it here if needed.</div>
        </div>
      `;
      return;
    }

    folderManagerList.innerHTML = "";

    folders.forEach((folder) => {
      const row = document.createElement("form");
      row.className = "folder-manager-item";
      row.dataset.id = folder.id;
      row.dataset.name = folder.name;

      row.innerHTML = `
        <div class="folder-swatch" style="--folder-color:${escHtml(folder.color || "#8FBF9A")}"></div>
        <input type="text" class="folder-manager-input" value="${escHtml(folder.name)}" aria-label="Folder name for ${escHtml(folder.name)}" />
        <button type="submit" class="folder-manager-save">Save</button>
      `;

      const input = row.querySelector(".folder-manager-input");
      row.addEventListener("submit", async (event) => {
        event.preventDefault();

        const nextName = input.value.trim();
        const previousName = row.dataset.name;

        if (!nextName) {
          showToast("Folder name can't be empty.", true);
          input.focus();
          return;
        }

        if (nextName.toLowerCase() !== previousName.toLowerCase() && BUILTIN_FOLDERS.some((item) => item.key === nextName.toLowerCase())) {
          showToast("That name is reserved for a default folder.", true);
          input.focus();
          return;
        }

        if (nextName === previousName) {
          showToast("Folder name is unchanged.");
          return;
        }

        const duplicate = folders.some((item) => item.id !== folder.id && String(item.name || "").trim().toLowerCase() === nextName.toLowerCase());
        if (duplicate) {
          showToast("A folder with that name already exists.", true);
          input.focus();
          return;
        }

        const submitButton = row.querySelector(".folder-manager-save");
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
          await updateDoc(doc(db, "folders", folder.id), {
            name: nextName,
          });

          const notesSnapshot = await getDocs(query(
            collection(db, "notes"),
            where("userId", "==", currentUser.uid)
          ));

          const updates = [];
          notesSnapshot.forEach((noteDoc) => {
            const noteData = noteDoc.data();
            if (noteData.folder === previousName) {
              updates.push(updateDoc(doc(db, "notes", noteDoc.id), {
                folder: nextName,
              }));
            }
          });

          await Promise.all(updates);

          if (selectedFolderFilter === previousName) {
            selectedFolderFilter = nextName;
          }

          showToast("Folder renamed ✓");
          await loadFolderSidebar();
          await loadFolderDropdown();
          await loadFolderManager();
          loadNotes();
          updateSectionTitle();
        } catch (err) {
          console.error(err);
          showToast("Could not rename folder: " + (err.message || "unknown error"), true);
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Save";
        }
      });

      folderManagerList.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    folderManagerList.innerHTML = `
      <div class="loading">Unable to load folders: ${err.message}</div>
    `;
  }
}
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
      updateCounts(snapshot.docs);

      if (snapshot.empty) {
        renderEmptyState(grid);
        return;
      }

      grid.innerHTML = "";
      let docs = snapshot.docs;

      if (currentFilter === "archived") {
        docs = docs.filter(d => d.data().isArchived);
      } else {
        docs = docs.filter(d => !d.data().isArchived);
      }

      if (currentFilter === "favorites") {
        docs = docs.filter(d => d.data().isFavorite);
      }
        
      if (currentFilter === "folder" && selectedFolderFilter) {
        docs = docs.filter(d => d.data().folder === selectedFolderFilter);
      }

      if (searchTerm) {
        docs = docs.filter(d => matchesSearch(d.data(), searchTerm));
      }

      sortNotes(docs, currentSort);

      if (!docs.length) {
        renderEmptyState(grid);
        return;
      }

      docs.forEach((docSnap, i) => {
        const data = docSnap.data();
        const date = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString("en-US", { month:"short", day:"numeric" })
        : "Just now";
        
        const card = document.createElement("div");
        card.className = `note-card tag-${data.folder || "other"}`;
        card.style.setProperty('--folder-color', data.folderColor || '#8FBF9A');
        card.style.setProperty('--note-accent', data.noteAccentColor || data.folderColor || '#8FBF9A');
        card.style.animationDelay = (i * 0.05) + "s";
        card.innerHTML = `
          <button class="btn-favorite ${data.isFavorite ? "active" : ""}" data-id="${docSnap.id}">★</button>
          <div class="note-meta">
            <div class="note-folder">${folderLabel(data.folder)}</div>
            <span class="note-date">${date}</span>
          </div>
          <div class="note-title">${escHtml(data.title || "Untitled")}</div>
          <div class="note-preview">${escHtml(data.text || "")}</div>
          <div class="note-footer">
          <div class="note-action">
            <button class="btn-pdf" data-title="${escHtml(data.title)}" data-text="${escHtml(data.text)}">📄 PDF</button>
            <button class="btn-txt" data-title="${escHtml(data.title)}" data-text="${escHtml(data.text)}">📝 TXT</button>
            <button class="btn-copy" data-title="${escHtml(data.title)}" data-text="${escHtml(data.text)}">📋 Copy</button>
            <button class="btn-archive" data-id="${docSnap.id}">${data.isArchived ? "Restore" : "Archive 🗂"}</button>
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
        grid.querySelectorAll(".btn-archive").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const note = snapshot.docs.find(d => d.id === id);
            if (!note) return;

            const nextValue = !(note.data().isArchived || false);

            try {
              await updateDoc(doc(db, "notes", id), {
                isArchived: nextValue
              });
              showToast(nextValue ? "Note archived." : "Note restored ✓");
              loadFolderSidebar();
              loadNotes();
            } catch (err) {
              showToast("Error: " + err.message, true);
            }
          });
        });
        grid.querySelectorAll(".btn-favorite").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;

            const note = snapshot.docs.find(d => d.id === id);
            if (!note) return;

            const current = note.data().isFavorite || false;
            const nextValue = !current;

            await updateDoc(doc(db, "notes", id), {
              isFavorite: nextValue
            });

            if (nextValue) {
              currentFilter = "favorites";
              updateFilterTabs();
              showToast("Note added to Favorites ✓");
            } else {
              showToast("Note removed from Favorites");
            }

            loadNotes();
          });
        });

        // EDIT HANDLERS
        grid.querySelectorAll(".btn-edit").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            
            const id = btn.dataset.id;
            const note = snapshot.docs.find(d => d.id === id);
            if (!note) return

            const data = note.data();

            const input = document.getElementById("newFolderInput");
            const color = document.getElementById("folderColorPicker");
            const accent = document.getElementById("noteAccentPicker");

            document.getElementById("noteTitle").value = data.title || "";
            setNoteBodyContent(data.formattedText || data.text || "");

            const isCustom = !["school","work","personal","other"].includes(data.folder);

            if (isCustom) {
              document.getElementById("noteFolder").value = "other";

              input.style.display = "block";
              color.style.display = "block";

              input.value = data.folder;
              color.value = data.folderColor || "#8FBF9A";
            } else {
              input.style.display = "none";
              color.style.display = "none";
            }

            accent.value = data.noteAccentColor || data.folderColor || "#8FBF9A";

            setActiveView("notes");
            document.getElementById("composer").classList.add("open");
            syncPrimaryActions();
            editingNoteId = id;
          });
        });
      } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="loading">Error loading notes: ${err.message}</div>`;
      }
    }

    function folderLabel(f) {
      const map = {
        school: "School",
        work: "Work",
        personal: "Personal"
      };
      return map[f] || ` ${f}`;
    }

    function renderEmptyState(grid) {
      if (searchTerm) {
        grid.innerHTML = `
          <div class="empty">
            <div class="empty-icon">🔎</div>
            <div class="empty-title">No notes match "${escHtml(searchTerm)}"</div>
            <div class="empty-sub">Try a different keyword or clear the search.</div>
          </div>`;
        return;
      }

      if (currentFilter === "favorites") {
        grid.innerHTML = `
          <div class="empty">
            <div class="empty-icon">⭐</div>
            <div class="empty-title">No favorite notes yet</div>
            <div class="empty-sub">Tap the star on a note and it will show up here.</div>
          </div>`;
        return;
      }

      if (currentFilter === "archived") {
        grid.innerHTML = `
          <div class="empty">
            <div class="empty-icon">🗄️</div>
            <div class="empty-title">No archived notes</div>
            <div class="empty-sub">Archive a note to move it out of your main list.</div>
          </div>`;
        return;
      }

      grid.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No notes yet</div>
          <div class="empty-sub">Hit "+ New Note" to get started</div>
        </div>`;
    }

    function updateFilterTabs() {
      document.getElementById("allNotesTab")?.classList.toggle("active", currentFilter === "all");
      document.getElementById("favoritesTab")?.classList.toggle("active", currentFilter === "favorites");
      document.getElementById("archivedTab")?.classList.toggle("active", currentFilter === "archived");
      updateSectionTitle();
    }

    function setActiveView(view) {
      currentView = view;

      const isFolderView = view === "folders";
      const overlay = document.getElementById("folderManagerOverlay");
      const manager = document.getElementById("folderManager");

      document.getElementById("folderSettingsBtn")?.classList.toggle("active", isFolderView);
      overlay?.toggleAttribute("hidden", !isFolderView);
      manager?.setAttribute("aria-hidden", String(!isFolderView));
      document.body.style.overflow = isFolderView ? "hidden" : "";

      if (isFolderView) {
        document.getElementById("composer")?.classList.remove("open");
      }

      if (isFolderView) {
        loadFolderManager();
        document.getElementById("folderCreateInput")?.focus();
      }

      syncPrimaryActions();
      updateSectionTitle();
    }

    function closeFolderManager(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      setActiveView("notes");
    }

    function syncPrimaryActions() {
      const composerOpen = document.getElementById("composer")?.classList.contains("open");
      const folderOpen = currentView === "folders";
      document.getElementById("newNoteBtn")?.toggleAttribute("hidden", folderOpen);
      document.getElementById("folderSettingsBtn")?.toggleAttribute("hidden", composerOpen);
    }

    function updateSectionTitle() {
      const sectionTitle = document.getElementById("sectionTitle");
      if (!sectionTitle) return;

      if (currentView === "folders") {
        sectionTitle.textContent = "Folder Settings";
        return;
      }

      if (currentFilter === "folder" && selectedFolderFilter) {
        sectionTitle.textContent = folderLabel(selectedFolderFilter).trim();
        return;
      }

      if (currentFilter === "favorites") {
        sectionTitle.textContent = "Favorites";
        return;
      }

      if (currentFilter === "archived") {
        sectionTitle.textContent = "Archived";
        return;
      }

      sectionTitle.textContent = "All Notes";
    }

    function updateCounts(docs) {
      const activeDocs = docs.filter((docSnap) => !docSnap.data().isArchived);
      const allCount = activeDocs.length;
      const favoritesCount = activeDocs.filter((docSnap) => docSnap.data().isFavorite).length;
      const archivedCount = docs.filter((docSnap) => docSnap.data().isArchived).length;

      document.getElementById("allCount").textContent = String(allCount);
      document.getElementById("favoritesCount").textContent = String(favoritesCount);
      document.getElementById("archivedCount").textContent = String(archivedCount);
    }

    function escHtml(str) {
      return String(str)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function matchesSearch(data, term) {
      const haystack = [
        data.title || "",
        data.text || "",
        data.folder || "",
        folderLabel(data.folder)
      ].join(" ").toLowerCase();

      return haystack.includes(term);
    }

    function sortNotes(docs, sortMode) {
      docs.sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        const aTitle = (aData.title || "").trim().toLowerCase();
        const bTitle = (bData.title || "").trim().toLowerCase();
        const aCreated = aData.createdAt?.toMillis?.() || 0;
        const bCreated = bData.createdAt?.toMillis?.() || 0;

        switch (sortMode) {
          case "oldest":
            return aCreated - bCreated;
          case "title-asc":
            return aTitle.localeCompare(bTitle);
          case "title-desc":
            return bTitle.localeCompare(aTitle);
          case "newest":
          default:
            return bCreated - aCreated;
        }
      });
    }

    function applyTextFormat(formatType) {
      const noteBody = document.getElementById("noteBody");
      if (!noteBody) return;
      const selection = window.getSelection();
      if (!selection) return;
      const formatCommands = ["bold", "italic", "underline"];
      const activeRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const activeSelectionInEditor = activeRange && noteBody.contains(activeRange.commonAncestorContainer);

      let range = activeSelectionInEditor ? activeRange : (savedNoteRange ? savedNoteRange.cloneRange() : null);
      const hasSelectionInEditor = range && noteBody.contains(range.commonAncestorContainer);
      const hadExpandedSelection = Boolean(range && !range.collapsed && hasSelectionInEditor);

      if (formatType === "size-up" || formatType === "size-down") {
        adjustTextSize(range, selection, noteBody, formatType === "size-up" ? 1 : -1, hadExpandedSelection);
        rememberNoteSelection();
        updateFormatButtons();
        return;
      }

      const previousStates = getFormatStates(formatCommands);

      if (!hasSelectionInEditor) {
        range = document.createRange();
        range.selectNodeContents(noteBody);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      noteBody.focus();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand(formatType, false);

      if (hadExpandedSelection) {
        const caretRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : range.cloneRange();
        caretRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(caretRange);
        syncFormatStates(formatCommands, {
          bold: false,
          italic: false,
          underline: false,
        });
      } else {
        syncFormatStates(formatCommands, {
          ...previousStates,
          [formatType]: !previousStates[formatType],
        });
      }

      rememberNoteSelection();
      updateFormatButtons();
    }

    function rememberNoteSelection() {
      const noteBody = document.getElementById("noteBody");
      const selection = window.getSelection();
      if (!noteBody || !selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      if (!noteBody.contains(range.commonAncestorContainer)) return;

      savedNoteRange = range.cloneRange();
    }

    function updateFormatButtons() {
      const noteBody = document.getElementById("noteBody");
      const hasEditorFocus = document.activeElement === noteBody;
      const formatButtons = document.querySelectorAll(".textformatBar button");
      const sizeIndicator = document.getElementById("textSizeIndicator");
      const currentSize = getCurrentTextSizeLevel(noteBody);

      formatButtons.forEach((button) => {
        const formatType = button.dataset.format;
        const isActive = ["size-up", "size-down"].includes(formatType)
          ? false
          : hasEditorFocus && document.queryCommandState(formatType);
        button.classList.toggle("active", Boolean(isActive));
      });

      if (sizeIndicator) {
        sizeIndicator.textContent = String(currentSize);
      }
    }

    function getFormatStates(commands) {
      return commands.reduce((state, command) => {
        state[command] = document.queryCommandState(command);
        return state;
      }, {});
    }

    function syncFormatStates(commands, desiredStates) {
      commands.forEach((command) => {
        const isActive = document.queryCommandState(command);
        const shouldBeActive = Boolean(desiredStates[command]);
        if (isActive !== shouldBeActive) {
          document.execCommand(command, false);
        }
      });
    }

    function adjustTextSize(range, selection, noteBody, delta, hadExpandedSelection) {
      const existingWrapper = findTextSizeWrapper(range.commonAncestorContainer, noteBody);
      const currentSize = existingWrapper ? getTextSizeLevel(existingWrapper) : 3;
      const nextSize = Math.max(1, Math.min(6, currentSize + delta));

      if (!hadExpandedSelection) {
        applyTypingTextSize(range, selection, existingWrapper, nextSize);
        return;
      }

      const wrapper = document.createElement("span");
      wrapper.className = `rt-size-${nextSize}`;

      const contents = range.extractContents();
      flattenTextSizeWrappers(contents);
      wrapper.appendChild(contents);
      range.insertNode(wrapper);

      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      savedNoteRange = nextRange.cloneRange();
    }

    function applyTypingTextSize(range, selection, existingWrapper, nextSize) {
      if (existingWrapper) {
        existingWrapper.className = `rt-size-${nextSize}`;
        savedNoteRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : range.cloneRange();
        return;
      }

      const wrapper = document.createElement("span");
      wrapper.className = `rt-size-${nextSize}`;
      const marker = document.createTextNode("\u200b");
      wrapper.appendChild(marker);
      range.insertNode(wrapper);

      const nextRange = document.createRange();
      nextRange.setStart(marker, 1);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      savedNoteRange = nextRange.cloneRange();
    }

    function findTextSizeWrapper(node, noteBody) {
      const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      const wrapper = element?.closest?.("[class*='rt-size-']");
      return wrapper && noteBody.contains(wrapper) ? wrapper : null;
    }

    function getTextSizeLevel(wrapper) {
      const match = Array.from(wrapper.classList).find((className) => /^rt-size-[1-6]$/.test(className));
      return match ? Number(match.replace("rt-size-", "")) : 3;
    }

    function getCurrentTextSizeLevel(noteBody) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !noteBody) return 3;
      const wrapper = findTextSizeWrapper(selection.getRangeAt(0).commonAncestorContainer, noteBody);
      return wrapper ? getTextSizeLevel(wrapper) : 3;
    }

    function flattenTextSizeWrappers(fragment) {
      fragment.querySelectorAll?.("[class*='rt-size-']").forEach((wrapper) => {
        while (wrapper.firstChild) {
          wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
        }
        wrapper.remove();
      });
    }

    function getNoteBodyText() {
      const noteBody = document.getElementById("noteBody");
      return normalizePlainText(noteBody?.innerText || "");
    }

    function getNoteBodyHtml() {
      const noteBody = document.getElementById("noteBody");
      return sanitizeRichText(noteBody?.innerHTML || "");
    }

    function setNoteBodyContent(content) {
      const noteBody = document.getElementById("noteBody");
      if (!noteBody) return;

      noteBody.innerHTML = looksLikeHtml(content)
        ? sanitizeRichText(content)
        : plainTextToHtml(content);

      normalizeEditorMarkup(noteBody);
      savedNoteRange = null;
      updateFormatButtons();
    }

    function normalizeEditorMarkup(editor) {
      if (!editor) return;
      editor.innerHTML = sanitizeRichText(editor.innerHTML);
      if (editor.innerHTML === "<br>") {
        editor.innerHTML = "";
      }
    }

    function sanitizeRichText(html) {
      const template = document.createElement("template");
      template.innerHTML = html;

      const sanitizeNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return document.createTextNode(node.textContent || "");
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
          return document.createDocumentFragment();
        }

        const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "SPAN"]);
        const tagName = node.tagName.toUpperCase();
        const fragment = document.createDocumentFragment();

        Array.from(node.childNodes).forEach((child) => {
          fragment.appendChild(sanitizeNode(child));
        });

        if (!allowedTags.has(tagName)) {
          return fragment;
        }

        const cleanNode = document.createElement(tagName.toLowerCase());
        if (tagName === "SPAN") {
          const sizeClass = Array.from(node.classList).find((className) => /^rt-size-[1-6]$/.test(className));
          if (!sizeClass) {
            return fragment;
          }
          cleanNode.className = sizeClass;
        }
        cleanNode.appendChild(fragment);
        return cleanNode;
      };

      const container = document.createElement("div");
      Array.from(template.content.childNodes).forEach((child) => {
        container.appendChild(sanitizeNode(child));
      });

      return container.innerHTML
        .replace(/\u200b/g, "")
        .replace(/<div><br><\/div>/gi, "<br>")
        .replace(/<\/div><div>/gi, "<br>")
        .replace(/^<div>/i, "")
        .replace(/<\/div>$/i, "");
    }

    function plainTextToHtml(text) {
      return escHtml(text).replace(/\n/g, "<br>");
    }

    function normalizePlainText(text) {
      return text.replace(/\u00a0/g, " ").replace(/\u200b/g, "").replace(/\n{3,}/g, "\n\n").trim();
    }

    async function findExistingCustomFolder(folderName) {
      const normalizedTarget = String(folderName || "").trim().toLowerCase();
      if (!normalizedTarget || !currentUser) return null;

      const snapshot = await getDocs(query(
        collection(db, "folders"),
        where("userId", "==", currentUser.uid)
      ));

      return snapshot.docs.find((docSnap) => {
        const existingName = String(docSnap.data().name || "").trim().toLowerCase();
        return existingName === normalizedTarget;
      }) || null;
    }

    function getCurrentAccentColor() {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-color")
        .trim() || "#8FBF9A";
    }

    function looksLikeHtml(value) {
      return /<[^>]+>/.test(value);
    }

  function getFolderColor(folder) {
    return {
      school: "#8FBF9A",
      work: "#7FA8FF",
      personal: "#F28FA9",
      other: "#9AA3AF"
    }[folder] || "#8FBF9A";
  }

    function syncUserSettings(user) {
      const displayName = user.displayName || "NoteIT User";
      const email = user.email || "No email available";
      document.getElementById("settingsName").textContent = displayName;
      document.getElementById("settingsEmail").textContent = email;
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
    if (!w) { alert("Please allow popups for this site to export PDF."); return; }
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
      <div class="footer">NoteIT</div>
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
