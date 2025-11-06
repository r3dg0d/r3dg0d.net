// Bio Site JavaScript - Static Version for GitHub Pages/is-a.dev
// This version calls an external API endpoint instead of local server

// Configuration - API URL points to Discord bot hosting
const CONFIG = {
    apiBaseUrl: 'http://4r3dg0d34.dedimc.io:5000', // Discord bot API server
    spotify: {
        updateInterval: 30000 // 30 seconds
    },
    discord: {
        updateInterval: 60000 // 60 seconds
    }
};

// Update Spotify status
async function updateSpotifyStatus() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/api/spotify/now-playing`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Spotify error:', data.error);
            updateSpotifyUI(null);
            return;
        }
        
        if (data.isPlaying && data.item) {
            updateSpotifyUI(data);
        } else {
            // Try to get recently played
            const recentResponse = await fetch(`${CONFIG.apiBaseUrl}/api/spotify/recently-played`);
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
        songLinkEl.href = '';
        lastPlayedEl.textContent = '—';
        pulserEl.classList.remove('blob');
        pulserEl.classList.add('inblob');
        return;
    }
    
    const track = data.item;
    songNameEl.textContent = track.name || '—';
    artistEl.textContent = track.artists.map(a => a.name).join(', ') || '—';
    
    if (track.album && track.album.images && track.album.images.length > 0) {
        albumCoverEl.src = track.album.images[track.album.images.length - 1].url;
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
        pulserEl.classList.remove('inblob');
        pulserEl.classList.add('blob');
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
        pulserEl.classList.remove('blob');
        pulserEl.classList.add('inblob');
    } else {
        lastPlayedEl.textContent = '—';
        pulserEl.classList.remove('blob');
        pulserEl.classList.add('inblob');
    }
}

// Update Discord status
async function updateDiscordStatus() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/api/discord/status`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Discord error:', data.error);
            updateDiscordUI(null);
            return;
        }
        
        updateDiscordUI(data);
    } catch (error) {
        console.error('Error updating Discord status:', error);
        updateDiscordUI(null);
    }
}

function updateDiscordUI(data) {
    const statusTextEl = document.getElementById('discord-status-text');
    const pulserEl = document.getElementById('discord-pulser');
    
    if (!data || !data.status) {
        statusTextEl.textContent = '—';
        pulserEl.classList.remove('online');
        return;
    }
    
    const status = data.status;
    const statusMap = {
        'online': 'Online',
        'idle': 'Idle',
        'dnd': 'Do Not Disturb',
        'offline': 'Offline'
    };
    
    statusTextEl.textContent = statusMap[status] || status;
    
    if (status === 'online') {
        pulserEl.classList.add('online');
    } else {
        pulserEl.classList.remove('online');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initial updates
    updateSpotifyStatus();
    updateDiscordStatus();
    
    // Set up intervals
    setInterval(updateSpotifyStatus, CONFIG.spotify.updateInterval);
    setInterval(updateDiscordStatus, CONFIG.discord.updateInterval);
});

