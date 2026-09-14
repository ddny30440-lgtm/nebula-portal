/* ===== Nebula Portal client ===== */

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const wispUrl =
  (location.protocol === "https:" ? "wss" : "ws") +
  "://" + location.host + "/wisp/";

// set up transport (idempotent)
async function ensureTransport() {
  try {
    const current = await connection.getTransport();
    if (!current) {
      await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    }
    const t = await connection.getTransport();
    const el = document.getElementById("transportStatus");
    if (el) el.textContent = "Active transport: " + t;
    return true;
  } catch (e) {
    console.error("transport setup failed", e);
    const el = document.getElementById("transportStatus");
    if (el) el.textContent = "Transport setup failed — see console (F12).";
    return false;
  }
}

/* ===== URL helpers ===== */
function normalizeInput(raw) {
  let url = raw.trim();
  if (!url) return null;
  if (!url.includes(".")) {
    return "https://www.google.com/search?q=" + encodeURIComponent(url);
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

function proxied(url) {
  return __uv$config.prefix + __uv$config.encodeUrl(url);
}

/* ===== Tabs ===== */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tabpane").forEach((p) => p.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

/* ===== Proxy tab ===== */
const proxyStatus = document.getElementById("proxyStatus");

document.getElementById("proxyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = normalizeInput(document.getElementById("urlInput").value);
  if (!url) return;

  proxyStatus.textContent = "Connecting…";
  const ok = await ensureTransport();
  if (!ok) {
    proxyStatus.textContent = "Could not establish proxy connection.";
    return;
  }
  document.getElementById("proxyFrame").src = proxied(url);
  proxyStatus.textContent = "";
  document.title = "Nebula — " + url;
});

/* ===== Games ===== */
const GAMES = [
  { name: "Narrow One", emoji: "🏹", url: "https://narrow.one" },
  { name: "Krunker", emoji: "🔫", url: "https://krunker.io" },
  { name: "Shell Shockers", emoji: "🥚", url: "https://shellshock.io" },
  { name: "1v1.LOL", emoji: "🏗️", url: "https://1v1.lol" },
  { name: "2048", emoji: "🔢", url: "https://play2048.co" },
  { name: "Flappy Bird", emoji: "🐦", url: "https://nebez.github.io/floppybird/" },
  { name: "Hextris", emoji: "🔷", url: "https://hextris.io" },
  { name: "Jstris Tetris", emoji: "🧱", url: "https://jstris.jezevec10.com" },
  { name: "Pac-Man", emoji: "👻", url: "https://passer-by.com/pacman/" },
  { name: "Slither.io", emoji: "🐍", url: "http://slither.io" },
  { name: "Agar.io", emoji: "🟡", url: "https://agar.io" },
  { name: "Doom", emoji: "🧟", url: "https://silentspacemarine.com" },
];

const gamesGrid = document.getElementById("gamesGrid");
const gameStage = document.getElementById("gameStage");
const gameFrame = document.getElementById("gameFrame");
const stageTitle = document.getElementById("stageTitle");

GAMES.forEach((g) => {
  const card = document.createElement("div");
  card.className = "game-card";

  const emoji = document.createElement("span");
  emoji.className = "emoji";
  emoji.textContent = g.emoji;

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = g.name;

  const alt = document.createElement("button");
  alt.className = "alt";
  alt.textContent = "Open via Proxy";
  alt.title = "Load through the proxy engine — use if the game won't embed";
  alt.addEventListener("click", async (e) => {
    e.stopPropagation();
    const ok = await ensureTransport();
    if (!ok) return;
    openStage(g.name + " (proxied)", proxied(g.url));
  });

  card.append(emoji, name, alt);
  card.addEventListener("click", () => openStage(g.name, g.url));
  gamesGrid.appendChild(card);
});

function openStage(title, src) {
  gamesGrid.classList.add("hidden");
  gameStage.classList.remove("hidden");
  stageTitle.textContent = title;
  gameFrame.src = src;
}

document.getElementById("backBtn").addEventListener("click", () => {
  gameFrame.src = "about:blank";
  gameStage.classList.add("hidden");
  gamesGrid.classList.remove("hidden");
});

document.getElementById("fullscreenBtn").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else gameFrame.requestFullscreen().catch(() => {});
});

/* ===== Settings ===== */
document.getElementById("epoxyBtn").addEventListener("click", async () => {
  document.getElementById("transportStatus").textContent = "Setting transport…";
  await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
  ensureTransport();
});

document.getElementById("reconnectBtn").addEventListener("click", async () => {
  await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
  ensureTransport();
});

ensureTransport();
