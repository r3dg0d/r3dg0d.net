// Bio Site JavaScript - Node.js/Express Version
// This version calls local API endpoints (same server)

// Configuration - Use relative URLs since API is on same server
const CONFIG = {
    apiBaseUrl: '', // Empty = same origin (relative URLs)
    spotify: {
        updateInterval: 30000 // 30 seconds
    },
    views: {
        updateInterval: 5000 // 5 seconds for real-time updates
    }
};

// Update Spotify status
async function updateSpotifyStatus() {
    try {
        const response = await fetch('/api/spotify/now-playing');
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Spotify API error:', response.status, errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            console.error('Spotify error:', data.error);
            if (data.details) {
                console.error('Spotify error details:', data.details);
            }
            updateSpotifyUI(null);
            return;
        }
        
        // Check if we have a track (either playing or not)
        if (data.item) {
            updateSpotifyUI(data);
        } else if (data.isPlaying === false) {
            // Try to get recently played
            const recentResponse = await fetch('/api/spotify/recently-played');
            
            if (!recentResponse.ok) {
                throw new Error(`HTTP ${recentResponse.status}`);
            }
            
            const recentData = await recentResponse.json();
            if (recentData.items && recentData.items.length > 0) {
                const track = recentData.items[0].track;
                updateSpotifyUI({
                    item: track,
                    isPlaying: false,
                    playedAt: recentData.items[0].played_at
                });
            } else {
                updateSpotifyUI(null);
            }
        }
    } catch (error) {
        console.error('Error updating Spotify status:', error);
        console.error('Full error:', error);
        updateSpotifyUI(null);
    }
}

function updateSpotifyUI(data) {
    const songNameEl = document.getElementById('songname');
    const artistEl = document.getElementById('artist');
    const albumCoverEl = document.getElementById('albumcover');
    const songLinkEl = document.getElementById('songlink');
    const lastPlayedEl = document.getElementById('lastplayed');
    const pulserEl = document.getElementById('pulser');
    
    if (!data || !data.item) {
        songNameEl.textContent = '—';
        artistEl.textContent = '—';
        albumCoverEl.style.display = 'none';
        songLinkEl.href = '#';
        lastPlayedEl.textContent = '—';
        pulserEl.classList.remove('online');
        return;
    }
    
    const track = data.item;
    songNameEl.textContent = track.name || '—';
    artistEl.textContent = track.artists.map(a => a.name).join(', ') || '—';
    
    if (track.album && track.album.images && track.album.images.length > 0) {
        // Use the first (largest) image
        albumCoverEl.src = track.album.images[0].url;
        albumCoverEl.style.display = 'block';
        albumCoverEl.alt = `Album cover for ${track.name}`;
    } else {
        albumCoverEl.style.display = 'none';
    }
    
    if (track.external_urls && track.external_urls.spotify) {
        songLinkEl.href = track.external_urls.spotify;
    } else {
        songLinkEl.href = '';
    }
    
    if (data.isPlaying) {
        lastPlayedEl.textContent = 'Playing now';
        pulserEl.classList.add('online');
    } else if (data.playedAt) {
        const playedDate = new Date(data.playedAt);
        const now = new Date();
        const diffMs = now - playedDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffMins < 1) {
            lastPlayedEl.textContent = 'Played just now';
        } else if (diffMins < 60) {
            lastPlayedEl.textContent = `Played ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            lastPlayedEl.textContent = `Played ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else {
            lastPlayedEl.textContent = `Played ${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) !== 1 ? 's' : ''} ago`;
        }
        pulserEl.classList.remove('online');
    } else {
        lastPlayedEl.textContent = '—';
        pulserEl.classList.remove('online');
    }
}

// Increment view count (called once on page load)
async function incrementViewCount() {
    try {
        const response = await fetch('/api/views/hit');
        if (response.ok) {
            const data = await response.json();
            updateViewCounterUI(data.count || 0);
            console.log('View count incremented:', data.count);
        } else {
            console.warn('Failed to increment view count:', response.status);
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
    }
}

// Update view counter display (called periodically to get latest count)
async function updateViewCounter() {
    try {
        const response = await fetch('/api/views');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateViewCounterUI(data.count || 0);
    } catch (error) {
        console.error('Error updating view counter:', error);
    }
}

function updateViewCounterUI(count) {
    const viewCountEl = document.getElementById('view-count');
    if (viewCountEl) {
        viewCountEl.textContent = count.toLocaleString();
    }
}

// Snowflake animation
function createSnowflakes() {
    const snowContainer = document.getElementById('snow');
    if (!snowContainer) return;
    
    // Clear any existing snowflakes
    snowContainer.innerHTML = '';
    
    const snowflakeSymbols = ['❄', '✱', '❅', '❆', '❄', '✱', '❅', '❆'];
    const numSnowflakes = 50;
    
    for (let i = 0; i < numSnowflakes; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.textContent = snowflakeSymbols[Math.floor(Math.random() * snowflakeSymbols.length)];
        
        // Random properties
        const size = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
        const left = Math.random() * 100; // 0 to 100%
        const animationDuration = Math.random() * 10 + 10; // 10 to 20 seconds
        const animationDelay = Math.random() * 5; // 0 to 5 seconds
        const opacity = Math.random() * 0.5 + 0.3; // 0.3 to 0.8
        
        snowflake.style.position = 'absolute';
        snowflake.style.left = left + '%';
        snowflake.style.fontSize = (size * 20) + 'px';
        snowflake.style.opacity = opacity;
        snowflake.style.animation = `snowfall ${animationDuration}s linear infinite`;
        snowflake.style.animationDelay = animationDelay + 's';
        snowflake.style.pointerEvents = 'none';
        snowflake.style.userSelect = 'none';
        
        snowContainer.appendChild(snowflake);
    }
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Create snowflakes
    createSnowflakes();
    
    // Increment view count once on page load
    incrementViewCount();
    
    // Initial updates
    updateSpotifyStatus();
    updateViewCounter(); // Initial view count display
    
    // Set up intervals
    setInterval(updateSpotifyStatus, CONFIG.spotify.updateInterval);
    setInterval(updateViewCounter, CONFIG.views.updateInterval); // Real-time view counter updates (fetch only, no increment)
});

