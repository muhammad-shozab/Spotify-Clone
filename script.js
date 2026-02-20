'use strict';

/* ================================================================
   STATE
   ================================================================ */
const state = {
  albumsData:    {},
  currentFolder: null,
  currentIdx:    -1,
  songs:         [],
  allSongs:      [],       // {name, folder, albumTitle}
  isPlaying:     false,
  isShuffle:     false,
  repeatMode:    0,        // 0=off 1=all 2=one
  volume:        0.7,
  isMuted:       false,
  liked:         new Set(JSON.parse(localStorage.getItem('likedSongs') || '[]')),
  dragging:      { progress:false, volume:false },
};

const audio = new Audio();
audio.volume = state.volume;

/* ================================================================
   DOM REFS
   ================================================================ */
const $  = id => document.getElementById(id);
const $$ = s  => document.querySelector(s);

const D = {
  // sidebar
  sidebar:          $('sidebar'),
  overlay:          $('sidebarOverlay'),
  closeSidebar:     $('closeSidebar'),
  hamburger:        $('hamburgerBtn'),

  // sidebar search morph
  navSearchItem:    $('navSearchItem'),
  navSearchBtn:     $('navSearchBtn'),
  navSearchField:   $('navSearchField'),
  sidebarInput:     $('sidebarSearchInput'),
  nsfClose:         $('nsfClose'),
  sidebarResults:   $('sidebarResults'),

  // content
  cardGrid:         $('cardGrid'),
  quickGrid:        $('quickPlayGrid'),
  songList:         $('songList'),
  greeting:         $('greetingText'),

  // top search
  searchInput:      $('searchInput'),
  searchClear:      $('searchClear'),
  searchResults:    $('searchResults'),
  searchResultList: $('searchResultList'),

  // player
  songName:         $('playerSongName'),
  albumName:        $('playerAlbumName'),
  thumb:            $('playerThumb'),
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
  muteBtn:          $('muteBtn'),
  volumeBar:        $('volumeBar'),
  volumeFill:       $('volumeFill'),
  volumeThumb:      $('volumeThumb'),
  queueBtn:         $('queueBtn'),
  queuePanel:       $('queuePanel'),
  queueList:        $('queueList'),
  closeQueue:       $('closeQueue'),
  toast:            $('toast'),
};

/* ================================================================
   SEEK ROW REPARENTING
   On ≤540px the seek bar moves from .prow-controls to .prow-volume
   ================================================================ */
const seekRow       = $$('.seek-row');
const prowControls  = $$('.prow-controls');
const prowVolume    = $$('.prow-volume');
let seekIsInVolume  = false;

function repositionSeek() {
  const mobile = window.innerWidth <= 540;
  if (mobile && !seekIsInVolume) {
    prowVolume.appendChild(seekRow);
    seekIsInVolume = true;
  } else if (!mobile && seekIsInVolume) {
    prowControls.appendChild(seekRow);
    seekIsInVolume = false;
  }
}

window.addEventListener('resize', repositionSeek);
repositionSeek(); // run once on load

/* ================================================================
   UTILS
   ================================================================ */
function fmt(s) {
  if (isNaN(s) || s < 0) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}
function dn(f) { return f.replace(/\.mp3$/i,'').replaceAll('%20',' '); }
function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning ☀️' : h < 18 ? 'Good Afternoon 🎵' : 'Good Evening 🌙';
}

let toastT;
function toast(msg) {
  D.toast.textContent = msg;
  D.toast.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => D.toast.classList.remove('show'), 2500);
}

/* ================================================================
   LOAD DATA
   ================================================================ */
async function loadAlbums() {
  try {
    const r = await fetch('./songs-list.json');
    if (!r.ok) throw 0;
    const d = await r.json();
    d.albums.forEach(a => {
      state.albumsData[a.folder] = { title:a.title, desc:a.description, songs:a.songs };
      a.songs.forEach(s => state.allSongs.push({ name:s, folder:a.folder, albumTitle:a.title }));
    });
    return true;
  } catch { return false; }
}

/* ================================================================
   RENDER ALBUMS
   ================================================================ */
function renderAlbums() {
  D.cardGrid.innerHTML = '';
  D.quickGrid.innerHTML = '';

  Object.entries(state.albumsData).forEach(([folder, info]) => {
    // Album card
    const card = document.createElement('div');
    card.className = 'album-card';
    card.dataset.folder = folder;
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="./songs/${encodeURIComponent(folder)}/cover.jpg" alt="${info.title}"
          onerror="this.parentElement.innerHTML='<div class=\\'card-img-fallback\\'>🎵</div>'">
        <button class="card-play-btn" data-folder="${folder}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <div class="card-body">
        <div class="card-title">${info.title}</div>
        <div class="card-desc">${info.desc}</div>
      </div>`;
    D.cardGrid.appendChild(card);

    // Quick card (first 6)
    if (D.quickGrid.children.length < 6) {
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
      D.quickGrid.appendChild(qc);
    }
  });
}

/* ================================================================
   FOLDER / SONG LIST
   ================================================================ */
function loadFolder(folder) {
  if (folder === state.currentFolder) return;
  state.currentFolder = folder;
  state.songs = [...state.albumsData[folder].songs];
  renderSongList();
  renderQueue();
}

function renderSongList() {
  D.songList.innerHTML = '';
  state.songs.forEach((song, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;
    if (i === state.currentIdx) li.classList.add('active');
    li.innerHTML = `
      <span class="sl-num">${i+1}</span>
      <span class="sl-play-indicator">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span>
      <div class="sl-info">
        <div class="sl-name">${dn(song)}</div>
        <div class="sl-artist">${state.albumsData[state.currentFolder]?.title||''}</div>
      </div>`;
    D.songList.appendChild(li);
  });
}

/* ================================================================
   PLAYBACK
   ================================================================ */
function playSong(folder, index, autoPlay = true) {
  // load folder only if needed
  if (folder !== state.currentFolder) {
    state.currentFolder = folder;
    state.songs = [...state.albumsData[folder].songs];
  }
  state.currentIdx = index;
  const song = state.songs[index];
  if (!song) return;

  audio.src = `./songs/${encodeURIComponent(folder)}/${encodeURIComponent(song)}`;
  if (autoPlay) { audio.play().catch(() => toast('Cannot play audio')); state.isPlaying = true; }

  updatePlayerUI();
  renderSongList();
  renderQueue();
}

function updatePlayerUI() {
  const song  = state.songs[state.currentIdx];
  if (!song) return;
  const title = state.albumsData[state.currentFolder]?.title || '';

  D.songName.textContent  = dn(song);
  D.albumName.textContent = title;
  D.thumb.innerHTML = `<img src="./songs/${encodeURIComponent(state.currentFolder)}/cover.jpg"
    onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\'/></svg>'">`;
  D.likeBtn.classList.toggle('liked', state.liked.has(`${state.currentFolder}::${song}`));
  syncPlayPause();
}

function syncPlayPause() {
  D.playPauseBtn.querySelector('.play-icon').style.display  = state.isPlaying ? 'none' : '';
  D.playPauseBtn.querySelector('.pause-icon').style.display = state.isPlaying ? '' : 'none';
}

function togglePlay() {
  if (state.currentIdx === -1) {
    const f = Object.keys(state.albumsData)[0];
    if (f) playSong(f, 0);
    return;
  }
  if (audio.paused) { audio.play().catch(()=>{}); state.isPlaying = true; }
  else              { audio.pause(); state.isPlaying = false; }
  syncPlayPause();
}

function playNext() {
  if (state.repeatMode === 2) { audio.currentTime = 0; audio.play(); return; }
  let n = state.isShuffle
    ? Math.floor(Math.random() * state.songs.length)
    : state.currentIdx + 1;
  if (n >= state.songs.length) {
    if (state.repeatMode === 1) n = 0;
    else { audio.pause(); state.isPlaying = false; syncPlayPause(); return; }
  }
  playSong(state.currentFolder, n);
}

function playPrev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let p = state.currentIdx - 1;
  if (p < 0) p = state.repeatMode === 1 ? state.songs.length - 1 : 0;
  playSong(state.currentFolder, p);
}

audio.addEventListener('ended',  playNext);
audio.addEventListener('play',   () => { state.isPlaying = true;  syncPlayPause(); });
audio.addEventListener('pause',  () => { state.isPlaying = false; syncPlayPause(); });
audio.addEventListener('loadedmetadata', () => { D.totalTime.textContent = fmt(audio.duration); });
audio.addEventListener('timeupdate', () => {
  if (state.dragging.progress || !audio.duration) return;
  const p = audio.currentTime / audio.duration;
  applyProgress(p);
  D.currentTime.textContent = fmt(audio.currentTime);
  D.totalTime.textContent   = fmt(audio.duration);
});

/* ================================================================
   QUEUE
   ================================================================ */
function renderQueue() {
  D.queueList.innerHTML = '';
  state.songs.forEach((song, i) => {
    const li = document.createElement('li');
    if (i === state.currentIdx) li.classList.add('now-playing');
    li.innerHTML = `
      <span class="q-num">${i+1}</span>
      <div class="q-info">
        <div class="q-name">${dn(song)}</div>
        <div class="q-album">${state.albumsData[state.currentFolder]?.title||''}</div>
      </div>`;
    li.addEventListener('click', () => { playSong(state.currentFolder, i); D.queuePanel.classList.remove('open'); });
    D.queueList.appendChild(li);
  });
}

D.queueBtn.addEventListener('click',   () => D.queuePanel.classList.toggle('open'));
D.closeQueue.addEventListener('click', () => D.queuePanel.classList.remove('open'));

/* ================================================================
   PROGRESS BAR
   ================================================================ */
function applyProgress(p) {
  D.progressFill.style.width = `${p*100}%`;
  D.progressThumb.style.left = `${p*100}%`;
}
function seekTo(clientX) {
  const r = D.progressBar.getBoundingClientRect();
  const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  if (audio.duration) audio.currentTime = p * audio.duration;
  applyProgress(p);
}

D.progressBar.addEventListener('click',     e => seekTo(e.clientX));
D.progressBar.addEventListener('mousedown', e => { state.dragging.progress = true; seekTo(e.clientX); });
document.addEventListener('mousemove',  e => { if (state.dragging.progress) seekTo(e.clientX); });
document.addEventListener('mouseup',    ()  => { state.dragging.progress = false; });
D.progressBar.addEventListener('touchstart', e => { state.dragging.progress = true; seekTo(e.touches[0].clientX); }, {passive:true});
document.addEventListener('touchmove',  e => { if (state.dragging.progress) seekTo(e.touches[0].clientX); }, {passive:true});
document.addEventListener('touchend',   ()  => { state.dragging.progress = false; });

/* ================================================================
   VOLUME
   ================================================================ */
function applyVolume(p) {
  state.volume = p;
  audio.volume = p;
  state.isMuted = p === 0;

  D.volumeFill.style.width  = `${p*100}%`;
  D.volumeThumb.style.left  = `${p*100}%`;

  const vi = D.muteBtn.querySelector('.vol-icon');
  const mi = D.muteBtn.querySelector('.mute-icon');
  if (vi && mi) { vi.style.display = p===0 ? 'none':''; mi.style.display = p===0 ? '':'none'; }
}
function setVol(clientX) {
  const r = D.volumeBar.getBoundingClientRect();
  applyVolume(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
}

D.volumeBar.addEventListener('click',     e => setVol(e.clientX));
D.volumeBar.addEventListener('mousedown', e => { state.dragging.volume = true; setVol(e.clientX); });
document.addEventListener('mousemove',  e => { if (state.dragging.volume) setVol(e.clientX); });
document.addEventListener('mouseup',    ()  => { state.dragging.volume = false; });
D.volumeBar.addEventListener('touchstart', e => { state.dragging.volume = true; setVol(e.touches[0].clientX); }, {passive:true});
document.addEventListener('touchmove',  e => { if (state.dragging.volume) setVol(e.touches[0].clientX); }, {passive:true});
document.addEventListener('touchend',   ()  => { state.dragging.volume = false; });

D.muteBtn.addEventListener('click', () => {
  state.isMuted ? applyVolume(state.volume || 0.7) : applyVolume(0);
});

applyVolume(state.volume);

/* ================================================================
   SHUFFLE / REPEAT
   ================================================================ */
const SVG_REPEAT  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
const SVG_REPEAT1 = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="14.5" text-anchor="middle" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="bold">1</text></svg>`;

function setShuffle(on) {
  state.isShuffle = on;
  D.shuffleBtn.classList.toggle('active', on);
  toast(on ? 'Shuffle on 🔀' : 'Shuffle off');
}
function cycleRepeat() {
  state.repeatMode = (state.repeatMode + 1) % 3;
  const active = state.repeatMode > 0;
  const svg    = state.repeatMode === 2 ? SVG_REPEAT1 : SVG_REPEAT;
  D.repeatBtn.classList.toggle('active', active);
  D.repeatBtn.innerHTML = svg;
  toast(['Repeat off', 'Repeat all 🔁', 'Repeat one 🔂'][state.repeatMode]);
}

D.shuffleBtn.addEventListener('click', () => setShuffle(!state.isShuffle));
D.repeatBtn.addEventListener('click',  cycleRepeat);

/* ================================================================
   LIKE
   ================================================================ */
D.likeBtn.addEventListener('click', () => {
  const song = state.songs[state.currentIdx];
  if (!song) return;
  const id = `${state.currentFolder}::${song}`;
  if (state.liked.has(id)) {
    state.liked.delete(id); D.likeBtn.classList.remove('liked'); toast('Removed from Liked Songs');
  } else {
    state.liked.add(id); D.likeBtn.classList.add('liked'); toast('Added to Liked Songs ❤️');
  }
  localStorage.setItem('likedSongs', JSON.stringify([...state.liked]));
});

/* ================================================================
   TRANSPORT BUTTONS
   ================================================================ */
D.playPauseBtn.addEventListener('click', togglePlay);
D.prevBtn.addEventListener('click', playPrev);
D.nextBtn.addEventListener('click', playNext);

/* ================================================================
   KEYBOARD
   ================================================================ */
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  switch(e.code) {
    case 'Space':      e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': e.preventDefault(); audio.currentTime = Math.min(audio.duration||0, audio.currentTime+10); break;
    case 'ArrowLeft':  e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime-10); break;
    case 'ArrowUp':    e.preventDefault(); applyVolume(Math.min(1, state.volume+0.1)); break;
    case 'ArrowDown':  e.preventDefault(); applyVolume(Math.max(0, state.volume-0.1)); break;
    case 'KeyN':       e.preventDefault(); playNext(); break;
    case 'KeyP':       e.preventDefault(); playPrev(); break;
    case 'KeyM':       e.preventDefault(); D.muteBtn.click(); break;
    case 'KeyS':       e.preventDefault(); setShuffle(!state.isShuffle); break;
  }
});

/* ================================================================
   SIDEBAR OPEN / CLOSE
   ================================================================ */
function openSidebar()  { D.sidebar.classList.add('open'); D.overlay.classList.add('active'); document.body.style.overflow='hidden'; }
function closeSidebar() { D.sidebar.classList.remove('open'); D.overlay.classList.remove('active'); document.body.style.overflow=''; }

D.hamburger.addEventListener('click', openSidebar);
D.closeSidebar.addEventListener('click', closeSidebar);
D.overlay.addEventListener('click', closeSidebar);

/* ================================================================
   SIDEBAR SEARCH MORPH
   Clicking "Search" nav button → morphs it into an input field
   in the SAME position. Clicking × reverts.
   ================================================================ */
function openSidebarSearch() {
  D.navSearchItem.classList.add('open');
  D.navSearchBtn.setAttribute('aria-expanded','true');
  setTimeout(() => D.sidebarInput.focus(), 180);
}
function closeSidebarSearch() {
  D.navSearchItem.classList.remove('open');
  D.navSearchBtn.setAttribute('aria-expanded','false');
  D.sidebarInput.value = '';
  D.sidebarResults.innerHTML = '';
}

D.navSearchBtn.addEventListener('click', openSidebarSearch);
D.nsfClose.addEventListener('click', closeSidebarSearch);

// Esc key closes it too
D.sidebarInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebarSearch(); });

// Live search
let ssbTimer;
D.sidebarInput.addEventListener('input', () => {
  clearTimeout(ssbTimer);
  ssbTimer = setTimeout(() => renderSidebarResults(D.sidebarInput.value.trim()), 180);
});

function renderSidebarResults(q) {
  D.sidebarResults.innerHTML = '';
  if (!q) return;

  const lq = q.toLowerCase();
  const hits = state.allSongs.filter(s =>
    dn(s.name).toLowerCase().includes(lq) || s.albumTitle.toLowerCase().includes(lq)
  ).slice(0, 10);

  if (!hits.length) {
    D.sidebarResults.innerHTML = `<li class="sr-empty">No results for "${q}"</li>`;
    return;
  }

  hits.forEach(item => {
    const li = document.createElement('li');
    const playing = state.currentFolder === item.folder && state.songs[state.currentIdx] === item.name;
    if (playing) li.classList.add('sr-playing');
    li.innerHTML = `
      <div class="sr-li-art">
        <img src="./songs/${encodeURIComponent(item.folder)}/cover.jpg" alt=""
          onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\'/></svg>'">
      </div>
      <div class="sr-li-info">
        <div class="sr-li-name">${dn(item.name)}</div>
        <div class="sr-li-album">${item.albumTitle}</div>
      </div>`;
    li.addEventListener('click', () => {
      // load folder first so songs array is right
      if (item.folder !== state.currentFolder) {
        state.currentFolder = item.folder;
        state.songs = [...state.albumsData[item.folder].songs];
      }
      const idx = state.songs.indexOf(item.name);
      playSong(item.folder, idx >= 0 ? idx : 0);
      toast(`▶ ${dn(item.name)}`);
      if (window.innerWidth <= 768) closeSidebar();
    });
    D.sidebarResults.appendChild(li);
  });
}

/* ================================================================
   TOP SEARCH BAR
   ================================================================ */
let topSearchTimer;
D.searchInput.addEventListener('input', () => {
  const q = D.searchInput.value.trim();
  D.searchClear.classList.toggle('visible', q.length > 0);
  clearTimeout(topSearchTimer);
  topSearchTimer = setTimeout(() => renderTopSearch(q), 200);
});
D.searchClear.addEventListener('click', () => {
  D.searchInput.value = '';
  D.searchClear.classList.remove('visible');
  renderTopSearch('');
  D.searchInput.focus();
});

function renderTopSearch(q) {
  const greetEl  = $$('.greeting-section');
  const albumsEl = $$('.albums-section');
  if (!q) {
    D.searchResults.style.display = 'none';
    greetEl.style.display  = '';
    albumsEl.style.display = '';
    return;
  }
  greetEl.style.display  = 'none';
  albumsEl.style.display = 'none';
  D.searchResults.style.display = '';

  const lq   = q.toLowerCase();
  const hits = state.allSongs.filter(s =>
    dn(s.name).toLowerCase().includes(lq) || s.albumTitle.toLowerCase().includes(lq)
  );

  D.searchResultList.innerHTML = '';
  if (!hits.length) {
    D.searchResultList.innerHTML = '<li style="padding:16px 12px;color:#b3b3b3">No results found</li>';
    return;
  }
  hits.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="sr-num">${i+1}</span>
      <div class="sr-info">
        <div class="sr-name">${dn(item.name)}</div>
        <div class="sr-album">${item.albumTitle}</div>
      </div>
      <div class="sr-play">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>`;
    li.addEventListener('click', () => {
      if (item.folder !== state.currentFolder) {
        state.currentFolder = item.folder;
        state.songs = [...state.albumsData[item.folder].songs];
      }
      const idx = state.songs.indexOf(item.name);
      playSong(item.folder, idx >= 0 ? idx : 0);
    });
    D.searchResultList.appendChild(li);
  });
}

/* ================================================================
   CLICK DELEGATION
   ================================================================ */
document.addEventListener('click', e => {
  // card play button
  const cpb = e.target.closest('.card-play-btn');
  if (cpb) { e.stopPropagation(); loadFolder(cpb.dataset.folder); playSong(cpb.dataset.folder, 0); return; }

  // album card → load + open sidebar songs
  const ac = e.target.closest('.album-card');
  if (ac) { loadFolder(ac.dataset.folder); if (window.innerWidth<=768) openSidebar(); return; }

  // quick card
  const qc = e.target.closest('.quick-card');
  if (qc) { loadFolder(qc.dataset.folder); playSong(qc.dataset.folder, 0); return; }

  // song list item
  const sl = e.target.closest('#songList li');
  if (sl) { playSong(state.currentFolder, parseInt(sl.dataset.index)); if (window.innerWidth<=768) closeSidebar(); return; }

  // close queue when clicking outside
  if (!D.queuePanel.contains(e.target) && e.target !== D.queueBtn && !D.queueBtn.contains(e.target)) {
    D.queuePanel.classList.remove('open');
  }
});

/* ================================================================
   INIT
   ================================================================ */
async function init() {
  D.greeting.textContent = greet();

  const ok = await loadAlbums();
  if (!ok) {
    D.cardGrid.innerHTML = '<p style="padding:20px;color:#b3b3b3">Could not load songs-list.json</p>';
    return;
  }

  renderAlbums();

  const first = Object.keys(state.albumsData)[0];
  if (first) {
    loadFolder(first);
    playSong(first, 0, false);  // load but don't autoplay
  }
}

init();
