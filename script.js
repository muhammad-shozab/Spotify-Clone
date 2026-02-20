'use strict';

// ─── STATE ───────────────────────────────────────────────────
const state = {
  albumsData: {},
  currentFolder: null,
  currentSongIndex: -1,
  songs: [],
  allSongs: [],
  isPlaying: false,
  isShuffle: false,
  repeatMode: 0,      // 0=off 1=all 2=one
  volume: 0.7,
  isMuted: false,
  likedSongs: new Set(JSON.parse(localStorage.getItem('likedSongs') || '[]')),
  isDraggingProgress: false,
  isDraggingVolume: false,
  isDraggingMobileVol: false,
};

const audio = new Audio();
audio.volume = state.volume;

// ─── DOM ─────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = s  => document.querySelector(s);

const dom = {
  // Layout
  sidebar:          $('sidebar'),
  sidebarOverlay:   $('sidebarOverlay'),
  closeSidebar:     $('closeSidebar'),
  hamburgerBtn:     $('hamburgerBtn'),

  // Sidebar search
  navSearchToggle:  $('navSearchToggle'),
  sidebarSearchBar: $('sidebarSearchBar'),
  sidebarSearchInput: $('sidebarSearchInput'),
  ssbClear:         $('ssbClear'),
  ssbResults:       $('ssbResults'),

  // Content
  cardGrid:         $('cardGrid'),
  quickPlayGrid:    $('quickPlayGrid'),
  songList:         $('songList'),
  greetingText:     $('greetingText'),

  // Top search
  searchInput:      $('searchInput'),
  searchClear:      $('searchClear'),
  searchResults:    $('searchResults'),
  searchResultList: $('searchResultList'),

  // Player
  playerSongName:   $('playerSongName'),
  playerAlbumName:  $('playerAlbumName'),
  playerThumb:      $('playerThumb'),
  playPauseBtn:     $('playPauseBtn'),
  prevBtn:          $('prevBtn'),
  nextBtn:          $('nextBtn'),
  shuffleBtn:       $('shuffleBtn'),
  repeatBtn:        $('repeatBtn'),
  likeBtn:          $('likeBtn'),
  progressBar:      $('progressBar'),
  progressFill:     $('progressFill'),
  progressThumb:    $('progressThumb'),
  currentTime:      $('currentTime'),
  totalTime:        $('totalTime'),

  // Desktop volume
  muteBtn:          $('muteBtn'),
  volumeBar:        $('volumeBar'),
  volumeFill:       $('volumeFill'),
  volumeThumb:      $('volumeThumb'),

  // Queue
  queueBtn:         $('queueBtn'),
  queuePanel:       $('queuePanel'),
  queueList:        $('queueList'),
  closeQueue:       $('closeQueue'),

  // Mobile extras
  shuffleBtnM:      $('shuffleBtnM'),
  repeatBtnM:       $('repeatBtnM'),
  muteBtnM:         $('muteBtnM'),
  mobileVolBar:     $('mobileVolBar'),
  mobileVolFill:    $('mobileVolFill'),
  mobileVolThumb:   $('mobileVolThumb'),

  // Toast
  toast:            $('toast'),
};

// ─── UTILS ───────────────────────────────────────────────────
function fmt(s) {
  if (isNaN(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}
function displayName(f) {
  return f.replace(/\.mp3$/i,'').replaceAll('%20',' ');
}
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning ☀️' : h < 18 ? 'Good Afternoon 🎵' : 'Good Evening 🌙';
}

let toastTimer;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

// ─── LOAD DATA ────────────────────────────────────────────────
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
    return false;
  }
}

// ─── RENDER ALBUMS ────────────────────────────────────────────
function renderAlbums() {
  dom.cardGrid.innerHTML = '';
  dom.quickPlayGrid.innerHTML = '';

  Object.entries(state.albumsData).forEach(([folder, info]) => {
    // Main grid card
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
      <div class="card-body">
        <div class="card-title">${info.title}</div>
        <div class="card-desc">${info.description}</div>
      </div>`;
    dom.cardGrid.appendChild(card);

    // Quick play grid (first 6)
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
        </div>`;
      dom.quickPlayGrid.appendChild(qc);
    }
  });
}

// ─── LOAD FOLDER SONGS ────────────────────────────────────────
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
    if (i === state.currentSongIndex) li.classList.add('active');
    li.innerHTML = `
      <span class="sl-num">${i + 1}</span>
      <span class="sl-play-indicator">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span>
      <div class="sl-info">
        <div class="sl-name">${displayName(song)}</div>
        <div class="sl-artist">${state.albumsData[state.currentFolder]?.title || ''}</div>
      </div>`;
    dom.songList.appendChild(li);
  });
}

// ─── PLAYBACK ─────────────────────────────────────────────────
function playSong(folder, index, autoPlay = true) {
  if (folder !== state.currentFolder) loadFolder(folder);
  state.currentSongIndex = index;
  const song = state.songs[index];
  if (!song) return;

  audio.src = `./songs/${encodeURIComponent(folder)}/${encodeURIComponent(song)}`;
  if (autoPlay) {
    audio.play().catch(() => showToast('Cannot play audio'));
    state.isPlaying = true;
  }
  updatePlayerUI();
  renderSongList();
  renderQueue();
}

function updatePlayerUI() {
  const song = state.songs[state.currentSongIndex];
  if (!song) return;
  const name      = displayName(song);
  const albumTitle = state.albumsData[state.currentFolder]?.title || '';

  dom.playerSongName.textContent  = name;
  dom.playerAlbumName.textContent = albumTitle;
  dom.playerThumb.innerHTML = `<img src="./songs/${encodeURIComponent(state.currentFolder)}/cover.jpg" alt="${albumTitle}"
    onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\'/></svg>'">`;

  const likeId = `${state.currentFolder}::${song}`;
  dom.likeBtn.classList.toggle('liked', state.likedSongs.has(likeId));
  updatePlayPauseUI();
}

function updatePlayPauseUI() {
  const pi = dom.playPauseBtn.querySelector('.play-icon');
  const pa = dom.playPauseBtn.querySelector('.pause-icon');
  pi.style.display = state.isPlaying ? 'none' : '';
  pa.style.display = state.isPlaying ? '' : 'none';
}

function togglePlay() {
  if (state.currentSongIndex === -1) {
    const first = Object.keys(state.albumsData)[0];
    if (first) playSong(first, 0);
    return;
  }
  if (audio.paused) { audio.play().catch(()=>{}); state.isPlaying = true; }
  else              { audio.pause(); state.isPlaying = false; }
  updatePlayPauseUI();
}

function playNext() {
  if (state.repeatMode === 2) { audio.currentTime = 0; audio.play(); return; }
  let next = state.isShuffle
    ? Math.floor(Math.random() * state.songs.length)
    : state.currentSongIndex + 1;
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

// ─── QUEUE ────────────────────────────────────────────────────
function renderQueue() {
  dom.queueList.innerHTML = '';
  state.songs.forEach((song, i) => {
    const li = document.createElement('li');
    if (i === state.currentSongIndex) li.classList.add('now-playing');
    li.innerHTML = `
      <span class="q-num">${i + 1}</span>
      <div class="q-info">
        <div class="q-name">${displayName(song)}</div>
        <div class="q-album">${state.albumsData[state.currentFolder]?.title || ''}</div>
      </div>`;
    li.addEventListener('click', () => {
      playSong(state.currentFolder, i);
      dom.queuePanel.classList.remove('open');
    });
    dom.queueList.appendChild(li);
  });
}

// ─── PROGRESS ────────────────────────────────────────────────
function setProgress(clientX) {
  const rect = dom.progressBar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  if (audio.duration) audio.currentTime = pct * audio.duration;
  applyProgress(pct);
}
function applyProgress(pct) {
  dom.progressFill.style.width  = `${pct * 100}%`;
  dom.progressThumb.style.left  = `${pct * 100}%`;
}

audio.addEventListener('timeupdate', () => {
  if (state.isDraggingProgress || !audio.duration) return;
  const pct = audio.currentTime / audio.duration;
  applyProgress(pct);
  dom.currentTime.textContent = fmt(audio.currentTime);
  dom.totalTime.textContent   = fmt(audio.duration);
});
audio.addEventListener('loadedmetadata', () => { dom.totalTime.textContent = fmt(audio.duration); });
audio.addEventListener('ended',  playNext);
audio.addEventListener('play',   () => { state.isPlaying = true;  updatePlayPauseUI(); });
audio.addEventListener('pause',  () => { state.isPlaying = false; updatePlayPauseUI(); });

// Progress interactions
dom.progressBar.addEventListener('click',      e => setProgress(e.clientX));
dom.progressBar.addEventListener('mousedown',  e => { state.isDraggingProgress = true; setProgress(e.clientX); });
document.addEventListener('mousemove',  e => { if (state.isDraggingProgress) setProgress(e.clientX); });
document.addEventListener('mouseup',    ()  => { state.isDraggingProgress = false; });
dom.progressBar.addEventListener('touchstart', e => { state.isDraggingProgress = true; setProgress(e.touches[0].clientX); }, {passive:true});
document.addEventListener('touchmove',  e => { if (state.isDraggingProgress) setProgress(e.touches[0].clientX); }, {passive:true});
document.addEventListener('touchend',   ()  => { state.isDraggingProgress = false; });

// ─── VOLUME (shared helper) ───────────────────────────────────
function applyVolume(pct) {
  state.volume = pct;
  audio.volume = pct;
  state.isMuted = pct === 0;

  // Desktop
  dom.volumeFill.style.width  = `${pct * 100}%`;
  dom.volumeThumb.style.left  = `${pct * 100}%`;
  const vi = dom.muteBtn.querySelector('.vol-icon');
  const mi = dom.muteBtn.querySelector('.mute-icon');
  if (vi && mi) { vi.style.display = pct === 0 ? 'none' : ''; mi.style.display = pct === 0 ? '' : 'none'; }

  // Mobile
  dom.mobileVolFill.style.width  = `${pct * 100}%`;
  dom.mobileVolThumb.style.left  = `${pct * 100}%`;
  const vim = dom.muteBtnM.querySelector('.vol-icon-m');
  const mim = dom.muteBtnM.querySelector('.mute-icon-m');
  if (vim && mim) { vim.style.display = pct === 0 ? 'none' : ''; mim.style.display = pct === 0 ? '' : 'none'; }
}

function setVolumeFromBar(clientX, barEl) {
  const rect = barEl.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  applyVolume(pct);
}

// Desktop volume
dom.volumeBar.addEventListener('click',     e => setVolumeFromBar(e.clientX, dom.volumeBar));
dom.volumeBar.addEventListener('mousedown', e => { state.isDraggingVolume = true; setVolumeFromBar(e.clientX, dom.volumeBar); });
document.addEventListener('mousemove',  e => { if (state.isDraggingVolume)      setVolumeFromBar(e.clientX, dom.volumeBar); });
document.addEventListener('mouseup',    ()  => { state.isDraggingVolume = false; });
dom.volumeBar.addEventListener('touchstart', e => { state.isDraggingVolume = true; setVolumeFromBar(e.touches[0].clientX, dom.volumeBar); }, {passive:true});
document.addEventListener('touchmove',  e => { if (state.isDraggingVolume)      setVolumeFromBar(e.touches[0].clientX, dom.volumeBar); }, {passive:true});
document.addEventListener('touchend',   ()  => { state.isDraggingVolume = false; });

dom.muteBtn.addEventListener('click', () => {
  if (state.isMuted) { applyVolume(state.volume || 0.7); }
  else               { applyVolume(0); }
});

// Mobile volume
dom.mobileVolBar.addEventListener('click',     e => setVolumeFromBar(e.clientX, dom.mobileVolBar));
dom.mobileVolBar.addEventListener('mousedown', e => { state.isDraggingMobileVol = true; setVolumeFromBar(e.clientX, dom.mobileVolBar); });
document.addEventListener('mousemove',  e => { if (state.isDraggingMobileVol) setVolumeFromBar(e.clientX, dom.mobileVolBar); });
document.addEventListener('mouseup',    ()  => { state.isDraggingMobileVol = false; });
dom.mobileVolBar.addEventListener('touchstart', e => { state.isDraggingMobileVol = true; setVolumeFromBar(e.touches[0].clientX, dom.mobileVolBar); }, {passive:true});
document.addEventListener('touchmove',  e => { if (state.isDraggingMobileVol) setVolumeFromBar(e.touches[0].clientX, dom.mobileVolBar); }, {passive:true});
document.addEventListener('touchend',   ()  => { state.isDraggingMobileVol = false; });

dom.muteBtnM.addEventListener('click', () => {
  if (state.isMuted) { applyVolume(state.volume || 0.7); }
  else               { applyVolume(0); }
});

// Initialise volume UI
applyVolume(state.volume);

// ─── SHUFFLE & REPEAT ─────────────────────────────────────────
function setShuffle(on) {
  state.isShuffle = on;
  dom.shuffleBtn.classList.toggle('active', on);
  dom.shuffleBtnM.classList.toggle('active', on);
  showToast(on ? 'Shuffle on 🔀' : 'Shuffle off');
}
function cycleRepeat() {
  state.repeatMode = (state.repeatMode + 1) % 3;
  const svgRepeat = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  const svgRepeat1 = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="14" text-anchor="middle" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="bold">1</text></svg>`;
  const active = state.repeatMode > 0;
  dom.repeatBtn.classList.toggle('active', active);
  dom.repeatBtnM.classList.toggle('active', active);
  const svg = state.repeatMode === 2 ? svgRepeat1 : svgRepeat;
  dom.repeatBtn.innerHTML  = svg;
  dom.repeatBtnM.innerHTML = svg;
  const labels = ['Repeat off', 'Repeat all 🔁', 'Repeat one 🔂'];
  showToast(labels[state.repeatMode]);
}

dom.shuffleBtn.addEventListener('click', () => setShuffle(!state.isShuffle));
dom.shuffleBtnM.addEventListener('click', () => setShuffle(!state.isShuffle));
dom.repeatBtn.addEventListener('click', cycleRepeat);
dom.repeatBtnM.addEventListener('click', cycleRepeat);

// ─── LIKE ─────────────────────────────────────────────────────
dom.likeBtn.addEventListener('click', () => {
  const song = state.songs[state.currentSongIndex];
  if (!song) return;
  const id = `${state.currentFolder}::${song}`;
  if (state.likedSongs.has(id)) {
    state.likedSongs.delete(id);
    dom.likeBtn.classList.remove('liked');
    showToast('Removed from Liked Songs');
  } else {
    state.likedSongs.add(id);
    dom.likeBtn.classList.add('liked');
    showToast('Added to Liked Songs ❤️');
  }
  localStorage.setItem('likedSongs', JSON.stringify([...state.likedSongs]));
});

// ─── PLAYBACK CONTROLS ────────────────────────────────────────
dom.playPauseBtn.addEventListener('click', togglePlay);
dom.prevBtn.addEventListener('click', playPrev);
dom.nextBtn.addEventListener('click', playNext);

// ─── KEYBOARD ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': e.preventDefault(); audio.currentTime = Math.min(audio.duration||0, audio.currentTime+10); break;
    case 'ArrowLeft':  e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime-10); break;
    case 'ArrowUp':    e.preventDefault(); applyVolume(Math.min(1, state.volume+0.1)); break;
    case 'ArrowDown':  e.preventDefault(); applyVolume(Math.max(0, state.volume-0.1)); break;
    case 'KeyN':       e.preventDefault(); playNext(); break;
    case 'KeyP':       e.preventDefault(); playPrev(); break;
    case 'KeyM':       e.preventDefault(); dom.muteBtn.click(); break;
    case 'KeyS':       e.preventDefault(); setShuffle(!state.isShuffle); break;
  }
});

// ─── SIDEBAR OPEN / CLOSE ────────────────────────────────────
function openSidebar()  {
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

// ─── SIDEBAR SEARCH TOGGLE ────────────────────────────────────
dom.navSearchToggle.addEventListener('click', () => {
  const isOpen = dom.sidebarSearchBar.classList.toggle('open');
  dom.navSearchToggle.classList.toggle('open', isOpen);
  dom.navSearchToggle.setAttribute('aria-expanded', isOpen);
  if (isOpen) {
    setTimeout(() => dom.sidebarSearchInput.focus(), 100);
  } else {
    dom.sidebarSearchInput.value = '';
    dom.ssbClear.classList.remove('visible');
    dom.ssbResults.innerHTML = '';
  }
});

// Sidebar search input
let ssbTimer;
dom.sidebarSearchInput.addEventListener('input', () => {
  const q = dom.sidebarSearchInput.value.trim();
  dom.ssbClear.classList.toggle('visible', q.length > 0);
  clearTimeout(ssbTimer);
  ssbTimer = setTimeout(() => renderSsbResults(q), 180);
});

dom.ssbClear.addEventListener('click', () => {
  dom.sidebarSearchInput.value = '';
  dom.ssbClear.classList.remove('visible');
  dom.ssbResults.innerHTML = '';
  dom.sidebarSearchInput.focus();
});

function renderSsbResults(q) {
  dom.ssbResults.innerHTML = '';
  if (!q) return;

  const lq = q.toLowerCase();
  const results = state.allSongs.filter(s =>
    displayName(s.name).toLowerCase().includes(lq) ||
    s.albumTitle.toLowerCase().includes(lq)
  ).slice(0, 12);

  if (!results.length) {
    dom.ssbResults.innerHTML = `<li class="ssb-empty">No results for "${q}"</li>`;
    return;
  }

  results.forEach(item => {
    const li = document.createElement('li');
    const isActive = state.currentFolder === item.folder &&
      state.songs[state.currentSongIndex] === item.name;
    if (isActive) li.classList.add('ssb-active');
    li.innerHTML = `
      <div class="ssb-icon">
        <img src="./songs/${encodeURIComponent(item.folder)}/cover.jpg" alt=""
          onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\'/></svg>'">
      </div>
      <div class="ssb-text">
        <div class="ssb-name">${displayName(item.name)}</div>
        <div class="ssb-album">${item.albumTitle}</div>
      </div>`;
    li.addEventListener('click', () => {
      loadFolder(item.folder);
      const idx = state.songs.indexOf(item.name);
      playSong(item.folder, idx >= 0 ? idx : 0);
      // Close sidebar on mobile after selecting
      if (window.innerWidth <= 768) closeSidebar();
      showToast(`Playing: ${displayName(item.name)}`);
    });
    dom.ssbResults.appendChild(li);
  });
}

// ─── TOP BAR SEARCH ───────────────────────────────────────────
let searchTimer;
dom.searchInput.addEventListener('input', () => {
  const q = dom.searchInput.value.trim();
  dom.searchClear.classList.toggle('visible', q.length > 0);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => handleTopSearch(q), 200);
});
dom.searchClear.addEventListener('click', () => {
  dom.searchInput.value = '';
  dom.searchClear.classList.remove('visible');
  handleTopSearch('');
  dom.searchInput.focus();
});

function handleTopSearch(q) {
  const greet  = $$('.greeting-section');
  const albums = $$('.albums-section');
  if (!q) {
    dom.searchResults.style.display = 'none';
    greet.style.display  = '';
    albums.style.display = '';
    return;
  }
  greet.style.display  = 'none';
  albums.style.display = 'none';
  dom.searchResults.style.display = '';

  const lq = q.toLowerCase();
  const results = state.allSongs.filter(s =>
    displayName(s.name).toLowerCase().includes(lq) || s.albumTitle.toLowerCase().includes(lq)
  );

  dom.searchResultList.innerHTML = '';
  if (!results.length) {
    dom.searchResultList.innerHTML = '<li style="padding:16px 12px;color:#b3b3b3;font-size:14px">No results found</li>';
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
      </div>`;
    li.addEventListener('click', () => {
      loadFolder(item.folder);
      const idx = state.songs.indexOf(item.name);
      playSong(item.folder, idx >= 0 ? idx : 0);
    });
    dom.searchResultList.appendChild(li);
  });
}

// ─── CLICK DELEGATION ────────────────────────────────────────
document.addEventListener('click', e => {
  // Card play button
  const cpb = e.target.closest('.card-play-btn');
  if (cpb) {
    e.stopPropagation();
    const folder = cpb.dataset.folder;
    loadFolder(folder);
    playSong(folder, 0);
    return;
  }
  // Album card
  const ac = e.target.closest('.album-card');
  if (ac) {
    const folder = ac.dataset.folder;
    loadFolder(folder);
    renderSongList();
    if (window.innerWidth <= 768) openSidebar();
    return;
  }
  // Quick card
  const qc = e.target.closest('.quick-card');
  if (qc) {
    const folder = qc.dataset.folder;
    loadFolder(folder);
    playSong(folder, 0);
    return;
  }
  // Song list item
  const sl = e.target.closest('#songList li');
  if (sl) {
    const idx = parseInt(sl.dataset.index);
    playSong(state.currentFolder, idx);
    if (window.innerWidth <= 768) closeSidebar();
    return;
  }
  // Close queue when clicking outside
  if (!dom.queuePanel.contains(e.target) && !dom.queueBtn.contains(e.target)) {
    dom.queuePanel.classList.remove('open');
  }
});

// Queue panel
dom.queueBtn.addEventListener('click',  () => dom.queuePanel.classList.toggle('open'));
dom.closeQueue.addEventListener('click', () => dom.queuePanel.classList.remove('open'));

// ─── INIT ────────────────────────────────────────────────────
async function init() {
  dom.greetingText.textContent = getGreeting();

  const ok = await loadAlbums();
  if (!ok) {
    dom.cardGrid.innerHTML = '<p style="padding:20px;color:#b3b3b3">Could not load songs-list.json</p>';
    return;
  }

  renderAlbums();

  const first = Object.keys(state.albumsData)[0];
  if (first) {
    loadFolder(first);
    playSong(first, 0, false);
  }
}

init();
