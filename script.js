'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  albumsData: {},
  currentFolder: null,
  currentSongIndex: -1,
  songs: [],
  allSongs: [],          // flat list: {name, folder, albumTitle}
  isPlaying: false,
  isShuffle: false,
  repeatMode: 0,         // 0=off 1=all 2=one
  volume: 0.7,
  isMuted: false,
  likedSongs: new Set(JSON.parse(localStorage.getItem('likedSongs') || '[]')),
  isDraggingProgress: false,
  isDraggingVolume: false,
};

const audio = new Audio();
audio.volume = state.volume;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelector(sel);

const dom = {
  sidebar: $('sidebar'),
  sidebarOverlay: $('sidebarOverlay'),
  closeSidebar: $('closeSidebar'),
  hamburgerBtn: $('hamburgerBtn'),
  cardGrid: $('cardGrid'),
  quickPlayGrid: $('quickPlayGrid'),
  songList: $('songList'),
  greetingText: $('greetingText'),
  playerBar: $('playerBar'),
  playerSongName: $('playerSongName'),
  playerAlbumName: $('playerAlbumName'),
  playerThumb: $('playerThumb'),
  playPauseBtn: $('playPauseBtn'),
  prevBtn: $('prevBtn'),
  nextBtn: $('nextBtn'),
  shuffleBtn: $('shuffleBtn'),
  repeatBtn: $('repeatBtn'),
  likeBtn: $('likeBtn'),
  progressBar: $('progressBar'),
  progressFill: $('progressFill'),
  progressThumb: $('progressThumb'),
  currentTime: $('currentTime'),
  totalTime: $('totalTime'),
  muteBtn: $('muteBtn'),
  volumeBar: $('volumeBar'),
  volumeFill: $('volumeFill'),
  volumeThumb: $('volumeThumb'),
  queueBtn: $('queueBtn'),
  queuePanel: $('queuePanel'),
  queueList: $('queueList'),
  closeQueue: $('closeQueue'),
  searchInput: $('searchInput'),
  searchClear: $('searchClear'),
  searchResults: $('searchResults'),
  searchResultList: $('searchResultList'),
  toast: $('toast'),
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function fmt(sec) {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function displayName(filename) {
  return filename.replace(/\.mp3$/i, '').replaceAll('%20', ' ');
}

let toastTimer;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function saveState() {
  localStorage.setItem('likedSongs', JSON.stringify([...state.likedSongs]));
}

// ─── LOAD DATA ────────────────────────────────────────────────────────────────
async function loadAlbums() {
  try {
    const res = await fetch('./songs-list.json');
    if (!res.ok) throw new Error();
    const data = await res.json();
    data.albums.forEach(a => {
      state.albumsData[a.folder] = { title: a.title, description: a.description, songs: a.songs };
      a.songs.forEach(s => state.allSongs.push({ name: s, folder: a.folder, albumTitle: a.title }));
    });
    return true;
  } catch {
    console.error('Could not load songs-list.json');
    return false;
  }
}

// ─── RENDER ALBUMS ────────────────────────────────────────────────────────────
function renderAlbums() {
  dom.cardGrid.innerHTML = '';
  dom.quickPlayGrid.innerHTML = '';

  Object.entries(state.albumsData).forEach(([folder, info]) => {
    // Main card
    const card = document.createElement('div');
    card.className = 'album-card';
    card.dataset.folder = folder;
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="./songs/${encodeURIComponent(folder)}/cover.jpg" alt="${info.title}"
          onerror="this.parentElement.innerHTML='<div class=\\'card-img-fallback\\'>🎵</div>'">
        <button class="card-play-btn" data-folder="${folder}" aria-label="Play ${info.title}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <div class="card-title">${info.title}</div>
      <div class="card-desc">${info.description}</div>
    `;
    dom.cardGrid.appendChild(card);

    // Quick card (first 6 only)
    if (dom.quickPlayGrid.children.length < 6) {
      const qc = document.createElement('div');
      qc.className = 'quick-card';
      qc.dataset.folder = folder;
      qc.innerHTML = `
        <img class="quick-card-img" src="./songs/${encodeURIComponent(folder)}/cover.jpg" alt="${info.title}"
          onerror="this.outerHTML='<div class=\\'quick-card-img-fallback\\'>🎵</div>'">
        <span class="quick-card-name">${info.title}</span>
        <div class="quick-play">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
      `;
      dom.quickPlayGrid.appendChild(qc);
    }
  });
}

// ─── LOAD SONGS FOR FOLDER ────────────────────────────────────────────────────
function loadFolder(folder) {
  state.currentFolder = folder;
  const info = state.albumsData[folder];
  if (!info) return;
  state.songs = [...info.songs];
  renderSongList();
  renderQueue();
}

function renderSongList() {
  dom.songList.innerHTML = '';
  state.songs.forEach((song, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;
    const name = displayName(song);
    const isActive = state.currentFolder === state.currentFolder && i === state.currentSongIndex;
    if (isActive) li.classList.add('active');
    li.innerHTML = `
      <span class="sl-num">${i + 1}</span>
      <span class="sl-play-indicator">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span>
      <div class="sl-info">
        <div class="sl-name">${name}</div>
        <div class="sl-artist">${state.albumsData[state.currentFolder]?.title || ''}</div>
      </div>
    `;
    dom.songList.appendChild(li);
  });
}

// ─── PLAYBACK ─────────────────────────────────────────────────────────────────
function playSong(folder, index, autoPlay = true) {
  if (folder !== state.currentFolder) loadFolder(folder);
  state.currentFolder = folder;
  state.currentSongIndex = index;

  const song = state.songs[index];
  if (!song) return;

  audio.src = `./songs/${encodeURIComponent(folder)}/${encodeURIComponent(song)}`;
  if (autoPlay) {
    audio.play().catch(e => showToast('Cannot play audio'));
    state.isPlaying = true;
  }

  updatePlayerUI();
  renderSongList();
  renderQueue();
  highlightActive();
}

function updatePlayerUI() {
  const song = state.songs[state.currentSongIndex];
  if (!song) return;

  const name = displayName(song);
  const albumTitle = state.albumsData[state.currentFolder]?.title || '';

  dom.playerSongName.textContent = name;
  dom.playerAlbumName.textContent = albumTitle;

  // Thumb image
  dom.playerThumb.innerHTML = `<img src="./songs/${encodeURIComponent(state.currentFolder)}/cover.jpg" alt="${albumTitle}"
    onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\'/></svg>'">`;

  // Like button
  const likeId = `${state.currentFolder}::${song}`;
  dom.likeBtn.classList.toggle('liked', state.likedSongs.has(likeId));

  updatePlayPauseUI();
}

function updatePlayPauseUI() {
  const playIcon = dom.playPauseBtn.querySelector('.play-icon');
  const pauseIcon = dom.playPauseBtn.querySelector('.pause-icon');
  if (state.isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = '';
  } else {
    playIcon.style.display = '';
    pauseIcon.style.display = 'none';
  }
}

function togglePlay() {
  if (state.currentSongIndex === -1) {
    const first = Object.keys(state.albumsData)[0];
    if (first) playSong(first, 0);
    return;
  }
  if (audio.paused) {
    audio.play().catch(() => {});
    state.isPlaying = true;
  } else {
    audio.pause();
    state.isPlaying = false;
  }
  updatePlayPauseUI();
}

function playNext() {
  if (state.repeatMode === 2) { audio.currentTime = 0; audio.play(); return; }
  let next = state.currentSongIndex + 1;
  if (state.isShuffle) next = Math.floor(Math.random() * state.songs.length);
  if (next >= state.songs.length) {
    if (state.repeatMode === 1) next = 0;
    else { audio.pause(); state.isPlaying = false; updatePlayPauseUI(); return; }
  }
  playSong(state.currentFolder, next);
}

function playPrev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let prev = state.currentSongIndex - 1;
  if (prev < 0) prev = state.repeatMode === 1 ? state.songs.length - 1 : 0;
  playSong(state.currentFolder, prev);
}

// ─── QUEUE ────────────────────────────────────────────────────────────────────
function renderQueue() {
  dom.queueList.innerHTML = '';
  state.songs.forEach((song, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;
    if (i === state.currentSongIndex) li.classList.add('now-playing');
    const name = displayName(song);
    li.innerHTML = `
      <span class="q-num">${i + 1}</span>
      <div class="q-info">
        <div class="q-name">${name}</div>
        <div class="q-album">${state.albumsData[state.currentFolder]?.title || ''}</div>
      </div>
    `;
    li.addEventListener('click', () => { playSong(state.currentFolder, i); dom.queuePanel.classList.remove('open'); });
    dom.queueList.appendChild(li);
  });
}

function toggleQueue() {
  dom.queuePanel.classList.toggle('open');
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
function setProgress(clientX) {
  const rect = dom.progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  audio.currentTime = pct * (audio.duration || 0);
  updateProgress(pct);
}

function updateProgress(pct) {
  dom.progressFill.style.width = `${pct * 100}%`;
  dom.progressThumb.style.left = `${pct * 100}%`;
  dom.progressThumb.style.right = 'auto';
}

audio.addEventListener('timeupdate', () => {
  if (state.isDraggingProgress || !audio.duration) return;
  const pct = audio.currentTime / audio.duration;
  updateProgress(pct);
  dom.currentTime.textContent = fmt(audio.currentTime);
  dom.totalTime.textContent = fmt(audio.duration);
});

audio.addEventListener('ended', playNext);
audio.addEventListener('play', () => { state.isPlaying = true; updatePlayPauseUI(); });
audio.addEventListener('pause', () => { state.isPlaying = false; updatePlayPauseUI(); });
audio.addEventListener('loadedmetadata', () => {
  dom.totalTime.textContent = fmt(audio.duration);
});

// Click
dom.progressBar.addEventListener('click', e => setProgress(e.clientX));

// Drag
dom.progressBar.addEventListener('mousedown', e => {
  state.isDraggingProgress = true;
  setProgress(e.clientX);
});
document.addEventListener('mousemove', e => {
  if (state.isDraggingProgress) setProgress(e.clientX);
});
document.addEventListener('mouseup', () => { state.isDraggingProgress = false; });

// Touch
dom.progressBar.addEventListener('touchstart', e => { state.isDraggingProgress = true; setProgress(e.touches[0].clientX); }, { passive: true });
document.addEventListener('touchmove', e => { if (state.isDraggingProgress) setProgress(e.touches[0].clientX); }, { passive: true });
document.addEventListener('touchend', () => { state.isDraggingProgress = false; });

// ─── VOLUME ───────────────────────────────────────────────────────────────────
function setVolume(clientX) {
  const rect = dom.volumeBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  state.volume = pct;
  audio.volume = pct;
  state.isMuted = pct === 0;
  updateVolumeUI(pct);
}

function updateVolumeUI(pct) {
  dom.volumeFill.style.width = `${pct * 100}%`;
  dom.volumeThumb.style.left = `${pct * 100}%`;
  dom.volumeThumb.style.right = 'auto';
  const volIcon = dom.muteBtn.querySelector('.vol-icon');
  const muteIcon = dom.muteBtn.querySelector('.mute-icon');
  if (pct === 0) { volIcon.style.display = 'none'; muteIcon.style.display = ''; }
  else { volIcon.style.display = ''; muteIcon.style.display = 'none'; }
}

dom.volumeBar.addEventListener('click', e => setVolume(e.clientX));
dom.volumeBar.addEventListener('mousedown', e => { state.isDraggingVolume = true; setVolume(e.clientX); });
document.addEventListener('mousemove', e => { if (state.isDraggingVolume) setVolume(e.clientX); });
document.addEventListener('mouseup', () => { state.isDraggingVolume = false; });
dom.volumeBar.addEventListener('touchstart', e => { state.isDraggingVolume = true; setVolume(e.touches[0].clientX); }, { passive: true });
document.addEventListener('touchmove', e => { if (state.isDraggingVolume) setVolume(e.touches[0].clientX); }, { passive: true });
document.addEventListener('touchend', () => { state.isDraggingVolume = false; });

// Initial volume
updateVolumeUI(state.volume);

dom.muteBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  audio.muted = state.isMuted;
  updateVolumeUI(state.isMuted ? 0 : state.volume);
});

// ─── SHUFFLE & REPEAT ─────────────────────────────────────────────────────────
dom.shuffleBtn.addEventListener('click', () => {
  state.isShuffle = !state.isShuffle;
  dom.shuffleBtn.classList.toggle('active', state.isShuffle);
  showToast(state.isShuffle ? 'Shuffle on' : 'Shuffle off');
});

dom.repeatBtn.addEventListener('click', () => {
  state.repeatMode = (state.repeatMode + 1) % 3;
  dom.repeatBtn.classList.toggle('active', state.repeatMode > 0);
  const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
  showToast(labels[state.repeatMode]);
  if (state.repeatMode === 2) {
    dom.repeatBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="14" text-anchor="middle" font-size="8" fill="currentColor" stroke="none">1</text></svg>`;
  } else {
    dom.repeatBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  }
});

// ─── LIKE BUTTON ─────────────────────────────────────────────────────────────
dom.likeBtn.addEventListener('click', () => {
  const song = state.songs[state.currentSongIndex];
  if (!song) return;
  const likeId = `${state.currentFolder}::${song}`;
  if (state.likedSongs.has(likeId)) {
    state.likedSongs.delete(likeId);
    dom.likeBtn.classList.remove('liked');
    showToast('Removed from Liked Songs');
  } else {
    state.likedSongs.add(likeId);
    dom.likeBtn.classList.add('liked');
    showToast('Added to Liked Songs ❤️');
  }
  saveState();
});

// ─── PLAY/PAUSE/PREV/NEXT ─────────────────────────────────────────────────────
dom.playPauseBtn.addEventListener('click', togglePlay);
dom.prevBtn.addEventListener('click', playPrev);
dom.nextBtn.addEventListener('click', playNext);

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  switch (e.code) {
    case 'Space': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': e.preventDefault(); audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); break;
    case 'ArrowLeft': e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 10); break;
    case 'ArrowUp': e.preventDefault(); state.volume = Math.min(1, state.volume + 0.1); audio.volume = state.volume; updateVolumeUI(state.volume); break;
    case 'ArrowDown': e.preventDefault(); state.volume = Math.max(0, state.volume - 0.1); audio.volume = state.volume; updateVolumeUI(state.volume); break;
    case 'KeyN': e.preventDefault(); playNext(); break;
    case 'KeyP': e.preventDefault(); playPrev(); break;
    case 'KeyM': e.preventDefault(); dom.muteBtn.click(); break;
    case 'KeyS': e.preventDefault(); dom.shuffleBtn.click(); break;
  }
});

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function openSidebar() {
  dom.sidebar.classList.add('open');
  dom.sidebarOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  dom.sidebar.classList.remove('open');
  dom.sidebarOverlay.classList.remove('active');
  document.body.style.overflow = '';
}
dom.hamburgerBtn.addEventListener('click', openSidebar);
dom.closeSidebar.addEventListener('click', closeSidebar);
dom.sidebarOverlay.addEventListener('click', closeSidebar);

// ─── SEARCH ───────────────────────────────────────────────────────────────────
let searchTimeout;
dom.searchInput.addEventListener('input', () => {
  const q = dom.searchInput.value.trim();
  dom.searchClear.classList.toggle('visible', q.length > 0);
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => handleSearch(q), 200);
});

dom.searchClear.addEventListener('click', () => {
  dom.searchInput.value = '';
  dom.searchClear.classList.remove('visible');
  handleSearch('');
  dom.searchInput.focus();
});

function handleSearch(q) {
  if (!q) {
    dom.searchResults.style.display = 'none';
    document.querySelector('.greeting-section').style.display = '';
    document.querySelector('.albums-section').style.display = '';
    return;
  }
  document.querySelector('.greeting-section').style.display = 'none';
  document.querySelector('.albums-section').style.display = 'none';
  dom.searchResults.style.display = '';

  const lq = q.toLowerCase();
  const results = state.allSongs.filter(s =>
    displayName(s.name).toLowerCase().includes(lq) ||
    s.albumTitle.toLowerCase().includes(lq)
  );

  dom.searchResultList.innerHTML = '';
  if (!results.length) {
    dom.searchResultList.innerHTML = '<li style="padding:16px 12px;color:#b3b3b3">No results found</li>';
    return;
  }
  results.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="sr-num">${i + 1}</span>
      <div class="sr-info">
        <div class="sr-name">${displayName(item.name)}</div>
        <div class="sr-album">${item.albumTitle}</div>
      </div>
      <div class="sr-play">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    `;
    li.addEventListener('click', () => {
      loadFolder(item.folder);
      const idx = state.songs.indexOf(item.name);
      playSong(item.folder, idx >= 0 ? idx : 0);
    });
    dom.searchResultList.appendChild(li);
  });
}

// ─── CLICK HANDLERS ───────────────────────────────────────────────────────────
// Album card click
document.addEventListener('click', e => {
  // Card play button
  const cardPlayBtn = e.target.closest('.card-play-btn');
  if (cardPlayBtn) {
    e.stopPropagation();
    const folder = cardPlayBtn.dataset.folder;
    loadFolder(folder);
    playSong(folder, 0);
    return;
  }

  // Album card
  const albumCard = e.target.closest('.album-card');
  if (albumCard) {
    const folder = albumCard.dataset.folder;
    loadFolder(folder);
    renderSongList();
    // Open sidebar on mobile to show songs
    if (window.innerWidth <= 768) openSidebar();
    return;
  }

  // Quick card
  const quickCard = e.target.closest('.quick-card');
  if (quickCard) {
    const folder = quickCard.dataset.folder;
    loadFolder(folder);
    playSong(folder, 0);
    return;
  }

  // Song list item
  const songLi = e.target.closest('#songList li');
  if (songLi) {
    const idx = parseInt(songLi.dataset.index);
    playSong(state.currentFolder, idx);
    if (window.innerWidth <= 768) closeSidebar();
    return;
  }
});

// Queue
dom.queueBtn.addEventListener('click', toggleQueue);
dom.closeQueue.addEventListener('click', () => dom.queuePanel.classList.remove('open'));

// Close queue when clicking outside
document.addEventListener('click', e => {
  if (!dom.queuePanel.contains(e.target) && !dom.queueBtn.contains(e.target)) {
    dom.queuePanel.classList.remove('open');
  }
});

// ─── HIGHLIGHT ACTIVE ─────────────────────────────────────────────────────────
function highlightActive() {
  document.querySelectorAll('#songList li').forEach((li, i) => {
    li.classList.toggle('active', i === state.currentSongIndex);
  });
}

// ─── GREETING ────────────────────────────────────────────────────────────────
dom.greetingText.textContent = getGreeting();

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  const ok = await loadAlbums();
  if (!ok) {
    dom.cardGrid.innerHTML = '<p style="color:#b3b3b3;padding:20px">Could not load songs-list.json. Make sure the file exists.</p>';
    return;
  }

  renderAlbums();

  // Load first album in sidebar
  const firstFolder = Object.keys(state.albumsData)[0];
  if (firstFolder) {
    loadFolder(firstFolder);
    playSong(firstFolder, 0, false); // load but don't autoplay
  }
}

init();
