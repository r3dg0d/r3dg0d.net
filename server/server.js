// Load .env file - try multiple locations for cPanel
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Try to load .env from current directory
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log('📄 Loading .env from:', envPath);
    dotenv.config({ path: envPath });
} else {
    console.log('⚠️ .env file not found at:', envPath);
    // Try loading from default location
    dotenv.config();
}

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // Bio site server on port 3000

// Trust proxy - important for getting correct IP addresses behind reverse proxies
app.set('trust proxy', true);

// Get the directory where server.js is located
const APP_DIR = __dirname;
const ROOT_DIR = path.dirname(APP_DIR); // Parent of server directory
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const CSS_DIR = path.join(ROOT_DIR, 'css');
const JS_DIR = path.join(ROOT_DIR, 'js');

// For cPanel: public_html is typically the web root
// Try to find public_html relative to node directory
// If node is at /home/username/node, public_html is usually at /home/username/public_html
const PUBLIC_HTML_DIR = path.join(path.dirname(APP_DIR), 'public_html');

// Request logging middleware (for debugging)
app.use((req, res, next) => {
    // Only log API requests to avoid spam
    if (req.path.startsWith('/api')) {
        console.log(`📥 ${req.method} ${req.path}${req.query && Object.keys(req.query).length > 0 ? '?' + new URLSearchParams(req.query).toString() : ''}`);
    }
    next();
});

// Parse JSON bodies (before routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - Allow all origins
app.use(cors({
    origin: true,
    credentials: true
}));

const VIEWS_FILE = path.join(APP_DIR, 'views.json');
const VIEWED_IPS_FILE = path.join(APP_DIR, 'viewed_ips.json');

// Spotify API configuration
// cPanel Node.js apps use environment variables from the interface, not .env file
// Make sure to set them in cPanel → Node.js → Environment Variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN || '';

// Debug: Log environment variable status at startup
console.log('\n🔍 Environment Variables Check:');
console.log('   Current directory:', __dirname);
console.log('   .env file path:', path.join(__dirname, '.env'));
console.log('   .env file exists:', fs.existsSync(path.join(__dirname, '.env')));
console.log('   SPOTIFY_CLIENT_ID:', SPOTIFY_CLIENT_ID ? `✅ Set (${SPOTIFY_CLIENT_ID.substring(0, 8)}...)` : '❌ MISSING');
console.log('   SPOTIFY_CLIENT_SECRET:', SPOTIFY_CLIENT_SECRET ? '✅ Set' : '❌ MISSING');
console.log('   SPOTIFY_REFRESH_TOKEN:', SPOTIFY_REFRESH_TOKEN ? `✅ Set (${SPOTIFY_REFRESH_TOKEN.substring(0, 8)}...)` : '❌ MISSING');
console.log('');

// If missing, show helpful message
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    console.log('⚠️  Spotify credentials missing!');
    console.log('   For cPanel Node.js apps, you MUST set environment variables in:');
    console.log('   cPanel → Node.js Selector → Your App → Environment Variables');
    console.log('   The .env file is NOT automatically loaded by cPanel Node.js apps.');
    console.log('');
}

// Debug: Show all Spotify-related env vars
const spotifyEnvVars = Object.keys(process.env).filter(k => k.includes('SPOTIFY'));
console.log('   All SPOTIFY env vars found:', spotifyEnvVars.length > 0 ? spotifyEnvVars.join(', ') : 'NONE');

// Spotify access token cache
let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;

// Initialize view count
let viewCount = 0;
if (fs.existsSync(VIEWS_FILE)) {
    try {
        const data = fs.readFileSync(VIEWS_FILE, 'utf8');
        viewCount = JSON.parse(data).count || 0;
    } catch (e) {
        console.error('Error reading views file:', e);
    }
}

// Initialize viewed IPs set
let viewedIPs = new Set();
if (fs.existsSync(VIEWED_IPS_FILE)) {
    try {
        const data = fs.readFileSync(VIEWED_IPS_FILE, 'utf8');
        if (data.trim()) {
            const ips = JSON.parse(data);
            if (Array.isArray(ips)) {
                viewedIPs = new Set(ips);
                console.log(`📊 Loaded ${viewedIPs.size} unique IP addresses from previous sessions`);
            } else {
                console.warn('⚠️ Viewed IPs file is not a valid array, starting fresh');
            }
        }
    } catch (e) {
        console.error('Error reading viewed IPs file:', e);
        console.log('Starting with empty IP set');
    }
} else {
    console.log('📊 No existing viewed IPs file, starting fresh');
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

// Get client IP address (handles proxies)
function getClientIP(req) {
    // Check various headers for the real IP (in order of preference)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }
    
    const realIP = req.headers['x-real-ip'];
    if (realIP) {
        return realIP;
    }
    
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    if (cfConnectingIP) {
        return cfConnectingIP;
    }
    
    // Fallback to connection remote address
    return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || 'unknown';
}

// Redirect any .html extension to clean URL (BEFORE static files)
// This ensures .html files are redirected before static middleware serves them
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.replace(/\.html$/, '');
        return res.redirect(301, cleanPath || '/');
    }
    next();
});

// API Routes - MUST come BEFORE static file middleware
// Log all API requests for debugging
app.use('/api', (req, res, next) => {
    console.log(`📥 [API MIDDLEWARE] ${req.method} ${req.path} from ${req.ip || 'unknown'}`);
    console.log(`   Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    console.log(`   Server PORT: ${PORT}`);
    next();
});

// Simple test endpoint to verify routing works
app.get('/api/test', (req, res) => {
    console.log('✅ /api/test endpoint called');
    res.json({ 
        status: 'ok', 
        message: 'API routes are working!',
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
    });
});

// Increment view count endpoint (IP-based tracking)
// IMPORTANT: This route MUST be registered before static middleware
app.get('/api/views/hit', (req, res) => {
    try {
        const clientIP = getClientIP(req);
        console.log(`📥 [VIEW COUNTER] GET /api/views/hit from IP: ${clientIP}`);
        console.log(`   Server port: ${PORT}, Request host: ${req.get('host')}`);
        
        // Check if this IP has already been counted
        if (viewedIPs.has(clientIP)) {
            console.log(`ℹ️ IP ${clientIP} already viewed, not incrementing count`);
            return res.json({ 
                count: viewCount, 
                newView: false,
                message: 'Already counted'
            });
        }
        
        // New IP - increment count and add to set
        viewedIPs.add(clientIP);
        viewCount++;
        saveViews();
        saveViewedIPs();
        
        console.log(`✅ New view from IP ${clientIP}, count incremented to: ${viewCount} (${viewedIPs.size} unique IPs)`);
        res.json({ 
            count: viewCount, 
            newView: true,
            uniqueIPs: viewedIPs.size
        });
    } catch (error) {
        console.error('❌ Error in /api/views/hit:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to increment view count', count: viewCount });
    }
});

// Get current view count endpoint
// IMPORTANT: This route MUST be registered before static middleware
app.get('/api/views', (req, res) => {
    try {
        console.log(`📥 [VIEW COUNTER] GET /api/views`);
        console.log(`   Server port: ${PORT}, Request host: ${req.get('host')}`);
        console.log(`✅ Returning view count: ${viewCount}`);
        res.json({ count: viewCount });
    } catch (error) {
        console.error('❌ Error in /api/views:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to get view count', count: viewCount || 0 });
    }
});

// Log route registration (these are registered synchronously, so they're available immediately)
console.log('✅ View counter API routes defined:');
console.log('   - GET /api/views (get count)');
console.log('   - GET /api/views/hit (increment count)');

// Serve static files (CSS, JS, images) - AFTER API routes
// Priority: public_html (if exists) > public directory > app directory
// IMPORTANT: Skip static middleware for API routes

// Option 1: Serve from public_html if it exists (cPanel web root)
if (fs.existsSync(PUBLIC_HTML_DIR)) {
    console.log(`📁 Serving static files from public_html: ${PUBLIC_HTML_DIR}`);
    app.use((req, res, next) => {
        // Skip static middleware for API routes
        if (req.path.startsWith('/api')) {
            return next();
        }
        express.static(PUBLIC_HTML_DIR, {
            index: false,
            dotfiles: 'ignore',
            etag: true,
            lastModified: true
        })(req, res, next);
    });
}

// Option 2: Serve from public directory (primary location for local dev)
if (fs.existsSync(PUBLIC_DIR)) {
    console.log(`📁 Serving static files from public: ${PUBLIC_DIR}`);
    app.use((req, res, next) => {
        // Skip static middleware for API routes
        if (req.path.startsWith('/api')) {
            return next();
        }
        express.static(PUBLIC_DIR, {
            index: false,
            dotfiles: 'ignore',
            etag: true,
            lastModified: true
        })(req, res, next);
    });
}

// Option 3: Serve CSS and JS from root-level directories
if (fs.existsSync(CSS_DIR)) {
    app.use('/css', express.static(CSS_DIR, {
        dotfiles: 'ignore',
        etag: true,
        lastModified: true
    }));
}
if (fs.existsSync(JS_DIR)) {
    app.use('/js', express.static(JS_DIR, {
        dotfiles: 'ignore',
        etag: true,
        lastModified: true
    }));
}

// Option 4: Serve from app directory (fallback)
app.use((req, res, next) => {
    // Skip static middleware for API routes
    if (req.path.startsWith('/api')) {
        return next();
    }
    express.static(APP_DIR, {
        index: false,
        dotfiles: 'ignore',
        etag: true,
        lastModified: true
    })(req, res, next);
});

// Root route - serve index.html
app.get('/', (req, res) => {
    // Check public_html first, then public directory, then app directory
    let indexPath = null;
    if (fs.existsSync(path.join(PUBLIC_HTML_DIR, 'index.html'))) {
        indexPath = path.join(PUBLIC_HTML_DIR, 'index.html');
    } else if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
        indexPath = path.join(PUBLIC_DIR, 'index.html');
    } else if (fs.existsSync(path.join(APP_DIR, 'index.html'))) {
        indexPath = path.join(APP_DIR, 'index.html');
    }
    
    if (indexPath) {
        res.sendFile(path.resolve(indexPath));
    } else {
        res.status(404).send('index.html not found');
    }
});

// Blog route - serve blog.html
app.get('/blog', (req, res) => {
    // Check public_html first, then public directory, then app directory
    let blogPath = null;
    if (fs.existsSync(path.join(PUBLIC_HTML_DIR, 'blog.html'))) {
        blogPath = path.join(PUBLIC_HTML_DIR, 'blog.html');
    } else if (fs.existsSync(path.join(PUBLIC_DIR, 'blog.html'))) {
        blogPath = path.join(PUBLIC_DIR, 'blog.html');
    } else if (fs.existsSync(path.join(APP_DIR, 'blog.html'))) {
        blogPath = path.join(APP_DIR, 'blog.html');
    }
    
    if (blogPath) {
        res.sendFile(path.resolve(blogPath));
    } else {
        res.status(404).send('blog.html not found');
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        spotify: {
            configured: !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REFRESH_TOKEN),
            hasClientId: !!SPOTIFY_CLIENT_ID,
            hasSecret: !!SPOTIFY_CLIENT_SECRET,
            hasToken: !!SPOTIFY_REFRESH_TOKEN
        },
        appDir: APP_DIR,
        files: {
            index: fs.existsSync(path.join(APP_DIR, 'index.html')),
            appjs: fs.existsSync(path.join(APP_DIR, 'app.js')),
            styles: fs.existsSync(path.join(APP_DIR, 'styles.css')),
            nova: fs.existsSync(path.join(APP_DIR, 'nova.jpg'))
        }
    });
});

// Test endpoint to verify static files are accessible
app.get('/api/test-static', (req, res) => {
    const testFiles = {
        'index.html': fs.existsSync(path.join(APP_DIR, 'index.html')),
        'app.js': fs.existsSync(path.join(APP_DIR, 'app.js')),
        'styles.css': fs.existsSync(path.join(APP_DIR, 'styles.css')),
        'nova.jpg': fs.existsSync(path.join(APP_DIR, 'nova.jpg')),
        'server.js': fs.existsSync(path.join(APP_DIR, 'server.js'))
    };
    
    res.json({
        appDir: APP_DIR,
        files: testFiles,
        allExist: Object.values(testFiles).every(exists => exists)
    });
});

// Spotify API Functions
async function getSpotifyAccessToken() {
    if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) {
        return spotifyAccessToken;
    }

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
        throw new Error('Spotify credentials not configured');
    }

    try {
        console.log('🔄 Refreshing Spotify access token...');
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
        spotifyTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 min early
        console.log('✅ Spotify access token refreshed');
        return spotifyAccessToken;
    } catch (error) {
        console.error('❌ Error getting Spotify access token:', error.response?.data || error.message);
        console.error('   Status:', error.response?.status);
        throw error;
    }
}

// Spotify API Endpoints
app.get('/api/spotify/now-playing', async (req, res) => {
    console.log('📡 Spotify now-playing endpoint hit');
    try {
        // Check if credentials are configured
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
            console.error('❌ Spotify credentials missing');
            console.error('   SPOTIFY_CLIENT_ID:', SPOTIFY_CLIENT_ID ? 'Set' : 'MISSING');
            console.error('   SPOTIFY_CLIENT_SECRET:', SPOTIFY_CLIENT_SECRET ? 'Set' : 'MISSING');
            console.error('   SPOTIFY_REFRESH_TOKEN:', SPOTIFY_REFRESH_TOKEN ? 'Set' : 'MISSING');
            console.error('   NOTE: For cPanel, set these in Node.js → Environment Variables, not .env file');
            return res.status(500).json({
                error: 'Spotify credentials not configured',
                details: 'Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN in cPanel → Node.js → Environment Variables',
                hint: 'cPanel Node.js apps do not automatically load .env files. Use the Environment Variables section in cPanel and RESTART the app after setting them.'
            });
        }

        console.log('✅ Spotify credentials found, getting access token...');
        let token;
        try {
            token = await getSpotifyAccessToken();
            console.log('✅ Access token obtained, fetching now-playing...');
        } catch (tokenError) {
            console.error('❌ Failed to get access token:', tokenError.message);
            return res.status(500).json({
                error: 'Failed to authenticate with Spotify',
                details: tokenError.message
            });
        }
        
        let response;
        try {
            response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                validateStatus: function (status) {
                    // Don't throw error for 204 (no content)
                    return status >= 200 && status < 300 || status === 204;
                }
            });
        } catch (apiError) {
            console.error('❌ Spotify API request failed:', apiError.message);
            console.error('   Response:', apiError.response?.data);
            console.error('   Status:', apiError.response?.status);
            
            // Handle 204 (no content) as not playing, not an error
            if (apiError.response?.status === 204) {
                return res.json({ isPlaying: false, item: null });
            }
            
            // Handle 401 (unauthorized) - token expired or invalid
            if (apiError.response?.status === 401) {
                spotifyAccessToken = null; // Force token refresh
                return res.status(401).json({
                    error: 'Spotify authentication failed. Please check your refresh token.',
                    details: apiError.response?.data?.error?.message || apiError.message
                });
            }
            
            // Handle 403 (forbidden) - might be a scope issue
            if (apiError.response?.status === 403) {
                return res.status(403).json({
                    error: 'Spotify access forbidden. Check your app permissions.',
                    details: apiError.response?.data?.error?.message || apiError.message
                });
            }
            
            throw apiError; // Re-throw to be caught by outer catch
        }

        // Handle 204 (no content) - nothing is playing
        if (response.status === 204 || !response.data) {
            console.log('ℹ️ No track currently playing (204 or empty response)');
            return res.json({ isPlaying: false, item: null });
        }

        // Validate response data
        if (!response.data || !response.data.item) {
            console.log('ℹ️ Response received but no track data');
            return res.json({ isPlaying: false, item: null });
        }

        console.log('✅ Track found:', response.data.item.name);
        return res.json({
            isPlaying: response.data.is_playing || false,
            item: response.data.item,
            progress_ms: response.data.progress_ms,
        });
    } catch (error) {
        console.error('❌ Spotify now-playing unexpected error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        
        // Make sure we always send a response
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Internal server error while fetching Spotify data',
                details: error.message
            });
        }
    }
});

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || '';

// Helper function to parse RSS XML and extract videos
function parseYouTubeRSS(xml) {
    const videos = [];
    const videoMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    
    for (const match of videoMatches) {
        const entry = match[1];
        const titleMatch = entry.match(/<title>(.*?)<\/title>/);
        const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
        const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
        const mediaThumbnailMatch = entry.match(/<media:thumbnail url="(.*?)"/);
        
        if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            let title = titleMatch ? titleMatch[1] : 'Untitled';
            // Remove CDATA wrapper if present
            title = title.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim();
            const published = publishedMatch ? publishedMatch[1] : '';
            const thumbnail = mediaThumbnailMatch ? mediaThumbnailMatch[1] : '';
            
            videos.push({
                id: videoId,
                title: title,
                published: published,
                thumbnail: thumbnail,
                url: `https://www.youtube.com/watch?v=${videoId}`
            });
        }
    }
    
    return videos;
}

// Helper function to enrich videos with statistics from YouTube API
async function enrichVideosWithStats(videos) {
    if (!YOUTUBE_API_KEY || videos.length === 0) {
        return videos;
    }
    
    try {
        const videoIds = videos.map(v => v.id).join(',');
        const statsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                part: 'statistics,snippet',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });
        
        const statsMap = {};
        if (statsResponse.data.items) {
            statsResponse.data.items.forEach(item => {
                statsMap[item.id] = {
                    viewCount: parseInt(item.statistics.viewCount || '0'),
                    likeCount: parseInt(item.statistics.likeCount || '0'),
                    description: item.snippet.description || ''
                };
            });
        }
        
        videos.forEach(video => {
            if (statsMap[video.id]) {
                video.viewCount = statsMap[video.id].viewCount;
                video.likeCount = statsMap[video.id].likeCount;
            }
        });
    } catch (err) {
        console.log('⚠️ Could not fetch video statistics:', err.message);
    }
    
    return videos;
}

// YouTube API Endpoints
app.get('/api/youtube/videos', async (req, res) => {
    console.log('📡 YouTube videos endpoint hit');
    
    // Disable caching for this endpoint
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    try {
        // If we have API key, use YouTube Data API directly (more accurate and up-to-date)
        if (YOUTUBE_API_KEY) {
            let channelId = YOUTUBE_CHANNEL_ID;
            
            // Get channel ID from handle if not provided
            if (!channelId) {
                try {
                    const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
                        params: {
                            part: 'id,contentDetails',
                            forHandle: '128bytes8',
                            key: YOUTUBE_API_KEY
                        }
                    });
                    
                    if (channelResponse.data.items && channelResponse.data.items.length > 0) {
                        channelId = channelResponse.data.items[0].id;
                        console.log('✅ Found channel ID:', channelId);
                    }
                } catch (err) {
                    console.log('⚠️ Could not get channel ID from handle:', err.message);
                }
            }
            
            // If we have channel ID, get uploads playlist
            if (channelId && channelId.startsWith('UC')) {
                try {
                    // Get channel details including uploads playlist ID
                    const channelDetails = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
                        params: {
                            part: 'contentDetails',
                            id: channelId,
                            key: YOUTUBE_API_KEY
                        }
                    });
                    
                    let uploadsPlaylistId = null;
                    if (channelDetails.data.items && channelDetails.data.items.length > 0) {
                        uploadsPlaylistId = channelDetails.data.items[0].contentDetails?.relatedPlaylists?.uploads;
                    }
                    
                    if (uploadsPlaylistId) {
                        // Get videos from uploads playlist
                        const playlistResponse = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
                            params: {
                                part: 'snippet,contentDetails',
                                playlistId: uploadsPlaylistId,
                                maxResults: 50,
                                key: YOUTUBE_API_KEY
                            }
                        });
                        
                        if (playlistResponse.data.items && playlistResponse.data.items.length > 0) {
                            // Get video IDs
                            const videoIds = playlistResponse.data.items
                                .map(item => item.contentDetails?.videoId)
                                .filter(id => id);
                            
                            if (videoIds.length > 0) {
                                // Get video details with statistics and status
                                const videosResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                                    params: {
                                        part: 'snippet,statistics,status',
                                        id: videoIds.join(','),
                                        key: YOUTUBE_API_KEY
                                    }
                                });
                                
                                // Filter out deleted, private, or unlisted videos
                                const videos = videosResponse.data.items
                                    .filter(item => {
                                        // Only include public videos that are not deleted
                                        const status = item.status;
                                        const isPublic = status.privacyStatus === 'public';
                                        const isUploaded = status.uploadStatus === 'processed' || status.uploadStatus === 'uploaded';
                                        return isPublic && isUploaded;
                                    })
                                    .map(item => ({
                                        id: item.id,
                                        title: item.snippet.title,
                                        published: item.snippet.publishedAt,
                                        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
                                        url: `https://www.youtube.com/watch?v=${item.id}`,
                                        viewCount: parseInt(item.statistics.viewCount || '0'),
                                        likeCount: parseInt(item.statistics.likeCount || '0')
                                    }));
                                
                                console.log(`✅ Fetched ${videos.length} public videos from YouTube Data API (filtered out deleted/private)`);
                                return res.json({ videos: videos });
                            }
                        }
                    }
                } catch (apiError) {
                    console.error('⚠️ YouTube Data API error, falling back to RSS:', apiError.message);
                }
            }
        }
        
        // Fallback to RSS feed if API key method fails or no API key
        let channelId = YOUTUBE_CHANNEL_ID;
        let rssUrl = '';
        
        if (channelId && channelId.startsWith('UC')) {
            rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        } else {
            rssUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=@128bytes8';
        }
        
        console.log('📡 Fetching RSS feed from:', rssUrl);
        const rssResponse = await axios.get(rssUrl, {
            headers: {
                'Accept': 'application/xml, text/xml',
                'User-Agent': 'Mozilla/5.0',
                'Cache-Control': 'no-cache'
            }
        });
        
        // Parse RSS XML
        const videos = parseYouTubeRSS(rssResponse.data);
        
        if (videos.length === 0) {
            return res.json({ 
                videos: [],
                message: 'No videos found.'
            });
        }
        
        // Enrich with statistics if we have API key
        const enrichedVideos = await enrichVideosWithStats(videos);
        
        res.json({ videos: enrichedVideos.slice(0, 50) });
    } catch (error) {
        console.error('❌ YouTube videos error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch YouTube videos',
            details: error.message
        });
    }
});

app.get('/api/spotify/recently-played', async (req, res) => {
    console.log('📡 Spotify recently-played endpoint hit');
    try {
        // Check if credentials are configured
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
            console.error('❌ Spotify credentials missing');
            console.error('   SPOTIFY_CLIENT_ID:', SPOTIFY_CLIENT_ID ? 'Set' : 'MISSING');
            console.error('   SPOTIFY_CLIENT_SECRET:', SPOTIFY_CLIENT_SECRET ? 'Set' : 'MISSING');
            console.error('   SPOTIFY_REFRESH_TOKEN:', SPOTIFY_REFRESH_TOKEN ? 'Set' : 'MISSING');
            console.error('   NOTE: For cPanel, set these in Node.js → Environment Variables, not .env file');
            return res.status(500).json({
                error: 'Spotify credentials not configured',
                details: 'Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN in cPanel → Node.js → Environment Variables',
                hint: 'cPanel Node.js apps do not automatically load .env files. Use the Environment Variables section in cPanel and RESTART the app after setting them.'
            });
        }

        console.log('✅ Spotify credentials found, getting access token...');
        const token = await getSpotifyAccessToken();
        console.log('✅ Access token obtained, fetching recently-played...');
        
        const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        console.log('✅ Recently played tracks fetched:', response.data.items?.length || 0);
        res.json(response.data);
    } catch (error) {
        console.error('❌ Spotify recently-played error:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            spotifyAccessToken = null; // Force token refresh
            return res.status(401).json({
                error: 'Spotify authentication failed. Please check your refresh token.',
                details: error.response?.data?.error?.message || error.message
            });
        }
        
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || 'Failed to fetch recently played tracks',
            details: error.message
        });
    }
});

// Serve .html files without extension (e.g., /leaks serves leaks.html)
// This catch-all must come AFTER all API routes but BEFORE 404
app.get('/:page', (req, res, next) => {
    // CRITICAL: Skip API routes - they should never reach this handler
    if (req.path.startsWith('/api')) {
        console.error(`❌ ERROR: API route ${req.path} reached catch-all handler! This should never happen.`);
        return next(); // Let it fall through to 404
    }
    
    const page = req.params.page;
    
    // Skip if it has a file extension or is a static file
    if (page.includes('.')) {
        return next();
    }
    
    // Check public_html first, then public directory, then app directory
    let htmlPath = null;
    if (fs.existsSync(path.join(PUBLIC_HTML_DIR, `${page}.html`))) {
        htmlPath = path.join(PUBLIC_HTML_DIR, `${page}.html`);
    } else if (fs.existsSync(path.join(PUBLIC_DIR, `${page}.html`))) {
        htmlPath = path.join(PUBLIC_DIR, `${page}.html`);
    } else if (fs.existsSync(path.join(APP_DIR, `${page}.html`))) {
        htmlPath = path.join(APP_DIR, `${page}.html`);
    }
    
    if (htmlPath) {
        res.sendFile(htmlPath);
    } else {
        next(); // Continue to next middleware/404
    }
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 404 handler (must be after all routes)
app.use((req, res) => {
    // Log 404s for API routes to help debug
    if (req.path.startsWith('/api')) {
        console.error(`❌ 404 for API route: ${req.method} ${req.path}`);
        console.error(`   Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
        console.error(`   Server PORT: ${PORT}`);
        console.error(`   This means the route was not registered or was blocked`);
        console.error(`   Available routes should include: /api/test, /api/views, /api/views/hit`);
    }
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method,
        serverPort: PORT
    });
});

// Verify all routes are registered before starting server
function verifyRoutes() {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase()).join(', ');
            routes.push(`${methods} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase()).join(', ');
                    routes.push(`${methods} ${handler.route.path}`);
                }
            });
        }
    });
    
    console.log(`\n✅ Registered Routes (${routes.length} total):`);
    routes.filter(r => r.includes('/api')).forEach(route => {
        console.log(`   ${route}`);
    });
    
    // Verify critical routes exist
    const criticalRoutes = ['/api/test', '/api/views', '/api/views/hit'];
    const foundRoutes = routes.map(r => r.split(' ')[1]);
    const missing = criticalRoutes.filter(r => !foundRoutes.includes(r));
    
    if (missing.length > 0) {
        console.error(`\n❌ WARNING: Missing critical routes: ${missing.join(', ')}`);
    } else {
        console.log(`\n✅ All critical API routes are registered!`);
    }
}

// Listen on all interfaces for web hosting
// cPanel Node.js apps typically listen on the port provided by the environment
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bio Site Server running on port ${PORT}`);
    console.log(`📁 App directory: ${APP_DIR}`);
    console.log(`📁 Public HTML directory: ${PUBLIC_HTML_DIR} ${fs.existsSync(PUBLIC_HTML_DIR) ? '✅' : '❌ (not found)'}`);
    console.log(`📊 Current view count: ${viewCount} (${viewedIPs.size} unique IPs)`);
    console.log(`🌐 Server accessible at: http://0.0.0.0:${PORT}`);
    console.log(`⚠️ IMPORTANT: This server should handle the main domain (r3dg0d.net)`);
    
    // Verify routes are registered
    verifyRoutes();
    
    // Check if required files exist in both locations
    const checkFile = (filename, dir) => {
        const filePath = path.join(dir, filename);
        return { exists: fs.existsSync(filePath), path: filePath };
    };
    
    const filesToCheck = ['index.html', 'app.js', 'styles.css', 'nova.jpg'];
    
    console.log(`\n📄 Files check (App Directory):`);
    filesToCheck.forEach(filename => {
        const result = checkFile(filename, APP_DIR);
        console.log(`   ${filename}: ${result.exists ? '✅' : '❌'}`);
    });
    
    if (fs.existsSync(PUBLIC_HTML_DIR)) {
        console.log(`\n📄 Files check (Public HTML):`);
        filesToCheck.forEach(filename => {
            const result = checkFile(filename, PUBLIC_HTML_DIR);
            console.log(`   ${filename}: ${result.exists ? '✅' : '❌'}`);
        });
    }
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.warn('\n⚠️  Spotify credentials not configured. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN in .env');
    } else {
        console.log('\n✅ Spotify credentials configured');
    }
    
    console.log('\n🎉 Server ready!');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit - let the process manager restart it
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - let the process manager restart it
});

