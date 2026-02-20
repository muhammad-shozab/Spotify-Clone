# 🎵 Spotify Web Player Clone

A fully responsive, feature-rich Spotify Web Player clone built with **pure HTML, CSS, and vanilla JavaScript** — no frameworks, no dependencies, no build tools. Just open `index.html` and play your local music library.

<img width="1365" height="767" alt="image" src="https://github.com/user-attachments/assets/60f12adb-2f08-4fb3-a4c0-f572232b51c3" />

---

## 📸 Screenshots

### 🖥️ Desktop View
<img width="1365" height="767" alt="image" src="https://github.com/user-attachments/assets/a0574910-3cbc-45b0-8b0f-3f851153c52c" />

### 📱 Mobile View
<img width="1365" height="767" alt="image" src="https://github.com/user-attachments/assets/81ac6528-43b9-4d5a-9bec-2c12a38eca51" />

### 🔍 Search in Action
<img width="1365" height="767" alt="image" src="https://github.com/user-attachments/assets/13b6f0ac-7bdd-4679-9c27-3cba58917496" />

### 🎵 Now Playing
<img width="1359" height="767" alt="image" src="https://github.com/user-attachments/assets/8adf88ad-e26c-4888-a9d0-458e45d8527e" />

---

## ✨ Features

### 🎧 Music Playback
- Play, pause, skip next / previous
- Shuffle mode — randomizes playback order
- Repeat modes — Off → Repeat All → Repeat One
- Seek bar with click & drag support (mouse and touch)
- Keyboard scrubbing (←/→ Arrow keys jump ±10 seconds)
- Auto-advance to next track on song end

### 🔊 Volume Control
- Drag or click volume bar to set level
- Mute / unmute toggle button
- Keyboard volume control (↑/↓ Arrow keys)

### 🔎 Dual Search System
- **Top search bar** — searches all songs and albums, shows full results page
- **Sidebar search morph** — the nav "Search" button animates into an inline search field in place, with live dropdown results
- Both search bars filter by song name and album title in real time

### 📚 Library & Queue
- Sidebar song list — browse and click any track in the current album
- Queue panel — floating panel shows the full tracklist with "now playing" highlight
- Active song highlighted in green throughout the UI

### ❤️ Liked Songs
- Like/unlike any song with the heart button
- Liked songs persist across sessions using `localStorage`

### 📱 Full Responsiveness
| Breakpoint | Layout |
|---|---|
| > 1280px | Full sidebar + 3-column player |
| 1024px | Compressed sidebar + controls |
| 768px | Off-canvas drawer sidebar + hamburger menu |
| 540px | 3-row stacked mobile player |
| 360px | Ultra-compact, thumbnail hidden |

### 🎹 Keyboard Shortcuts
| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` / `→` | Seek ±10 seconds |
| `↑` / `↓` | Volume ±10% |
| `N` | Next track |
| `P` | Previous track |
| `M` | Mute / Unmute |
| `S` | Toggle Shuffle |

---

## 🗂️ Project Structure

```
spotify-clone/
│
├── index.html              # App shell & all markup
├── style.css               # All styles (tokens, layout, components, responsive)
├── script.js               # All logic (state, playback, search, UI)
├── songs-list.json         # Album & song metadata (you create this)
│
└── songs/                  # Your music library
    ├── Album Name 1/
    │   ├── cover.jpg       # Album artwork (square recommended)
    │   ├── song1.mp3
    │   └── song2.mp3
    └── Album Name 2/
        ├── cover.jpg
        └── song1.mp3
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/spotify-clone.git
cd spotify-clone
```

### 2. Add Your Music

Create a `songs/` directory and add your albums as subfolders. Each folder needs:
- A `cover.jpg` (album artwork)
- Your `.mp3` files

```
songs/
├── Chill Vibes/
│   ├── cover.jpg
│   ├── Sunset Drive.mp3
│   └── Ocean Waves.mp3
└── Lo-Fi Beats/
    ├── cover.jpg
    └── Coffee Shop.mp3
```

### 3. Create `songs-list.json`

This file tells the player what albums and songs exist. Create it in the root directory:

```json
{
  "albums": [
    {
      "folder": "Chill Vibes",
      "title": "Chill Vibes",
      "description": "Relaxing tunes for any time of day",
      "songs": [
        "Sunset Drive.mp3",
        "Ocean Waves.mp3"
      ]
    },
    {
      "folder": "Lo-Fi Beats",
      "title": "Lo-Fi Beats",
      "description": "Perfect background music for focus",
      "songs": [
        "Coffee Shop.mp3"
      ]
    }
  ]
}
```

> ⚠️ **Important:** The `"folder"` value must exactly match the folder name inside `songs/`. Song names must also exactly match the `.mp3` filenames.

### 4. Serve the App

Because the app fetches `songs-list.json` via `fetch()`, you need a local server (not `file://`).

**Option A — Python (built-in, no install needed):**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```
Then open [http://localhost:8000](http://localhost:8000)

**Option B — Node.js (`npx`):**
```bash
npx serve .
```

**Option C — VS Code Live Server:**
Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer), right-click `index.html` → **Open with Live Server**.

---

## ⚙️ Configuration

### Album Artwork
- Format: `.jpg` or `.png`
- Filename: must be named `cover.jpg` (or update the src path in `script.js`)
- Size: square aspect ratio recommended (e.g. 500×500px)
- If no cover is found, a 🎵 fallback emoji is shown automatically

### Song Names in the UI
Song filenames are cleaned up automatically for display:
- `.mp3` extension is stripped
- `%20` (URL encoding) is replaced with spaces

So `My%20Song.mp3` displays as **My Song** in the player.

---

## 🧩 How It Works

### State Management
All app state lives in a single `state` object:
```javascript
const state = {
  albumsData,      // All album metadata from JSON
  currentFolder,   // Active album folder name
  currentIdx,      // Index of playing song in songs[]
  songs,           // Songs array for current album
  allSongs,        // Flat list of every song (for search)
  isPlaying,
  isShuffle,
  repeatMode,      // 0 = off, 1 = all, 2 = one
  volume,
  isMuted,
  liked,           // Set of liked song IDs (persisted to localStorage)
  dragging,        // Progress/volume drag state flags
};
```

### Search Architecture
The top search bar and sidebar search are independent systems sharing the same `state.allSongs` array. Both filter by song name and album title using a 180–200ms debounce to avoid layout thrash while typing.

The sidebar search uses a **CSS morph animation** — the "Search" nav button and the input field occupy the exact same DOM position and cross-fade with a `translateY` transition, creating the illusion that the button transforms into an input field.

### Responsive Player Layout
On screens ≤ 540px, the seek bar is physically **re-parented in the DOM** from `.prow-controls` into `.prow-volume` using JavaScript, allowing the 3-row mobile player layout to work without duplicating HTML. This is handled by `repositionSeek()` which listens to `window.resize`.

---

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| **HTML5** | Semantic markup, `<audio>` API |
| **CSS3** | Custom properties, Grid, Flexbox, animations |
| **Vanilla JavaScript (ES2020)** | All interactivity, state, DOM manipulation |
| **Web Audio API** | `new Audio()` for playback |
| **localStorage** | Persisting liked songs |
| **Google Fonts** | DM Sans typeface |
| **Fetch API** | Loading `songs-list.json` |

Zero npm packages. Zero build steps. Zero frameworks.

---

## 🐛 Troubleshooting

### Songs not loading
- Make sure you're running a local server, not opening `index.html` directly in the browser
- Check that folder names in `songs-list.json` exactly match the folder names in `songs/`
- Check the browser console (F12) for 404 errors

### Cover art not showing
- Ensure the file is named `cover.jpg` (lowercase) inside the album folder
- The app will show a 🎵 emoji fallback automatically if the image fails

### Search results not appearing
- This was a known bug (now fixed) — ensure you're using the latest `script.js`
- The fix was changing `D.searchResults.style.display = ''` to `'block'`

### Audio won't play
- Browsers block autoplay on first load — click anything to interact with the page first
- Check that your `.mp3` files are not corrupted
- Ensure filenames in `songs-list.json` match exactly (case-sensitive on Linux/Mac)

---

## 🚧 Roadmap / Possible Improvements

- [ ] Drag-to-reorder queue
- [ ] Playlist creation and management
- [ ] Equalizer / audio visualizer
- [ ] Last.fm scrobbling integration
- [ ] PWA support (offline + installable)
- [ ] Dark/light theme toggle
- [ ] Album sort / filter options
- [ ] Cross-fade between tracks

---

## 📄 License

This project is for **educational and personal use only**. Spotify™ is a trademark of Spotify AB. This project is not affiliated with, endorsed by, or connected to Spotify in any way.

All music you add to this player must be content you own or have rights to use.

---

## 🙌 Acknowledgements

- UI design inspired by [Spotify Web Player](https://open.spotify.com)
- Icons: inline SVG (no external icon library needed)
- Font: [DM Sans](https://fonts.google.com/specimen/DM+Sans) via Google Fonts

---

<p align="center">Made with ❤️ and dedication</p>

