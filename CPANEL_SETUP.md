# cPanel Setup Instructions for r3dg0d.net

## Current File Structure in cPanel

Based on your cPanel file manager:

```
/home/kbrpzswh/
├── public_html/          # Static files (HTML, CSS, images, etc.)
│   ├── albumarts/
│   ├── fonts/
│   ├── music/
│   ├── .htaccess
│   ├── blog.html
│   ├── favicon.jpg
│   ├── index.html
│   ├── nova.jpg
│   ├── spotify.html
│   ├── styles.css
│   └── youtube.html
└── server/               # Node.js application
    ├── .env
    ├── app.js           # ⚠️ This should be in public_html/js/
    ├── node_modules/
    ├── package.json
    ├── package-lock.json
    ├── server.js        # ✅ Updated to use public_html
    ├── stderr.log
    ├── viewed_ips.json
    └── views.json
```

## Issues Fixed

1. ✅ **Updated `server.js`** to look for files in `public_html` instead of `public`
2. ✅ **Updated paths** to match cPanel structure

## Action Required: Move app.js

Your `app.js` file is currently in the `server/` directory, but your HTML files reference `/js/app.js`.

**You need to:**

1. **Create a `js` directory in `public_html`:**
   - In cPanel File Manager, navigate to `public_html`
   - Click "+ Folder" and create a folder named `js`

2. **Move `app.js` to `public_html/js/`:**
   - Navigate to `server/` directory
   - Select `app.js`
   - Click "Move"
   - Enter destination: `../public_html/js/`
   - Or use "Copy" then "Delete" the original

**Final structure should be:**
```
public_html/
├── js/
│   └── app.js          # ✅ Moved here
├── albumarts/
├── fonts/
├── music/
└── ... (other files)
```

## Node.js Application Configuration

Your current configuration looks correct:

- **Node.js version:** 24.6.0 ✅
- **Application mode:** Production ✅
- **Application root:** `server` ✅
- **Application URL:** `r3dg0d.net` ✅
- **Application startup file:** `server.js` ✅

## Environment Variables

All your environment variables are set correctly:
- ✅ PORT
- ✅ DISCORD_USER_ID
- ✅ SPOTIFY_CLIENT_ID
- ✅ SPOTIFY_CLIENT_SECRET
- ✅ SPOTIFY_REFRESH_TOKEN
- ✅ YOUTUBE_API_KEY

## After Moving app.js

1. **Click "SAVE"** in the Node.js application configuration
2. **Restart the application** if needed
3. **Test the site** - all JavaScript should now load correctly

## .htaccess Configuration

Your `.htaccess` file in `public_html` is already configured to:
- Proxy `/api/*` requests to Node.js server
- Handle clean URLs (remove .html extensions)
- Set security headers
- Enable compression and caching

The API proxy should work correctly once the Node.js app is running.

