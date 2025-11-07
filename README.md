# r3dg0d.net

Retro-styled personal bio site with CRT shader effects, animated snowfall, and real-time Spotify integration.

## Features

- 🎨 Retro CRT monitor aesthetic with scanline effects
- ❄️ Animated ASCII snowfall effect
- 🎵 Real-time Spotify integration (now playing & recently played)
- 📊 Live view counter
- 🔗 Social media links

## Project Structure

```
r3dg0d.net/
├── public/          # Static HTML files and assets
│   ├── index.html
│   ├── blog.html
│   ├── leaks.html
│   ├── favicon.jpg
│   └── nova.jpg
├── css/             # Stylesheets
│   └── styles.css
├── js/              # Frontend JavaScript
│   └── app.js
└── server/          # Node.js backend
    ├── server.js
    ├── simple-bot.js
    ├── index.js
    ├── package.json
    └── check-bot-files.js
```

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Spotify API credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/r3dg0d/r3dg0d.net.git
cd r3dg0d.net
```

2. Install dependencies:
```bash
cd server
npm install
```

3. Configure environment variables:
Create a `.env` file in the `server/` directory:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token
```

### Running the Server

```bash
cd server
npm start
```

The server will start on port 3000 (or the port specified by the `PORT` environment variable).

## API Endpoints

- `GET /api/spotify/now-playing` - Get currently playing track
- `GET /api/spotify/recently-played` - Get recently played tracks
- `GET /api/views` - Get view count
- `POST /api/views/hit` - Increment view count

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **APIs**: Spotify Web API

## License

MIT

## Author

r3dg0d - [GitHub](https://github.com/r3dg0d) | [Website](https://r3dg0d.net)

