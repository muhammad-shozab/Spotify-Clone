console.log("hello");
let currfolder;
let currentsong = new Audio();
let songs;

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

async function getsongs(folder) {
    currfolder = folder;
    let a = await fetch(`/${folder}`)
    let response = await a.text();

    let div = document.createElement("div")
    div.innerHTML = response
    let as = div.getElementsByTagName("a")
    songs = []

    for (let index = 0; index < as.length; index++) {
        const element = as[index];
        if (element.href.endsWith(".mp3")) {
            songs.push(element.textContent || element.innerText)
        }
    }
    let songul = document.querySelector(".songlist").getElementsByTagName("ul")[0]

    songul.innerHTML = ""

    for (const song of songs) {
        songul.innerHTML = songul.innerHTML + `<li>
              <img src="music.svg" class="invert" alt="music logo">
              <div class="info">
                <div>${song.replaceAll("%20", " ")}</div>
                <div>Shozab</div>
              </div>
              <div class="playnow">
                <span>Play Now</span>
                <img src="play.svg" class="invert" alt="logo">
              </div>
              </li>`;
    }

    Array.from(document.querySelector(".songlist").getElementsByTagName("li")).forEach(e => {
        e.addEventListener("click", element => {
            playmusic(e.querySelector(".info").firstElementChild.innerHTML.trim())
        })
    })

    return songs; // Return songs array
}

const playmusic = (track, pause = false) => {
    currentsong.src = `/${currfolder}/` + track
    if (!pause) {
        currentsong.play()
        play.src = "pause.svg"
    }
    document.querySelector(".songinfo").innerHTML = decodeURI(track)
    document.querySelector(".songtime").innerHTML = "00:00 / 00:00"
}

async function displayalbums() {
    try {
        console.log("Starting displayalbums...");
        let a = await fetch(`/songs/`)
        let response = await a.text();
        console.log("Raw response:", response);
        
        let cardcontainer = document.querySelector(".cardcontainer")
        if (!cardcontainer) {
            console.error("Card container not found!");
            return;
        }
        
        let div = document.createElement("div")
        div.innerHTML = response
        let anchors = div.getElementsByTagName("a")
        
        console.log("Found anchors:", anchors.length);
        
        // Clear existing cards
        cardcontainer.innerHTML = "";
        
        // Process each anchor - try different approaches
        for (let i = 0; i < anchors.length; i++) {
            let e = anchors[i];
            let linkText = e.textContent || e.innerText;
            let href = e.getAttribute('href') || e.href;
            
            console.log(`Anchor ${i}:`, {
                text: linkText,
                href: href,
                fullHref: e.href
            });
            
            // Check if it's a directory
            // Method 1: Check if href ends with / and is not parent directory
            if (linkText && linkText.trim() !== "" && linkText !== "../" && linkText !== "." && linkText !== "..") {
                let folder = linkText.replace("/", "").trim(); // Remove trailing slash if present
                
                // Skip if it's a file (has extension)
                if (folder.includes(".")) {
                    console.log(`Skipping file: ${folder}`);
                    continue;
                }
                
                console.log("Processing potential folder:", folder);
                
                try {
                    let infoResponse = await fetch(`/songs/${folder}/info.json`)
                    console.log(`Fetching info.json for ${folder}, status:`, infoResponse.status);
                    
                    let info;
                    if (infoResponse.ok) {
                        info = await infoResponse.json();
                        console.log(`Loaded info for ${folder}:`, info);
                    } else {
                        console.log(`No info.json for ${folder}, using defaults`);
                        info = {
                            title: folder.charAt(0).toUpperCase() + folder.slice(1),
                            description: "No description available"
                        };
                    }
                    
                    const cardHTML = `<div data-folder="${folder}" class="card">
                        <div class="play">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 20V4L19 12L5 20Z" stroke="#141B34" fill="#000" stroke-width="1.5" stroke-linejoin="round" />
                          </svg>
                        </div>
                        <img src="/songs/${folder}/cover.jpg" alt="Song image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNzA3MDcwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIyMCI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPg=='">
                        <h4>${info.title}</h4>
                        <p>${info.description}</p>
                    </div>`;
                    
                    cardcontainer.innerHTML += cardHTML;
                    console.log(`Added card for ${folder}`);
                    
                } catch (error) {
                    console.error(`Error processing folder ${folder}:`, error);
                }
            }
        }
        
        console.log("Album display completed, total cards:", cardcontainer.children.length);
        
    } catch (error) {
        console.error('Error in displayalbums:', error);
    }
}



async function main() {
    // Wait for albums to load completely
    await displayalbums();
    await getsongs("songs/cs");

    playmusic(songs[0], true)

    play.addEventListener("click", () => {
        if (currentsong.paused) {
            currentsong.play()
            play.src = "pause.svg"
        }
        else {
            currentsong.pause()
            play.src = "play.svg"
        }
    })

    currentsong.addEventListener("timeupdate", () => {
        document.querySelector(".songtime").innerHTML = `${secondsToMinutesSeconds(currentsong.currentTime)} / ${secondsToMinutesSeconds(currentsong.duration)}`
        document.querySelector(".circle").style.left = (currentsong.currentTime / currentsong.duration) * 100 + "%"
    })

    document.querySelector(".seekbar").addEventListener("click", e => {
        let percent = (e.offsetX / e.target.getBoundingClientRect().width) * 100
        document.querySelector(".circle").style.left = percent + "%";
        currentsong.currentTime = ((currentsong.duration) * percent) / 100
    })

    document.querySelector(".hamburger").addEventListener("click", () => {
        document.querySelector(".left").style.left = "0"
    })

    document.querySelector(".close").addEventListener("click", () => {
        document.querySelector(".left").style.left = "-110%"
    })

    previous.addEventListener("click", () => {
        currentsong.pause()
        // Get current song name from the displayed info
        let currentSongName = document.querySelector(".songinfo").innerHTML
        let index = songs.findIndex(song => {
            // Compare decoded song names
            return decodeURI(song).replaceAll("%20", " ") === currentSongName ||
                   song.replaceAll("%20", " ") === currentSongName ||
                   song === currentSongName
        })
        
        console.log("Current song:", currentSongName, "Index:", index)
        
        if (index > 0) {
            playmusic(songs[index - 1])
        }
    })

    next.addEventListener("click", () => {
        currentsong.pause()
        // Get current song name from the displayed info
        let currentSongName = document.querySelector(".songinfo").innerHTML
        let index = songs.findIndex(song => {
            // Compare decoded song names
            return decodeURI(song).replaceAll("%20", " ") === currentSongName ||
                   song.replaceAll("%20", " ") === currentSongName ||
                   song === currentSongName
        })
        
        console.log("Current song:", currentSongName, "Index:", index)
        
        if (index >= 0 && index < songs.length - 1) {
            playmusic(songs[index + 1])
        }
    })

    document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change", (e) => {
        currentsong.volume = parseInt(e.target.value) / 100
    })

    // Add event listeners to cards after they are created
    Array.from(document.getElementsByClassName("card")).forEach(e => {
        e.addEventListener("click", async item => {
            console.log("Card clicked:", item.currentTarget.dataset.folder)
            songs = await getsongs(`songs/${item.currentTarget.dataset.folder}`)
            if (songs.length > 0) {
                playmusic(songs[0], false) // Start playing the first song
            }
        })
    })
    // Add an event to volume
document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change", (e) => {
    console.log("Setting volume to", e.target.value, "/ 100")
    currentsong.volume = parseInt(e.target.value) / 100
})
// Add event listener to mute the track
document.querySelector(".volume>img").addEventListener("click", e=>{
    console.log(e.target)
    console.log("changing", e.target.src)
    if(e.target.src.includes("volume.svg")){
        e.target.src = e.target.src.replace("volume.svg", "mute.svg")
        currentsong.volume = 0;
        document.querySelector(".range").getElementsByTagName("input")[0].value = 0;
    }
    else{
        e.target.src = e.target.src.replace("mute.svg", "volume.svg")
        currentsong.volume = .10;
        document.querySelector(".range").getElementsByTagName("input")[0].value = 10;

    }
})

}

main()