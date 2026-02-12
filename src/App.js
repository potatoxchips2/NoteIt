const form = document.getElementById("noteForm");
const notesContainer = document.getElementById("notesContainer");

let notes = [];

form.addEventListener("submit", function(event) {
    event.preventDefault();

    const title = document.getElementById("title").value;
    const content = document.getElementById("content").value;

    const note = {
        title: title,
        content: content
    };

    notes.push(note);
    displayNotes();

    form.reset();
});

function displayNotes() {
    notesContainer.innerHTML = "";

    notes.forEach((note) => {
        const noteDiv = document.createElement("div");

        noteDiv.innerHTML = `
            <h3>${note.title}</h3>
            <p>${note.content}</p>
            <hr>
        `;

        notesContainer.appendChild(noteDiv);
    });
}
