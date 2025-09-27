console.log("hello");
let currfolder;
let currentsong = new Audio();
let songs;
let albumsData = {};

function secondsToMinutesSeconds(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}

// Load albums data from auto-generated JSON file
async function loadAlbumsData() {
    try {
        console.log("Loading albums data...");
        const response = await fetch('./songs-list.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Convert to the format the code expects
        data.albums.forEach(album => {
            albumsData[album.folder] = {
                title: album.title,
                description: album.description,
                songs: album.songs
            };
        });
        
        console.log("Albums data loaded:", albumsData);
        return true;
    } catch (error) {
        console.error("Error loading albums data:", error);
        return false;
    }
}

async function getsongs(folder) {
    currfolder = folder;
    
    // Extract folder name from path (e.g., "songs/Anuv Jain Mix" -> "Anuv Jain Mix")
    const folderName = folder.replace('songs/', '');
    
    // Get songs from loaded data
    if (albumsData[folderName]) {
        songs = albumsData[folderName].songs;
        console.log(`Found ${songs.length} songs for ${folderName}:`, songs);
    } else {
        songs = [];
        console.error(`No songs found for folder: ${folderName}`);
        console.log("Available folders:", Object.keys(albumsData));
        return songs;
    }

    let songul = document.querySelector(".songlist").getElementsByTagName("ul")[0];
    if (!songul) {
        console.error("Song list container not found");
        return songs;
    }

    songul.innerHTML = "";

    for (const song of songs) {
        const displayName = song.replace('.mp3', '').replaceAll("%20", " ");
        songul.innerHTML = songul.innerHTML + `<li>
              <img src="music.svg" class="invert" alt="music logo">
              <div class="info">
                <div>${displayName}</div>
              </div>
              <div class="playnow">
                <span>Play Now</span>
                <img src="play.svg" class="invert" alt="logo">
              </div>
              </li>`;
    }

    Array.from(document.querySelector(".songlist").getElementsByTagName("li")).forEach(e => {
        e.addEventListener("click", element => {
            const songName = e.querySelector(".info").firstElementChild.innerHTML.trim();
            // Find the actual filename
            const actualSong = songs.find(s => {
                const displayName = s.replace('.mp3', '').replaceAll("%20", " ");
                return displayName === songName;
            });
            if (actualSong) {
                playmusic(actualSong);
            }
        })
    });

    return songs;
}

const playmusic = (track, pause = false) => {
    if (!track) {
        console.error("No track provided to playmusic");
        return;
    }
    
    currentsong.src = `./${currfolder}/${encodeURIComponent(track)}`;
    console.log("Playing:", currentsong.src);
    
    if (!pause) {
        currentsong.play().catch(error => {
            console.error("Error playing audio:", error);
            alert("Could not play audio. Make sure the file exists.");
        });
        const playButton = document.getElementById('play') || document.querySelector('[src="play.svg"]');
        if (playButton) {
            playButton.src = "pause.svg";
        }
    }
    
    const displayName = track.replace('.mp3', '').replaceAll("%20", " ");
    const songinfoEl = document.querySelector(".songinfo");
    const songtimeEl = document.querySelector(".songtime");
    
    if (songinfoEl) songinfoEl.innerHTML = displayName;
    if (songtimeEl) songtimeEl.innerHTML = "00:00 / 00:00";
}

async function displayalbums() {
    try {
        console.log("Starting displayalbums...");
        
        let cardcontainer = document.querySelector(".cardcontainer");
        if (!cardcontainer) {
            console.error("Card container not found!");
            return;
        }
        
        // Clear existing cards
        cardcontainer.innerHTML = "";
        
        // Create cards from loaded data
        for (const [folderName, albumInfo] of Object.entries(albumsData)) {
            console.log("Processing folder:", folderName);
            
            const cardHTML = `<div data-folder="${folderName}" class="card">
                <div class="play">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 20V4L19 12L5 20Z" stroke="#141B34" fill="#000" stroke-width="1.5" stroke-linejoin="round" />
                  </svg>
                </div>
                <img src="./songs/${encodeURIComponent(folderName)}/cover.jpg" alt="Album cover" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNzA3MDcwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIyMCI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPg=='">
                <h4>${albumInfo.title}</h4>
                <p>${albumInfo.description}</p>
            </div>`;
            
            cardcontainer.innerHTML += cardHTML;
            console.log(`Added card for ${folderName}`);
        }
        
        console.log("Album display completed, total cards:", cardcontainer.children.length);
        
    } catch (error) {
        console.error('Error in displayalbums:', error);
    }
}

async function main() {
    // Load albums data first
    const loaded = await loadAlbumsData();
    if (!loaded) {
        alert("Could not load songs data. Please check if songs-list.json exists.");
        return;
    }
    
    // Wait for albums to load completely
    await displayalbums();
    
    // Load first available album instead of hardcoded "cs"
    const firstAlbum = Object.keys(albumsData)[0];
    if (firstAlbum) {
        await getsongs(`songs/${firstAlbum}`);
        
        // Only play if songs exist
        if (songs && songs.length > 0) {
            playmusic(songs[0], true);
        }
    }

    // Rest of your event listeners with safety checks
    const playButton = document.getElementById('play') || document.querySelector('[src*="play"]');
    if (playButton) {
        playButton.addEventListener("click", () => {
            if (currentsong.paused) {
                currentsong.play().catch(error => console.error("Play error:", error));
                playButton.src = "pause.svg";
            } else {
                currentsong.pause();
                playButton.src = "play.svg";
            }
        });
    }

    currentsong.addEventListener("timeupdate", () => {
        const songTimeEl = document.querySelector(".songtime");
        const circleEl = document.querySelector(".circle");
        
        if (songTimeEl) {
            songTimeEl.innerHTML = `${secondsToMinutesSeconds(currentsong.currentTime)} / ${secondsToMinutesSeconds(currentsong.duration)}`;
        }
        
        if (circleEl && !isNaN(currentsong.duration)) {
            circleEl.style.left = (currentsong.currentTime / currentsong.duration) * 100 + "%";
        }
    });

    const seekbar = document.querySelector(".seekbar");
    if (seekbar) {
        seekbar.addEventListener("click", e => {
            let percent = (e.offsetX / e.target.getBoundingClientRect().width) * 100;
            const circleEl = document.querySelector(".circle");
            if (circleEl) {
                circleEl.style.left = percent + "%";
            }
            currentsong.currentTime = ((currentsong.duration) * percent) / 100;
        });
    }

    const hamburger = document.querySelector(".hamburger");
    if (hamburger) {
        hamburger.addEventListener("click", () => {
            const leftEl = document.querySelector(".left");
            if (leftEl) leftEl.style.left = "0";
        });
    }

    const closeButton = document.querySelector(".close");
    if (closeButton) {
        closeButton.addEventListener("click", () => {
            const leftEl = document.querySelector(".left");
            if (leftEl) leftEl.style.left = "-110%";
        });
    }

    const previousButton = document.getElementById('previous') || document.querySelector('[onclick*="previous"]');
    if (previousButton) {
        previousButton.addEventListener("click", () => {
            currentsong.pause();
            let currentSongName = document.querySelector(".songinfo").innerHTML;
            let index = songs.findIndex(song => {
                const songDisplayName = song.replace('.mp3', '').replaceAll("%20", " ");
                return songDisplayName === currentSongName;
            });
            
            if (index > 0) {
                playmusic(songs[index - 1]);
            }
        });
    }

    const nextButton = document.getElementById('next') || document.querySelector('[onclick*="next"]');
    if (nextButton) {
        nextButton.addEventListener("click", () => {
            currentsong.pause();
            let currentSongName = document.querySelector(".songinfo").innerHTML;
            let index = songs.findIndex(song => {
                const songDisplayName = song.replace('.mp3', '').replaceAll("%20", " ");
                return songDisplayName === currentSongName;
            });
            
            if (index >= 0 && index < songs.length - 1) {
                playmusic(songs[index + 1]);
            }
        });
    }

    // Add event listeners to cards after they are created
    Array.from(document.getElementsByClassName("card")).forEach(e => {
        e.addEventListener("click", async item => {
            console.log("Card clicked:", item.currentTarget.dataset.folder);
            songs = await getsongs(`songs/${item.currentTarget.dataset.folder}`);
            if (songs.length > 0) {
                playmusic(songs[0], false);
            }
        });
    });

    const volumeRange = document.querySelector(".range input");
    if (volumeRange) {
        volumeRange.addEventListener("change", (e) => {
            currentsong.volume = parseInt(e.target.value) / 100;
        });
    }

    const volumeImg = document.querySelector(".volume>img");
    if (volumeImg) {
        volumeImg.addEventListener("click", e => {
            const volumeInput = document.querySelector(".range input");
            
            if(e.target.src.includes("volume.svg")){
                e.target.src = e.target.src.replace("volume.svg", "mute.svg");
                currentsong.volume = 0;
                if (volumeInput) volumeInput.value = 0;
            } else {
                e.target.src = e.target.src.replace("mute.svg", "volume.svg");
                currentsong.volume = 0.10;
                if (volumeInput) volumeInput.value = 10;
            }
        });
    }
}

main();
