# Fixing 503 Service Unavailable in cPanel

## The Problem

Your Node.js app is running, but `/api/health` returns 503. This happens because cPanel Node.js applications handle routing differently than a standard Apache setup.

## Solution: Remove Apache Proxy

In cPanel, Node.js apps handle ALL routing directly. The `.htaccess` proxy is causing conflicts.

### Step 1: Comment Out Proxy in .htaccess

I've already commented out the proxy rules in `.htaccess`. The file should now have:

```apache
# Proxy API requests to Node.js server
# Note: In cPanel, Node.js apps handle routing directly, so this may not be needed
# If you get 503 errors, comment out these lines and let Node.js handle everything
# RewriteCond %{REQUEST_URI} ^/api/ [NC]
# RewriteRule ^(.*)$ http://localhost:3000%{REQUEST_URI} [P,L]
```

### Step 2: Verify Node.js App Configuration

In cPanel Node.js Applications:
1. **Application URL** should be: `r3dg0d.net` (or your domain)
2. **Application root** should be: `server`
3. **Application startup file** should be: `server.js`
4. Make sure the app shows as **"Running"** (green status)

### Step 3: Check How cPanel Routes Requests

cPanel Node.js apps typically route ALL requests to your Node.js app automatically. Your `server.js` already handles:
- ✅ API routes (`/api/*`)
- ✅ Static files from `public_html`
- ✅ HTML pages

So the `.htaccess` proxy isn't needed.

### Step 4: Test Direct Access

Try accessing your API directly via the Node.js port:
- In cPanel, check what port your Node.js app is running on
- Try: `https://r3dg0d.net:PORT/api/health`
- If this works, cPanel routing is the issue

### Step 5: Alternative - Use cPanel's Built-in Proxy

Some cPanel setups require you to configure the proxy differently. Check if your hosting provider has specific instructions for Node.js apps.

### Step 6: Verify Environment Variables

Make sure PORT environment variable matches what cPanel assigned:
- Check in Node.js Applications → Your App → Environment Variables
- The PORT should match what cPanel shows in the app details

## Most Likely Fix

Since your Node.js app is running, the issue is probably:
1. **Apache proxy conflict** - Already fixed by commenting out `.htaccess` proxy
2. **cPanel routing** - cPanel should route all requests to Node.js automatically
3. **Port mismatch** - Check that PORT env var matches cPanel's assigned port

After uploading the updated `.htaccess` (with proxy commented out), restart your Node.js app in cPanel and test again.

