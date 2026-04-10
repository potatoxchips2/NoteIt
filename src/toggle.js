
document.getElementById("themeToggle").addEventListener("click", function() {
  const isLight = document.body.classList.toggle("light-mode");
  this.textContent = isLight ? "🌙 Dark Mode" : "☀️ Light Mode";
  localStorage.setItem("theme", isLight ? "light" : "dark");
});

if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-mode");
  document.getElementById("themeToggle").textContent = "🌙 Dark Mode";
}