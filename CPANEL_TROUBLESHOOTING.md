# cPanel Troubleshooting - 503 Service Unavailable

## Issue: All API endpoints returning 503

The 503 errors indicate that Apache can't proxy requests to your Node.js server.

## Possible Causes & Solutions

### 1. Node.js Application Not Running

**Check:**
- In cPanel, go to **Node.js Applications**
- Find your `r3dg0d.net` application
- Check if it shows as "Running" (green status)
- If not, click "START" or "RESTART"

### 2. Wrong Port in .htaccess

The `.htaccess` file proxies to `localhost:3000`, but cPanel Node.js apps might use a different port.

**Check the actual port:**
- In cPanel Node.js Applications, look at your app details
- Note the port number (might be different from 3000)
- Update `.htaccess` line 19 to use the correct port:

```apache
RewriteRule ^(.*)$ http://localhost:PORT_NUMBER%{REQUEST_URI} [P,L]
```

Replace `PORT_NUMBER` with your actual port.

### 3. Proxy Module Not Enabled

Apache needs `mod_proxy` and `mod_proxy_http` enabled.

**Check with your hosting provider** - these modules need to be enabled server-side.

### 4. Alternative: Serve APIs Directly from Node.js

If proxying doesn't work, you can configure Node.js to serve everything:

**Update `server.js` to serve all routes:**
- The server already serves static files from `public_html`
- Make sure it's listening on the port cPanel assigned
- Remove or comment out the `.htaccess` proxy rules

### 5. Check Server Logs

**In cPanel:**
- Go to **Node.js Applications** → Your app → **View Logs**
- Check `stderr.log` for errors
- Look for port binding errors or startup issues

### 6. Verify Environment Variables

Make sure all required environment variables are set in cPanel:
- PORT (should match what cPanel assigned)
- DISCORD_USER_ID
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET
- SPOTIFY_REFRESH_TOKEN
- YOUTUBE_API_KEY

## Quick Fix: Test Direct Access

Try accessing your API directly:
- `https://r3dg0d.net:PORT/api/health` (replace PORT with your Node.js port)
- If this works, the issue is with the proxy
- If this doesn't work, the Node.js app isn't running correctly

## Permissions-Policy Warnings

These are harmless browser warnings. They're already suppressed in `server.js` with a Permissions-Policy header. You can ignore them - they don't affect functionality.

