# r3dg0d.net - Bio Site

A personal bio site featuring a clean dark aesthetic with starfield background, music player, Discord presence, and more.

## Features

- **Modern Dark Design** - Sleek, minimal card-based layout with starfield background
- **Tab Navigation** - Home, Projects, Contact tabs in the main card
- **Discord Presence** - Shows online/offline/DnD status via Lanyard API
- **Music Player** - Plays .wav/.mp3 files from the music/ directory
- **View Counter** - IP-based unique visitor tracking
- **Spotify Integration** - Shows recently played tracks and now playing
- **YouTube Integration** - Displays your video uploads
- **Separate Blog Page** - Clean blog with expandable posts

## Pages

- `/` - Main bio card with tabs
- `/blog` - Blog posts
- `/spotify` - Spotify listening history
- `/youtube` - YouTube video uploads

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Port (optional, defaults to 3000)
PORT=3000

# Discord User ID (for Lanyard presence)
# Get your Discord ID: Right-click your profile -> Copy ID
DISCORD_USER_ID=YOUR_DISCORD_USER_ID

# Spotify API (optional)
SPOTIFY_CLIENT_ID=YOUR_SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET=YOUR_SPOTIFY_CLIENT_SECRET
SPOTIFY_REFRESH_TOKEN=YOUR_SPOTIFY_REFRESH_TOKEN

# YouTube API (optional)
YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY
YOUTUBE_CHANNEL_ID=YOUR_YOUTUBE_CHANNEL_ID
```

### 3. Discord Presence Setup

For Discord presence to work, your Discord user must be in the [Lanyard Discord server](https://discord.gg/lanyard).

### 4. Add Music

Place `.wav`, `.mp3`, `.ogg`, `.flac`, or `.m4a` files in `public/music/`.

Format filenames as: `Artist - Title.wav` or just `Title.wav`

### 5. Run the Server

```bash
cd server
npm start
```

Visit `http://localhost:3000`

## Project Structure

```
r3dg0d.net/
├── public/
│   ├── index.html      # Main page
│   ├── blog.html       # Blog page
│   ├── spotify.html    # Spotify history
│   ├── youtube.html    # YouTube videos
│   ├── styles.css      # All styles
│   ├── favicon.jpg     # Site icon
│   ├── music/          # Music files (.wav, .mp3, etc.)
│   └── fonts/          # Custom fonts
├── js/
│   └── app.js          # Frontend JavaScript
├── server/
│   ├── server.js       # Express server
│   ├── package.json    # Dependencies
│   ├── views.json      # View count storage
│   └── viewed_ips.json # Tracked IPs
└── README.md
```

## APIs

- `GET /api/views` - Get current view count
- `GET /api/views/hit` - Increment view count (IP-based)
- `GET /api/discord/presence` - Get Discord status via Lanyard
- `GET /api/music/playlist` - Get music playlist from music/ folder
- `GET /api/spotify/now-playing` - Currently playing track
- `GET /api/spotify/recently-played` - Recent listening history
- `GET /api/youtube/videos` - YouTube video list
- `GET /api/health` - Server health check

## Customization

### Colors

Edit CSS variables in `public/styles.css`:

```css
:root {
    --accent-green: #5dff8a;
    --accent-red: #ef4444;
    --accent-cyan: #22d3ee;
    /* ... */
}
```

### Content

Edit the HTML files directly to change:
- Name and title in `index.html`
- Contact links in `index.html`
- Blog posts in `blog.html`

## License

MIT

