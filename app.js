// =========================================
// Planning Poker - Realtime Firebase Client
// Handles:
//   - Firebase initialisation
//   - Joining/creating rooms
//   - Syncing votes & participants in Realtime Database
//   - Rendering cards, participants, and emoji rain
//   - URL/share link handling and basic room TTL
// =========================================
import { generateRoomId, getInitials } from "./utils.js";

// Import Firebase modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  onValue,
  set,
  update,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ==============================
// 1. Firebase configuration
// ==============================

// TODO: Paste your own Firebase config here from the Firebase console
// (Project settings -> Web app). Example shape:
const firebaseConfig = {
  apiKey: "AIzaSyDgCPedP7jg9vZFj6ioqQ2QU5mmX7CGmRo",
  authDomain: "planning-poker-e91b7.firebaseapp.com",
  databaseURL: "https://planning-poker-e91b7-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "planning-poker-e91b7",
  storageBucket: "planning-poker-e91b7.firebasestorage.app",
  messagingSenderId: "652847125094",
  appId: "1:652847125094:web:44c42a0a3bb1106fc353a7",
  measurementId: "G-T7MZ6W7GWH"
};
// Initialise Firebase app + Realtime Database handle
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==============================
// 2. DOM elements
// ==============================

// Layout
const appRoot = document.getElementById("app");
const joinScreen = document.getElementById("join-screen");
const pokerScreen = document.getElementById("poker-screen");

// Header / branding
const appTitleText = document.getElementById("app-title-text");
const brandPill = document.getElementById("brand-pill");
const brandPillText = document.getElementById("brand-pill-text");
const subtitleText = document.getElementById("subtitle-text");

// Connection / room indicator
const connectionDot = document.getElementById("connection-dot");
const connectionLabel = document.getElementById("connection-label");
const roomLabel = document.getElementById("room-code-label");
const copyLinkBtn = document.getElementById("copy-link-btn");

// Join form
const nameInput = document.getElementById("name-input");
const roomInput = document.getElementById("room-input");
const joinError = document.getElementById("join-error");
const joinRoomBtn = document.getElementById("join-room-btn");
const randomRoomBtn = document.getElementById("random-room-btn");

// Poker controls & story
const youNamePill = document.getElementById("you-name-pill");
const storyInput = document.getElementById("story-input");
const storyCurrent = document.getElementById("story-current");
const revealBtn = document.getElementById("reveal-btn");
const clearBtn = document.getElementById("clear-btn");
const leaveBtn = document.getElementById("leave-btn");

// Cards & participants
const cardsContainer = document.getElementById("cards-container");
const voteStatusLabel = document.getElementById("vote-status-label");
const participantsList = document.getElementById("participants-list");

// Summary panel
const summaryCount = document.getElementById("summary-count");
const summaryMin = document.getElementById("summary-min");
const summaryMax = document.getElementById("summary-max");
const summaryAvg = document.getElementById("summary-avg");
const participantsCountLabel = document.getElementById("participants-count-label");

// Revealed votes overlay (above the main card)
const revealedOverlay = document.getElementById("revealed-overlay");

// Toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

// ==============================
// 3. State
// ==============================

// Supported planning poker card values (displayed in this exact order)
const CARD_VALUES = [
  "0",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "21",
  "34",
  "55",
  "89",
  "?"
];

// Emojis used by the emoji rain fun card
const EMOJIS = ["🎉", "🚀", "🤖", "✨", "🔥", "💚", "📊", "✅", "🧠", "🌀", "💩", "🥑", "🍆"];
let currentEmoji = "🎉";

// Lightweight branding config so the app title/tagline/accent can be tweaked easily
const BRAND = {
  title: "Planning Poker",
  brandName: "",
  tagline: "Lightweight online planning poker for your team.",
  accent: "#22c55e"
};

// How long a room should live without activity before being treated as expired.
// Currently: 24 hours.
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

// Room / client state
let currentRoomId = null;
let currentName = "";
let clientId = null;
let revealState = false;
let participants = {}; // { clientId: { name, vote } }
let currentVote = null;
let currentStory = "";
let lastEmojiRainAt = 0;
let roomSubscription = null; // unsubscribe function
let participantsSubscription = null; // unsubscribe function

// ==============================
// 4. Helpers
// ==============================

// Generate a per-browser client ID so each tab is uniquely identified in the room.
function generateClientId() {
  return "c_" + Math.random().toString(36).slice(2, 10);
}

// Show a temporary toast notification near the top of the screen.
function showToast(message) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2000);
}

// Update the small "Online/Offline" indicator in the header.
function setConnectionState(online) {
  if (!connectionDot || !connectionLabel) return;
  if (online) {
    connectionDot.classList.remove("offline");
    connectionLabel.textContent = "Online";
  } else {
    connectionDot.classList.add("offline");
    connectionLabel.textContent = "Offline";
  }
}

// Keep the current room in the URL (as ?room=ROOM-ID) without reloading the page.
function updateURLWithRoom(roomId) {
  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }
  window.history.replaceState({}, "", url.toString());
}

// Update the room code pill in the header based on currentRoomId.
function refreshShareUI() {
  if (!roomLabel) return;
  if (currentRoomId) {
    roomLabel.textContent = currentRoomId;
  } else {
    roomLabel.textContent = "—";
  }
}

// Build a shareable URL that opens this same room when someone visits it.
function getShareLink() {
  const url = new URL(window.location.href);
  if (currentRoomId) {
    url.searchParams.set("room", currentRoomId);
  }
  return url.toString();
}

// Pick a random emoji from the configured emoji list.
function pickRandomEmoji() {
  const idx = Math.floor(Math.random() * EMOJIS.length);
  return EMOJIS[idx];
}

// Spawn a bunch of falling emojis for a quick celebratory effect.
function triggerEmojiRain(emoji) {
  const count = 40;
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    span.className = "emoji-fall";
    span.textContent = emoji;

    span.style.left = Math.random() * 100 + "vw";
    span.style.animationDuration = 3 + Math.random() * 2 + "s";
    span.style.animationDelay = Math.random() * 0.5 + "s";

    document.body.appendChild(span);
    span.addEventListener("animationend", () => {
      span.remove();
    });
  }
}

// Broadcast an emoji rain event to the room via Firebase state.
async function broadcastEmojiRain(emoji) {
  if (!currentRoomId || !emoji) return;
  const stateRef = ref(db, `rooms/${currentRoomId}/state`);
  await update(stateRef, {
    emojiRain: {
      emoji,
      at: Date.now(),
      by: clientId || null
    },
    updatedAt: serverTimestamp()
  });
}

// ==============================
// 4. Branding helper
// ==============================
// Apply simple branding values (title, tagline, accent colour)
// and initialise the header pill with the current date/time.
function applyBranding() {
  if (BRAND.title) {
    document.title = BRAND.title;
    if (appTitleText) appTitleText.textContent = BRAND.title;
  }

  if (BRAND.tagline && subtitleText) {
    subtitleText.textContent = BRAND.tagline;
  }

  if (BRAND.accent) {
    document.documentElement.style.setProperty("--accent", BRAND.accent);
    document.documentElement.style.setProperty("--accent-soft", "rgba(34, 197, 94, 0.15)");
  }

  updateDateTimePill();
}

function updateDateTimePill() {
  if (!brandPillText) return;
  const now = new Date();
  const datePart = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const timePart = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
  brandPillText.textContent = `${datePart} · ${timePart}`;
}

// ==============================
// 5. Rendering cards & participants
// ==============================

// Build the full set of cards (0-89, ?) plus the emoji rain card, and
// highlight the currently selected vote.
function renderCards() {
  if (!cardsContainer) return;
  cardsContainer.innerHTML = "";

  // Normal planning poker cards
  CARD_VALUES.forEach((value, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "vote-card";
    card.dataset.value = value;

    // Assign colour intensity based on position
    if (value === "0" || value === "?") {
      card.classList.add("level-neutral");
    } else {
      if (index <= 3) {
        // 1, 2, 3 -> greener (low)
        card.classList.add("level-low");
      } else if (index <= 7) {
        // 5, 8, 13, 21 -> mid (yellow / amber)
        card.classList.add("level-mid");
      } else {
        // 34, 55, 89 -> high (red)
        card.classList.add("level-high");
      }
    }

    if (currentVote === value) {
      card.classList.add("selected");
    }

    const mainSpan = document.createElement("span");
    mainSpan.className = "main";
    mainSpan.textContent = value;

    const subSpan = document.createElement("span");
    subSpan.className = "sub";
    subSpan.textContent = value === "?" ? "Unsure" : "Points";

    card.appendChild(mainSpan);
    card.appendChild(subSpan);

    card.addEventListener("click", () => {
      if (!currentRoomId || !clientId) return;
      currentVote = value;
      renderCards();
      saveVote(value);
    });

    cardsContainer.appendChild(card);
  });

  // Extra emoji fun card, displayed after the '?' card
  const emojiCard = document.createElement("button");
  emojiCard.type = "button";
  emojiCard.className = "vote-card emoji-card level-neutral";

  const emojiMain = document.createElement("span");
  emojiMain.className = "main";
  emojiMain.textContent = currentEmoji;

  const emojiSub = document.createElement("span");
  emojiSub.className = "sub";
  emojiSub.textContent = "Emoji rain";

  emojiCard.appendChild(emojiMain);
  emojiCard.appendChild(emojiSub);

  emojiCard.addEventListener("click", () => {
    // Use the emoji currently displayed on the card for the rain,
    // then rotate to a new emoji for the next click.
    const emoji = currentEmoji || emojiMain.textContent || pickRandomEmoji();
    // Broadcast to the room so everyone sees the same emoji rain.
    broadcastEmojiRain(emoji);

    const nextEmoji = pickRandomEmoji();
    currentEmoji = nextEmoji;
    emojiMain.textContent = nextEmoji;
  });

  cardsContainer.appendChild(emojiCard);

  if (!voteStatusLabel) return;
  if (!currentVote) {
    voteStatusLabel.textContent = "No vote yet";
  } else {
    voteStatusLabel.textContent = `Your vote: ${currentVote}`;
  }
}

// Render revealed votes as full coloured cards in the header when reveal is on.
function renderRevealedCards() {
  if (!revealedOverlay) return;

  // Hide the overlay completely if we're not in reveal mode
  if (!revealState) {
    revealedOverlay.classList.add("hidden");
    revealedOverlay.innerHTML = "";
    return;
  }

  const entries = Object.entries(participants || {}).filter(([, p]) => p && typeof p === "object");

  // Only participants who have actually cast a vote
  const votedParticipants = entries.filter(([, p]) => p && p.vote);

  if (votedParticipants.length === 0) {
    revealedOverlay.classList.add("hidden");
    revealedOverlay.innerHTML = "";
    return;
  }

  revealedOverlay.classList.remove("hidden");
  revealedOverlay.innerHTML = "";

  votedParticipants.forEach(([, p], index) => {
    const name = (p && p.name) ? p.name : "Anonymous";
    const value = String(p.vote);

    const card = document.createElement("div");
    card.className = "vote-card revealed-overlay-card";

    // Reuse the same colour intensity rules as the main cards
    if (value === "0" || value === "?") {
      card.classList.add("level-neutral");
    } else {
      const originalIndex = CARD_VALUES.indexOf(value);
      const idx = originalIndex === -1 ? index : originalIndex;
      if (idx <= 3) {
        card.classList.add("level-low");
      } else if (idx <= 7) {
        card.classList.add("level-mid");
      } else {
        card.classList.add("level-high");
      }
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "revealed-name";
    nameSpan.textContent = name;

    const mainSpan = document.createElement("span");
    mainSpan.className = "main";
    mainSpan.textContent = value;

    const subSpan = document.createElement("span");
    subSpan.className = "sub";
    subSpan.textContent = value === "?" ? "Unsure" : "Points";

    card.appendChild(nameSpan);
    card.appendChild(mainSpan);
    card.appendChild(subSpan);

    revealedOverlay.appendChild(card);
  });
}

// Render the participant list in the right-hand panel, including:
//   - Avatar initials
//   - Voted/Thinking status
//   - Vote value (hidden until reveal)
//   - Summary stats (min/max/avg and voted/total)
function renderParticipants() {
  if (!participantsList) return;

  participantsList.innerHTML = "";

  const entries = Object.entries(participants || {}).filter(([, p]) => p && typeof p === "object");
  let numericVotes = [];

  entries.forEach(([id, p]) => {
    const name = (p && p.name) ? p.name : "Anonymous";

    const li = document.createElement("li");
    li.className = "participant";

    // Left side: avatar + name + status
    const left = document.createElement("div");
    left.className = "participant-left";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = getInitials(name);

    const nameAndStatus = document.createElement("div");
    nameAndStatus.style.display = "flex";
    nameAndStatus.style.flexDirection = "column";
    nameAndStatus.style.gap = "2px";

    const nameSpan = document.createElement("span");
    nameSpan.className = "participant-name";
    nameSpan.textContent = name;

    const statusSpan = document.createElement("span");
    statusSpan.className = "participant-status";

    const statusDot = document.createElement("span");
    statusDot.className = "vote-dot" + (p.vote ? " ready" : "");

    const statusText = document.createElement("span");
    statusText.textContent = p.vote ? "Voted" : "Thinking…";

    statusSpan.appendChild(statusDot);
    statusSpan.appendChild(statusText);

    nameAndStatus.appendChild(nameSpan);
    nameAndStatus.appendChild(statusSpan);

    left.appendChild(avatar);
    left.appendChild(nameAndStatus);

    // Right side: tick if voted, … if not
    const voteSpan = document.createElement("span");
    voteSpan.className = "participant-vote";

    if (!p.vote) {
      // No vote yet -> just "…"
      voteSpan.textContent = "…";
      voteSpan.classList.add("hidden-vote");
    } else {
      // Voted -> always show ✅
      voteSpan.textContent = "✅";
      voteSpan.classList.add("revealed");

      // Still collect numeric values for summary stats (min/max/avg)
      const num = Number(p.vote);
      if (!Number.isNaN(num)) {
        numericVotes.push(num);
      }
    }

    li.appendChild(left);
    li.appendChild(voteSpan);
    participantsList.appendChild(li);
  });

  // Summary
  const total = entries.length;
  const voted = entries.filter(([, p]) => !!p.vote && p.vote !== "").length;

  if (summaryCount) summaryCount.textContent = `${voted} / ${total}`;

  if (participantsCountLabel) {
    participantsCountLabel.textContent = `${total} in room`;
  }
  // Also update the revealed votes bar when participants change
  renderRevealedCards();

  if (revealState && numericVotes.length > 0) {
    const min = Math.min(...numericVotes);
    const max = Math.max(...numericVotes);
    const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length;
    if (summaryMin) summaryMin.textContent = String(min);
    if (summaryMax) summaryMax.textContent = String(max);
    if (summaryAvg) summaryAvg.textContent = avg.toFixed(1);
  } else {
    if (summaryMin) summaryMin.textContent = "—";
    if (summaryMax) summaryMax.textContent = "—";
    if (summaryAvg) summaryAvg.textContent = "—";
  }
}

// Lightweight helper to show either the current story or a fallback label.
function updateStoryDisplay() {
  if (!storyCurrent) return;
  if (currentStory && currentStory.trim() !== "") {
    storyCurrent.textContent = currentStory;
  } else {
    storyCurrent.textContent = "No story set yet";
  }
}

// ==============================
// 6. Firebase syncing
// ==============================

// Attach live listeners for the given room so we stay in sync with:
//   - reveal state
//   - story text
//   - emoji rain events
//   - participants list
function subscribeToRoom(roomId) {
  if (!roomId) return;

  // Unsubscribe previous
  if (roomSubscription) roomSubscription();
  if (participantsSubscription) participantsSubscription();

  const revealRef = ref(db, `rooms/${roomId}/state/reveal`);
  const storyRef = ref(db, `rooms/${roomId}/state/story`);
  const emojiRef = ref(db, `rooms/${roomId}/state/emojiRain`);
  const participantsRef = ref(db, `rooms/${roomId}/participants`);

  const offReveal = onValue(revealRef, (snap) => {
    const val = snap.val();
    revealState = !!val;
    renderParticipants();
    renderRevealedCards();
  });

  const offStory = onValue(storyRef, (snap) => {
    currentStory = snap.val() || "";
    updateStoryDisplay();
  });

  const offEmoji = onValue(emojiRef, (snap) => {
    const val = snap.val();
    if (!val || !val.emoji || !val.at) return;
    // Only trigger when we see a newer event than we've already handled.
    if (val.at <= lastEmojiRainAt) return;
    lastEmojiRainAt = val.at;
    triggerEmojiRain(val.emoji);
  });

  const offParticipants = onValue(participantsRef, (snap) => {
    participants = snap.val() || {};
    renderParticipants();
  });

  roomSubscription = () => {
    offReveal();
    offStory();
    offEmoji();
  };
  participantsSubscription = () => {
    offParticipants();
  };
}

// Join (or create) a room with the given ID and display name.
async function joinRoom(roomId, name) {
  // Normalise room ID and display name, and ensure we have a clientId for this browser.
  currentRoomId = roomId.trim().toUpperCase();
  currentName = name.trim() || "Anonymous";

  if (!clientId) {
    clientId = localStorage.getItem("planningPokerClientId");
    if (!clientId) {
      clientId = generateClientId();
      localStorage.setItem("planningPokerClientId", clientId);
    }
  }

  localStorage.setItem("planningPokerName", currentName);

  const roomStateRef = ref(db, `rooms/${currentRoomId}/state`);
  let existingState = null;
  try {
    const snap = await get(roomStateRef);
    existingState = snap.val();
  } catch (e) {
    console.error("Failed to read room state", e);
  }

  const now = Date.now();

  // Prefer updatedAt (last activity), fall back to createdAt when deciding if a room is stale.
  let lastActive = null;
  if (existingState) {
    if (typeof existingState.updatedAt === "number") {
      lastActive = existingState.updatedAt;
    } else if (typeof existingState.createdAt === "number") {
      lastActive = existingState.createdAt;
    }
  }

  if (lastActive && (now - lastActive) > ROOM_TTL_MS) {
    // Room expired, clear it so it behaves like new
    await remove(ref(db, `rooms/${currentRoomId}`));
    existingState = null;
  }

  // Ensure timestamps exist for the room and bump updatedAt
  if (!existingState || !existingState.createdAt) {
    await update(roomStateRef, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await update(roomStateRef, {
      updatedAt: serverTimestamp()
    });
  }

  const participantRef = ref(db, `rooms/${currentRoomId}/participants/${clientId}`);

  await set(participantRef, {
    name: currentName,
    vote: "",
    joinedAt: Date.now()
  });

  // Ignore any historic emojiRain events that were already in the room
  // before this client joined; only react to future ones.
  lastEmojiRainAt = Date.now();

  subscribeToRoom(currentRoomId);
  updateURLWithRoom(currentRoomId);
  refreshShareUI();

  if (youNamePill) youNamePill.textContent = currentName || "You";
  if (joinScreen) joinScreen.classList.add("hidden");
  if (pokerScreen) pokerScreen.classList.remove("hidden");
  if (copyLinkBtn) copyLinkBtn.disabled = false;
  renderCards();
  setConnectionState(true);

  // Set room code field to the active room for convenience.
  if (roomInput) roomInput.value = currentRoomId;
}

// Save the current user's vote for the active room.
async function saveVote(vote) {
  if (!currentRoomId || !clientId) return;
  const participantRef = ref(db, `rooms/${currentRoomId}/participants/${clientId}`);
  await update(participantRef, { vote });
}

// Toggle whether votes are revealed or hidden in this room.
async function setRevealState(reveal) {
  if (!currentRoomId) return;
  const stateRef = ref(db, `rooms/${currentRoomId}/state`);
  await update(stateRef, {
    reveal: !!reveal,
    updatedAt: serverTimestamp()
  });
}

// Clear all votes and the current story for the room (for the next item).
async function clearVotesAndStory() {
  if (!currentRoomId) return;
  const participantsRef = ref(db, `rooms/${currentRoomId}/participants`);
  const stateRef = ref(db, `rooms/${currentRoomId}/state`);
  // Fetch current participants so we can bulk-clear only their vote fields.
  const snap = await get(participantsRef);
  const currentParticipants = snap.val() || {};
  const updates = {};
  Object.keys(currentParticipants).forEach((id) => {
    updates[`rooms/${currentRoomId}/participants/${id}/vote`] = "";
  });

  await update(ref(db), updates);
  await update(stateRef, {
    story: "",
    reveal: false,
    updatedAt: serverTimestamp()
  });

  currentStory = "";
  currentVote = null;
  revealState = false;
  updateStoryDisplay();
  renderCards();
  renderParticipants();
  renderRevealedCards();
}

// Persist the current story/title to the room state.
async function saveStory(story) {
  if (!currentRoomId) return;
  const stateRef = ref(db, `rooms/${currentRoomId}/state`);
  await update(stateRef, {
    story: story || "",
    updatedAt: serverTimestamp()
  });
}

// Leave the current room, remove this participant server-side, and
// reset all local UI/state back to the join screen.
async function leaveRoom() {
  // Remove this participant from the room (best-effort)
  if (currentRoomId && clientId) {
    const participantRef = ref(db, `rooms/${currentRoomId}/participants/${clientId}`);
    try {
      await remove(participantRef);
    } catch (e) {
      console.error("Failed to remove participant on leave", e);
    }
  }

  // Unsubscribe listeners
  if (roomSubscription) {
    roomSubscription();
    roomSubscription = null;
  }
  if (participantsSubscription) {
    participantsSubscription();
    participantsSubscription = null;
  }

  // Reset local state
  currentRoomId = null;
  revealState = false;
  participants = {};
  currentVote = null;
  currentStory = "";

  if (storyInput) storyInput.value = "";
  updateStoryDisplay();

  if (participantsList) participantsList.innerHTML = "";

  if (summaryCount) summaryCount.textContent = "0 / 0";
  if (summaryMin) summaryMin.textContent = "—";
  if (summaryMax) summaryMax.textContent = "—";
  if (summaryAvg) summaryAvg.textContent = "—";

  // Hide any revealed votes bar when leaving the room
  renderRevealedCards();

  if (joinScreen) joinScreen.classList.remove("hidden");
  if (pokerScreen) pokerScreen.classList.add("hidden");
  if (voteStatusLabel) voteStatusLabel.textContent = "No vote yet";

  refreshShareUI();
  setConnectionState(false);
  if (copyLinkBtn) copyLinkBtn.disabled = true;
}

// ==============================
// 8. Initialisation
// ==============================

// On first load, restore name from localStorage and pre-fill room from ?room= query param.
function initFromURL() {
  const url = new URL(window.location.href);
  const roomFromUrl = url.searchParams.get("room");

  const savedName = localStorage.getItem("planningPokerName") || "";
  if (nameInput && savedName) {
    nameInput.value = savedName;
  }

  if (roomInput && roomFromUrl) {
    roomInput.value = roomFromUrl;
  }
}

// ==============================
// 9. Event listeners
// ==============================

// --- UI: Join screen interactions ---
if (randomRoomBtn && roomInput) {
  randomRoomBtn.addEventListener("click", () => {
    const id = generateRoomId();
    roomInput.value = id.toUpperCase();
  });
}

if (joinRoomBtn) {
  joinRoomBtn.addEventListener("click", async () => {
    const name = nameInput ? nameInput.value.trim() : "";
    if (joinError) joinError.style.display = "none";
    const room = (roomInput && roomInput.value.trim()) || generateRoomId();

    if (!name) {
      if (nameInput) {
        nameInput.focus();
        nameInput.classList.add("input-error");
        showToast("Please enter a name");
        setTimeout(() => nameInput.classList.remove("input-error"), 1000);
      }
      return;
    }

    try {
      await joinRoom(room, name);
    } catch (e) {
      console.error("Failed to join room", e);
      if (joinError) {
        joinError.style.display = "inline";
        joinError.textContent = "There was a problem joining the room";
      }
      setConnectionState(false);
    }
  });
}

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", async () => {
    if (!currentRoomId) return;
    const link = getShareLink();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const temp = document.createElement("input");
        temp.value = link;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }
      showToast("Share link copied to clipboard");
    } catch (e) {
      console.error("Failed to copy link", e);
      showToast("Could not copy link");
    }
  });
}

if (revealBtn) {
  revealBtn.addEventListener("click", () => {
    setRevealState(!revealState);
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    clearVotesAndStory();
  });
}

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    leaveRoom();
  });
}

if (storyInput) {
  storyInput.addEventListener("change", (e) => {
    const value = e.target.value;
    currentStory = value;
    updateStoryDisplay();
    saveStory(value);
  });
}

window.addEventListener("beforeunload", () => {
  // Best-effort: mark user as left when they close the tab.
  if (currentRoomId && clientId) {
    const participantRef = ref(db, `rooms/${currentRoomId}/participants/${clientId}`);
    remove(participantRef).catch(() => {});
  }
});

// ==============================
// 10. Boot
// ==============================

// Kick everything off: branding, initial card render, URL parsing, and header state.
applyBranding();
setInterval(updateDateTimePill, 30000);
renderCards();
initFromURL();
refreshShareUI();
setConnectionState(false);

// Disable copy link until we are in a room
if (copyLinkBtn) {
  copyLinkBtn.disabled = true;
}
