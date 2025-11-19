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
  - `0` and `?` are neutral (white)

- 🧑‍🤝‍🧑 **Real-time participants list**  
  - Shows each participant’s name + initials avatar  
  - “Thinking…” vs “Voted” status  
  - Summary: **voted / total**, **min**, **max**, **average** (when revealed)

- 🙈 / 👀 **Hidden / revealed voting**  
  - Votes are hidden by default  
  - Click **Reveal votes** to show numbers  
  - **Clear for next story** resets everything

- 🌧️ **Emoji rain (fun room-wide effect)**  
  - Special emoji card at the end of the deck  
  - When clicked, triggers a synced emoji rain animation for **all participants**

- 🔗 **Shareable link**  
  - One-click **Copy share link** button  
  - Includes `?room=ROOM-ID` so participants land directly in your room

⸻

## 🧱 Tech stack

- **Frontend:** HTML, CSS, Vanilla JS  
- **Realtime sync:** Firebase Realtime Database  
- **Hosting:** GitHub Pages  

Everything runs 100% in the browser.

⸻

## 🚀 Getting started (local)

### 1. Clone the repo

```bash
git clone https://github.com/MonsterMatt87/planning-poker.git
cd poker-planning

```

### 2. Create a Firebase project
	1.	Go to https://console.firebase.google.com
	2.	Create a project (or use an existing one)
	3.	Add a Web App
	4.	Enable Realtime Database
	5.	Copy the database URL (e.g. https://xxxx-default-rtdb.region.firebasedatabase.app)

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
