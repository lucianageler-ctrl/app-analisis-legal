const $ = (selector) => document.querySelector(selector);
const uid = () => Math.random().toString(36).slice(2, 10);

function toast(message) {
  const wrap = $("#toastWrap");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    setTimeout(() => el.remove(), 180);
  }, 2600);
}

function setStatus(message, progress = null) {
  $("#statusText").textContent = message;
  if (typeof progress === "number") {
    $("#progressBar").style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

function toSentenceCase(value) {
  const clean = normalizeText(value || "");
  if (!clean) return "Sin dato";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function simplifyText(value, max = 180) {
  const clean = normalizeText(value || "");
  if (!clean) return "No disponible.";
  const shortened = clean.length > max ? `${clean.slice(0, max).trim()}...` : clean;
  return toSentenceCase(shortened);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}
