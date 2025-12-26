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
// Use public_html for cPanel deployment
const PUBLIC_DIR = path.join(ROOT_DIR, 'public_html');
const JS_DIR = path.join(ROOT_DIR, 'js');
const MUSIC_DIR = path.join(PUBLIC_DIR, 'music');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));

// Security headers (suppress Permissions-Policy warnings)
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

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
// Music Playlist (from .wav files)
// ============================================
const ALBUMARTS_DIR = path.join(PUBLIC_DIR, 'albumarts');

// Helper function to find album art (handles special characters)
function findAlbumArt(nameWithoutExt) {
    if (!fs.existsSync(ALBUMARTS_DIR)) {
        return '/favicon.jpg';
    }
    
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    try {
        // Get all files in albumarts directory
        const artFiles = fs.readdirSync(ALBUMARTS_DIR, { encoding: 'utf8' });
        
        // Try exact match first
        for (const ext of imageExts) {
            const targetName = nameWithoutExt + ext;
            if (artFiles.includes(targetName)) {
                return `/albumarts/${encodeURIComponent(targetName)}`;
            }
        }
        
        // Try case-insensitive match
        const nameLower = nameWithoutExt.toLowerCase();
        for (const artFile of artFiles) {
            const artNameLower = artFile.toLowerCase();
            const artNameWithoutExt = artNameLower.replace(/\.(jpg|jpeg|png|webp|gif)$/, '');
            if (artNameWithoutExt === nameLower) {
                return `/albumarts/${encodeURIComponent(artFile)}`;
            }
        }
        
        // Try partial match (in case filename has slight differences)
        for (const artFile of artFiles) {
            const artNameLower = artFile.toLowerCase();
            const artNameWithoutExt = artNameLower.replace(/\.(jpg|jpeg|png|webp|gif)$/, '');
            // Check if the base name matches (ignoring special character variations)
            if (artNameWithoutExt.includes(nameLower) || nameLower.includes(artNameWithoutExt)) {
                return `/albumarts/${encodeURIComponent(artFile)}`;
            }
        }
    } catch (error) {
        console.error(`Error finding album art for ${nameWithoutExt}:`, error.message);
    }
    
    return '/favicon.jpg';
}

app.get('/api/music/playlist', (req, res) => {
    try {
        console.log(`🎵 Checking music directory: ${MUSIC_DIR}`);
        console.log(`📁 Public directory: ${PUBLIC_DIR}`);
        console.log(`📁 App directory: ${APP_DIR}`);
        console.log(`📁 Root directory: ${ROOT_DIR}`);
        
        if (!fs.existsSync(MUSIC_DIR)) {
            console.log(`⚠️ Music directory doesn't exist: ${MUSIC_DIR}`);
            console.log(`   Attempting to create it...`);
            try {
                fs.mkdirSync(MUSIC_DIR, { recursive: true });
                console.log(`   ✅ Created music directory`);
            } catch (mkdirError) {
                console.error(`   ❌ Failed to create directory: ${mkdirError.message}`);
            }
            return res.json({ tracks: [], message: 'Music directory not found', path: MUSIC_DIR });
        }
        
        // Ensure albumarts directory exists
        if (!fs.existsSync(ALBUMARTS_DIR)) {
            fs.mkdirSync(ALBUMARTS_DIR, { recursive: true });
        }
        
        // Read directory with proper encoding handling
        const files = fs.readdirSync(MUSIC_DIR, { encoding: 'utf8' });
        console.log(`📂 Found ${files.length} total files in music directory`);
        
        const audioFiles = files.filter(file => {
            try {
                const ext = path.extname(file).toLowerCase();
                const isAudio = ['.wav', '.mp3', '.ogg', '.flac', '.m4a'].includes(ext);
                if (!isAudio) {
                    console.log(`   ⚠️ Skipping non-audio file: ${file}`);
                }
                return isAudio;
            } catch (e) {
                console.error(`   ❌ Error processing file ${file}:`, e.message);
                return false;
            }
        });
        
        console.log(`🎶 Found ${audioFiles.length} audio files`);
        if (audioFiles.length > 0) {
            console.log(`   Sample: ${audioFiles[0]}`);
        }
        
        const tracks = audioFiles.map((file, index) => {
            try {
                // Handle special characters in filename
                // Get filename without extension, preserving special characters
                const ext = path.extname(file);
                const nameWithoutExt = file.slice(0, file.length - ext.length);
                
                let title = nameWithoutExt;
                let artist = 'Unknown Artist';
                
                // Try to split on " - " (space dash space) for artist - title format
                // Use a more robust splitting method that handles special characters
                const dashIndex = nameWithoutExt.indexOf(' - ');
                if (dashIndex !== -1) {
                    artist = nameWithoutExt.substring(0, dashIndex).trim();
                    title = nameWithoutExt.substring(dashIndex + 3).trim();
                } else {
                    // Try comma separation (Artist, Title format)
                    const commaIndex = nameWithoutExt.indexOf(', ');
                    if (commaIndex !== -1) {
                        artist = nameWithoutExt.substring(0, commaIndex).trim();
                        title = nameWithoutExt.substring(commaIndex + 2).trim();
                    }
                }
                
                // Look for album art in albumarts/ folder (handle special chars in search)
                const cover = findAlbumArt(nameWithoutExt);
                
                // Properly encode the filename for URL
                const encodedFile = encodeURIComponent(file);
                
                return {
                    id: index,
                    title: title || nameWithoutExt,
                    artist: artist || 'Unknown Artist',
                    url: `/music/${encodedFile}`,
                    cover: cover,
                    filename: file // Keep original filename for reference
                };
            } catch (error) {
                console.error(`❌ Error processing track ${file}:`, error.message);
                // Return a safe fallback
                return {
                    id: index,
                    title: file.replace(/\.[^/.]+$/, ''), // Remove extension
                    artist: 'Unknown Artist',
                    url: `/music/${encodeURIComponent(file)}`,
                    cover: '/favicon.jpg',
                    filename: file
                };
            }
        }).filter(track => track !== null); // Remove any null entries
        
        // Shuffle playlist
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        
        console.log(`✅ Returning ${tracks.length} tracks`);
        res.json({ tracks: tracks });
    } catch (error) {
        console.error('❌ Error loading playlist:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to load playlist', 
            message: error.message,
            tracks: [] 
        });
    }
});




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

// Serve static files (API routes are already defined above, so they take precedence)
if (fs.existsSync(PUBLIC_DIR)) {
    // Serve static files with proper encoding for special characters
    app.use(express.static(PUBLIC_DIR, { 
        index: false,
        dotfiles: 'ignore',
        setHeaders: (res, path) => {
            // Ensure proper content-type for audio files
            if (path.endsWith('.wav')) {
                res.setHeader('Content-Type', 'audio/wav');
            } else if (path.endsWith('.mp3')) {
                res.setHeader('Content-Type', 'audio/mpeg');
            }
            // Enable CORS for audio files
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    }));
}
// Serve JS files - check both js directory and public_html/js
if (fs.existsSync(JS_DIR)) {
    app.use('/js', express.static(JS_DIR));
} else {
    // Fallback: serve from public_html/js if js directory doesn't exist at root
    const publicJsDir = path.join(PUBLIC_DIR, 'js');
    if (fs.existsSync(publicJsDir)) {
        app.use('/js', express.static(publicJsDir));
    }
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

const htmlPages = ['blog', 'contact'];
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
        paths: {
            appDir: APP_DIR,
            rootDir: ROOT_DIR,
            publicDir: PUBLIC_DIR,
            musicDir: MUSIC_DIR,
            musicDirExists: fs.existsSync(MUSIC_DIR)
        }
    });
});

// Debug endpoint for music directory
app.get('/api/music/debug', (req, res) => {
    try {
        const debug = {
            appDir: APP_DIR,
            rootDir: ROOT_DIR,
            publicDir: PUBLIC_DIR,
            musicDir: MUSIC_DIR,
            musicDirExists: fs.existsSync(MUSIC_DIR),
            publicDirExists: fs.existsSync(PUBLIC_DIR),
            files: []
        };
        
        if (fs.existsSync(MUSIC_DIR)) {
            try {
                debug.files = fs.readdirSync(MUSIC_DIR);
            } catch (e) {
                debug.readError = e.message;
            }
        }
        
        res.json(debug);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
    console.log(`📁 App directory: ${APP_DIR}`);
    console.log(`📁 Root directory: ${ROOT_DIR}`);
    console.log(`📁 Public directory: ${PUBLIC_DIR}`);
    console.log(`🎵 Music directory: ${MUSIC_DIR}`);
    console.log(`📁 Music directory exists: ${fs.existsSync(MUSIC_DIR)}`);
    if (fs.existsSync(MUSIC_DIR)) {
        try {
            const musicFiles = fs.readdirSync(MUSIC_DIR);
            console.log(`🎶 Music files found: ${musicFiles.length}`);
            if (musicFiles.length > 0) {
                console.log(`   Sample files: ${musicFiles.slice(0, 3).join(', ')}`);
            }
        } catch (e) {
            console.log(`   Error reading music directory: ${e.message}`);
        }
    }
    console.log(`📊 View count: ${viewCount} (${viewedIPs.size} unique IPs)`);
    console.log(`\n🌐 Server ready at http://localhost:${PORT}`);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

