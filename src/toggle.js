
const themeToggleBtn = document.getElementById("themeToggle");
const settingsThemeBtn = document.getElementById("settingsThemeBtn");

function syncThemeLabels(isLight) {
  themeToggleBtn.textContent = isLight ? "🌙 Dark Mode" : "☀️ Light Mode";
  if (settingsThemeBtn) {
    settingsThemeBtn.textContent = isLight ? "Dark Mode" : "Light Mode";
  }
}

themeToggleBtn.addEventListener("click", function() {
  const isLight = document.body.classList.toggle("light-mode");
  syncThemeLabels(isLight);
  localStorage.setItem("theme", isLight ? "light" : "dark");
});

const storedTheme = localStorage.getItem("theme");
if (storedTheme === "light") {
  document.body.classList.add("light-mode");
}

syncThemeLabels(document.body.classList.contains("light-mode"));
