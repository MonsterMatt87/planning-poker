# Planning Poker (Firebase + GitHub Pages)

A lightweight, browser-based **planning poker** app for agile sprint refinement.  
No backend servers, no logins — just share a link and estimate together in real time.

Built with:

- **HTML / CSS / JavaScript**
- **Firebase Realtime Database**
- **GitHub Pages** for hosting

Live version:

👉 [Open Planning Poker](https://MonsterMatt87.github.io/planning-poker/)

⸻

## ✨ Features

- 🔗 **Room-based sessions**  
  - Each room has a human-friendly ID like `FRANCE-482`  
  - Room names are **case-insensitive**, always displayed in UPPERCASE  
  - Join by typing a room ID or using the _Random room_ button

- 🃏 **Planning poker cards**  
  - Card values: `0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?`  
  - Colour scale from green → yellow → red as the numbers increase  
  - `0` and `?` are neutral (white/grey)  
  - A special **emoji card** at the end triggers **emoji rain** for *everyone in the room* (🎉, 🚀, 🤖, ✨, 🔥, 💚, 📊, ✅, 🧠, 🌀, 💩, 🥑, 🍆)

- 🧑‍🤝‍🧑 **Real-time participants list**  
  - Shows each participant’s name + initials avatar  
  - “Thinking…” vs “Voted” status with a status dot  
  - Right-hand column shows:
    - `…` if they haven’t voted yet  
    - `✅` if they have voted 
  - Summary: **voted / total**, plus **min**, **max**, **average** once votes are revealed

- 🙈 / 👀 **Hidden / revealed voting & header reveal view**  
  - Votes are **hidden by default**  
  - Click **Reveal votes** to:
    - Show a row of full, coloured cards in the **header**, each with:
      - The participant’s **name**
      - Their **vote**
      - A “Points” or “Unsure” label  
    - Preserve the right-hand list as “who has voted” (✅/…) 
  - **Clear for next story** resets:
    - All votes
    - Reveal state
    - Story text
    - The header revealed cards bar

- 🌧️ **Emoji rain (room-wide effect)**  
  - Special emoji card at the end of the deck  
  - When clicked, writes an `emojiRain` event into the current room’s state  
  - Every connected client sees the **same emoji** falling across their screen

- 🔗 **Shareable link**  
  - One-click **Copy share link** button  
  - Includes `?room=ROOM-ID` so participants land directly in your room  
  - Copy button is disabled until you’re actually in a room

⸻

## 🕒 Room Auto-Expiry (TTL)

Planning Poker includes a built-in room TTL (Time-To-Live) system so old rooms automatically disappear from Firebase over time.

How it works

Each room keeps two timestamps:

•	createdAt – when the room was first created

•	updatedAt – last activity (vote, reveal, emoji rain, story change, etc.)

When someone joins a room, the app checks:

```
if (lastActive && (now - lastActive) > ROOM_TTL_MS) {
    // Room expired → delete it
    await remove(ref(db, `rooms/${currentRoomId}`));
}
```

If the room has been inactive longer than the TTL, it is deleted and recreated fresh.

This prevents your Firebase Realtime Database from filling up with stale test rooms.

⸻

Changing the TTL

The TTL is controlled by a single constant in app.js:

```
// How long a room should live without activity before being treated as expired.
// Default: 24 hours
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
```

To change the TTL:

| Desired TTL | Replace with |
|-------------|--------------|
| 1 hour      | `const ROOM_TTL_MS = 60 * 60 * 1000;` |
| 12 hours    | `const ROOM_TTL_MS = 12 * 60 * 60 * 1000;` |
| 2 days      | `const ROOM_TTL_MS = 2 * 24 * 60 * 60 * 1000;` |
| 7 days      | `const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;` |

You can set any time you like — just adjust the multiplier.

⸻

Why rooms are only deleted on join

Firebase has no built-in cron or scheduled jobs without Cloud Functions.

To keep this app serverless, cleanup happens the next time someone tries to join the room.

This method is lightweight, free, and keeps your database tidy automatically.

⸻

## 🧱 Tech stack

- **Frontend:** HTML, CSS, Vanilla JS  
- **Real-time sync:** Firebase Realtime Database  
- **Hosting:** GitHub Pages
- **ES module imports** from the Firebase CDN

Everything runs 100% in the browser.

⸻

## 🚀 Getting started (local)

### 1. Clone the repo

```bash
git clone https://github.com/MonsterMatt87/planning-poker.git
cd planning-poker

```

### 2. Create a Firebase project
	1.	Go to https://console.firebase.google.com
	2.	Create a project (or use an existing one)
	3.	Add a Web App
	4.	Enable Realtime Database
	5.	Copy the database URL (e.g. https://xxxx-default-rtdb.region.firebasedatabase.app)

Make sure your Firebase Realtime Database is in **test mode** (no auth required) or configure rules appropriately for public usage.

### 3. Configure Firebase

At the top of app.js, replace the placeholder config object with your Firebase Web App config:

```
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "YOUR_DB_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

### 4. Serve locally

Because the app uses ES modules, you must run a local server.

```
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000/
```

⸻

## 🌍 Deploying to GitHub Pages

1.	Commit and push everything:

```
git add .
git commit -m "Initial version"
git push origin main
```

2.	In your GitHub repo, go to:

Settings → Pages

3.	Under Build and deployment:

	•	Source: Deploy from a branch

	•	Branch: main

	•	Folder: / (root)

Your public live app will be available at:

👉 https://<YOUR_USERNAME_HERE>.github.io/planning-poker/

⸻

## 🧩 How it works

Each room is stored under:

```
rooms/{ROOM_ID}/
  state/
    reveal: boolean
    story: string
    emojiRain: { emoji, at, by }
    createdAt: timestamp
    updatedAt: timestamp
  participants/
    {clientId}/
      name: string
      vote: string
      joinedAt: timestamp
```

Listening clients subscribe to:

•	state/reveal

•	state/story

•	state/emojiRain (triggers synced emoji rain)

•	participants

Emoji rain sync works by writing:

```
emojiRain: { emoji: "🎉", at: 1710000000000, by: "c_abcd1234" }
```

Every connected tab sees the update and animates the same emoji.

Voting & reveal flow

•	Each participant writes their vote to:

```
rooms/{ROOM_ID}/participants/{clientId}/vote
```

•	While reveal is false:

	•	Right-hand panel shows only … or ✅
	•	Header overlay is hidden
	
•	When someone clicks Reveal votes:
	
	•	state/reveal becomes true

•	Every client:

	•	Computes min, max, avg from numeric votes
	•	Renders header cards showing {name, vote} for everyone who voted

⸻

🌱 Future ideas

•	Custom card sets (T-shirt sizing)
  
•	Dark mode toggle
  
•	Room facilitator controls
  
•	Timer per story
  
•	Export results to a file

⸻

📄 License

MIT License – free to use, modify, and share.

⸻

Enjoy estimating with your team! 🧠🃏

If you extend this further, feel free to fork it or open a PR.
