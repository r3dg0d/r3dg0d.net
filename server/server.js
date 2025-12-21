// r3dg0d.net - Server
// Bio Site with Node.js Backend

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log('📄 Loading .env from:', envPath);
    dotenv.config({ path: envPath });
} else {
    console.log('⚠️ .env file not found at:', envPath);
    dotenv.config();
}

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for correct IP addresses
app.set('trust proxy', true);

// Directory paths
const APP_DIR = __dirname;
const ROOT_DIR = path.dirname(APP_DIR);
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const JS_DIR = path.join(ROOT_DIR, 'js');
const MUSIC_DIR = path.join(PUBLIC_DIR, 'music');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));

// Request logging
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`📥 ${req.method} ${req.path}`);
    }
    next();
});

// ============================================
// View Counter
// ============================================
const VIEWS_FILE = path.join(APP_DIR, 'views.json');
const VIEWED_IPS_FILE = path.join(APP_DIR, 'viewed_ips.json');

let viewCount = 0;
let viewedIPs = new Set();

// Load existing data
if (fs.existsSync(VIEWS_FILE)) {
    try {
        const data = fs.readFileSync(VIEWS_FILE, 'utf8');
        viewCount = JSON.parse(data).count || 0;
    } catch (e) {
        console.error('Error reading views file:', e);
    }
}

if (fs.existsSync(VIEWED_IPS_FILE)) {
    try {
        const data = fs.readFileSync(VIEWED_IPS_FILE, 'utf8');
        if (data.trim()) {
            const ips = JSON.parse(data);
            if (Array.isArray(ips)) {
                viewedIPs = new Set(ips);
                console.log(`📊 Loaded ${viewedIPs.size} unique IPs`);
            }
        }
    } catch (e) {
        console.error('Error reading viewed IPs file:', e);
    }
}

function saveViews() {
    try {
        fs.writeFileSync(VIEWS_FILE, JSON.stringify({ count: viewCount }, null, 2));
    } catch (e) {
        console.error('Error saving views:', e);
    }
}

function saveViewedIPs() {
    try {
        fs.writeFileSync(VIEWED_IPS_FILE, JSON.stringify(Array.from(viewedIPs), null, 2));
    } catch (e) {
        console.error('Error saving viewed IPs:', e);
    }
}

function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.ip || 'unknown';
}

// View counter endpoints
app.get('/api/views/hit', (req, res) => {
    try {
        const clientIP = getClientIP(req);
        
        if (viewedIPs.has(clientIP)) {
            return res.json({ count: viewCount, newView: false });
        }
        
        viewedIPs.add(clientIP);
        viewCount++;
        saveViews();
        saveViewedIPs();
        
        console.log(`✅ New view from ${clientIP}, total: ${viewCount}`);
        res.json({ count: viewCount, newView: true });
    } catch (error) {
        console.error('Error in /api/views/hit:', error);
        res.status(500).json({ error: 'Failed to increment view count', count: viewCount });
    }
});

app.get('/api/views', (req, res) => {
    res.json({ count: viewCount });
});

// ============================================
// Discord Presence (Lanyard API)
// ============================================
const DISCORD_USER_ID = process.env.DISCORD_USER_ID || '';

app.get('/api/discord/presence', async (req, res) => {
    try {
        if (!DISCORD_USER_ID) {
            return res.json({ status: 'offline', message: 'Discord ID not configured' });
        }
        
        // Use Lanyard API for Discord presence
        const response = await axios.get(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`, {
            timeout: 5000
        });
        
        if (response.data.success && response.data.data) {
            const data = response.data.data;
            const status = data.discord_status || 'offline';
            const user = data.discord_user || {};
            
            let avatar = '/favicon.jpg';
            if (user.avatar) {
                avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
            }
            
            res.json({
                status: status,
                username: user.username || 'r3dg0d',
                discriminator: user.discriminator || '0',
                avatar: avatar,
                activities: data.activities || [],
                listening_to_spotify: data.listening_to_spotify || false,
                spotify: data.spotify || null
            });
        } else {
            res.json({ status: 'offline' });
        }
    } catch (error) {
        console.error('Discord presence error:', error.message);
        res.json({ status: 'offline', error: error.message });
    }
});

// ============================================
// Music Playlist (from .wav files)
// ============================================
const ALBUMARTS_DIR = path.join(PUBLIC_DIR, 'albumarts');

// Helper function to find album art
function findAlbumArt(nameWithoutExt) {
    if (!fs.existsSync(ALBUMARTS_DIR)) {
        return '/favicon.jpg';
    }
    
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    for (const ext of imageExts) {
        const artPath = path.join(ALBUMARTS_DIR, nameWithoutExt + ext);
        if (fs.existsSync(artPath)) {
            return `/albumarts/${encodeURIComponent(nameWithoutExt + ext)}`;
        }
    }
    
    return '/favicon.jpg';
}

app.get('/api/music/playlist', (req, res) => {
    try {
        if (!fs.existsSync(MUSIC_DIR)) {
            fs.mkdirSync(MUSIC_DIR, { recursive: true });
            return res.json({ tracks: [] });
        }
        
        // Ensure albumarts directory exists
        if (!fs.existsSync(ALBUMARTS_DIR)) {
            fs.mkdirSync(ALBUMARTS_DIR, { recursive: true });
        }
        
        const files = fs.readdirSync(MUSIC_DIR);
        const audioFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.wav', '.mp3', '.ogg', '.flac', '.m4a'].includes(ext);
        });
        
        const tracks = audioFiles.map((file, index) => {
            // Parse filename for metadata (format: "Artist - Title.wav" or just "Title.wav")
            const nameWithoutExt = path.basename(file, path.extname(file));
            let title = nameWithoutExt;
            let artist = 'Unknown Artist';
            
            if (nameWithoutExt.includes(' - ')) {
                const parts = nameWithoutExt.split(' - ');
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }
            
            // Look for album art in albumarts/ folder
            const cover = findAlbumArt(nameWithoutExt);
            
            return {
                id: index,
                title: title,
                artist: artist,
                url: `/music/${encodeURIComponent(file)}`,
                cover: cover,
                filename: file
            };
        });
        
        // Shuffle playlist
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        
        res.json({ tracks: tracks });
    } catch (error) {
        console.error('Error loading playlist:', error);
        res.status(500).json({ error: 'Failed to load playlist', tracks: [] });
    }
});

// ============================================
// Spotify API
// ============================================
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN || '';

let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyAccessToken() {
    if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) {
        return spotifyAccessToken;
    }
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
        throw new Error('Spotify credentials not configured');
    }
    
    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: SPOTIFY_REFRESH_TOKEN,
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
                },
            }
        );
        
        spotifyAccessToken = response.data.access_token;
        spotifyTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
        return spotifyAccessToken;
    } catch (error) {
        console.error('Spotify token error:', error.response?.data || error.message);
        throw error;
    }
}

app.get('/api/spotify/now-playing', async (req, res) => {
    try {
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
            return res.status(500).json({ error: 'Spotify not configured' });
        }
        
        const token = await getSpotifyAccessToken();
        
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${token}` },
            validateStatus: (status) => status >= 200 && status < 300 || status === 204
        });
        
        if (response.status === 204 || !response.data) {
            return res.json({ isPlaying: false, item: null });
        }
        
        res.json({
            isPlaying: response.data.is_playing || false,
            item: response.data.item,
            progress_ms: response.data.progress_ms
        });
    } catch (error) {
        console.error('Spotify now-playing error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/spotify/recently-played', async (req, res) => {
    try {
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
            return res.status(500).json({ error: 'Spotify not configured' });
        }
        
        const token = await getSpotifyAccessToken();
        const limit = req.query.limit || 20;
        
        const response = await axios.get(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Spotify recently-played error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// YouTube API
// ============================================
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || '';

app.get('/api/youtube/videos', async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    try {
        let channelId = YOUTUBE_CHANNEL_ID;
        
        // Try to get channel ID from handle if API key is available
        if (YOUTUBE_API_KEY && !channelId) {
            try {
                const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
                    params: {
                        part: 'id,contentDetails',
                        forHandle: '128bytes8',
                        key: YOUTUBE_API_KEY
                    }
                });
                
                if (channelResponse.data.items?.length > 0) {
                    channelId = channelResponse.data.items[0].id;
                }
            } catch (err) {
                console.log('Could not get channel ID from handle');
            }
        }
        
        // Use YouTube Data API if available
        if (YOUTUBE_API_KEY && channelId) {
            try {
                const channelDetails = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
                    params: {
                        part: 'contentDetails',
                        id: channelId,
                        key: YOUTUBE_API_KEY
                    }
                });
                
                const uploadsPlaylistId = channelDetails.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
                
                if (uploadsPlaylistId) {
                    const playlistResponse = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
                        params: {
                            part: 'snippet,contentDetails',
                            playlistId: uploadsPlaylistId,
                            maxResults: 50,
                            key: YOUTUBE_API_KEY
                        }
                    });
                    
                    if (playlistResponse.data.items?.length > 0) {
                        const videoIds = playlistResponse.data.items
                            .map(item => item.contentDetails?.videoId)
                            .filter(id => id);
                        
                        if (videoIds.length > 0) {
                            const videosResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                                params: {
                                    part: 'snippet,statistics,status',
                                    id: videoIds.join(','),
                                    key: YOUTUBE_API_KEY
                                }
                            });
                            
                            const videos = videosResponse.data.items
                                .filter(item => {
                                    const status = item.status;
                                    return status.privacyStatus === 'public' && 
                                           (status.uploadStatus === 'processed' || status.uploadStatus === 'uploaded');
                                })
                                .map(item => ({
                                    id: item.id,
                                    title: item.snippet.title,
                                    published: item.snippet.publishedAt,
                                    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                                    url: `https://www.youtube.com/watch?v=${item.id}`,
                                    viewCount: parseInt(item.statistics.viewCount || '0'),
                                    likeCount: parseInt(item.statistics.likeCount || '0')
                                }));
                            
                            return res.json({ videos });
                        }
                    }
                }
            } catch (apiError) {
                console.error('YouTube API error:', apiError.message);
            }
        }
        
        // Fallback to RSS feed
        const rssUrl = channelId && channelId.startsWith('UC')
            ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            : 'https://www.youtube.com/feeds/videos.xml?channel_id=@128bytes8';
        
        const rssResponse = await axios.get(rssUrl, {
            headers: {
                'Accept': 'application/xml, text/xml',
                'User-Agent': 'Mozilla/5.0',
                'Cache-Control': 'no-cache'
            }
        });
        
        const videos = parseYouTubeRSS(rssResponse.data);
        res.json({ videos: videos.slice(0, 50) });
        
    } catch (error) {
        console.error('YouTube videos error:', error.message);
        res.status(500).json({ error: 'Failed to fetch videos', videos: [] });
    }
});

function parseYouTubeRSS(xml) {
    const videos = [];
    const videoMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    
    for (const match of videoMatches) {
        const entry = match[1];
        const titleMatch = entry.match(/<title>(.*?)<\/title>/);
        const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
        const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
        const thumbnailMatch = entry.match(/<media:thumbnail url="(.*?)"/);
        
        if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            let title = titleMatch ? titleMatch[1] : 'Untitled';
            title = title.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim();
            
            videos.push({
                id: videoId,
                title: title,
                published: publishedMatch ? publishedMatch[1] : '',
                thumbnail: thumbnailMatch ? thumbnailMatch[1] : '',
                url: `https://www.youtube.com/watch?v=${videoId}`
            });
        }
    }
    
    return videos;
}

// ============================================
// Static Files & Routes
// ============================================

// Redirect .html to clean URLs
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        return res.redirect(301, req.path.replace(/\.html$/, '') || '/');
    }
    next();
});

// Serve static files
if (fs.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR, { index: false }));
}
if (fs.existsSync(JS_DIR)) {
    app.use('/js', express.static(JS_DIR));
}

// HTML Routes
app.get('/', (req, res) => {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html not found');
    }
});

const htmlPages = ['blog', 'spotify', 'youtube', 'projects', 'contact'];
htmlPages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        const pagePath = path.join(PUBLIC_DIR, `${page}.html`);
        if (fs.existsSync(pagePath)) {
            res.sendFile(pagePath);
        } else {
            res.status(404).send(`${page}.html not found`);
        }
    });
});

// Catch-all for other HTML files
app.get('/:page', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
    }
    
    const pagePath = path.join(PUBLIC_DIR, `${req.params.page}.html`);
    if (fs.existsSync(pagePath)) {
        res.sendFile(pagePath);
    } else {
        next();
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        viewCount: viewCount,
        spotify: !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REFRESH_TOKEN),
        youtube: !!YOUTUBE_API_KEY,
        discord: !!DISCORD_USER_ID
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 r3dg0d.net Server running on port ${PORT}`);
    console.log(`📁 Public directory: ${PUBLIC_DIR}`);
    console.log(`🎵 Music directory: ${MUSIC_DIR}`);
    console.log(`📊 View count: ${viewCount} (${viewedIPs.size} unique IPs)`);
    console.log(`\n🔧 API Configuration:`);
    console.log(`   Spotify: ${SPOTIFY_CLIENT_ID ? '✅' : '❌'}`);
    console.log(`   YouTube: ${YOUTUBE_API_KEY ? '✅' : '❌'}`);
    console.log(`   Discord: ${DISCORD_USER_ID ? '✅' : '❌'}`);
    console.log(`\n🌐 Server ready at http://localhost:${PORT}`);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

