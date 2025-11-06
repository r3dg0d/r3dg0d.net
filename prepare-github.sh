#!/bin/bash
# Script to prepare files for GitHub Pages deployment

echo "🚀 Preparing files for GitHub Pages..."

# Copy and rename files
cp index-static.html index.html
cp app-static.js app.js
cp README_GITHUB.md README.md

echo "✅ Files prepared:"
echo "   - index-static.html → index.html"
echo "   - app-static.js → app.js"
echo "   - README_GITHUB.md → README.md"
echo ""
echo "📦 Files ready for GitHub Pages:"
echo "   - index.html"
echo "   - app.js (API URL: http://4r3dg0d34.dedimc.io:5000)"
echo "   - styles.css"
echo "   - nova.jpg"
echo "   - README.md"
echo ""
echo "🌐 Domain file ready:"
echo "   - domains/r3dg0d.json (email: r3dg0d@protonmail.com)"
echo ""
echo "Next steps:"
echo "1. Initialize git: git init"
echo "2. Add files: git add index.html app.js styles.css nova.jpg README.md"
echo "3. Commit: git commit -m 'Initial bio site'"
echo "4. Add remote: git remote add origin https://github.com/r3dg0d/r3dg0d.github.io.git"
echo "5. Push: git push -u origin main"
echo ""
echo "Then fork is-a-dev/register and add domains/r3dg0d.json"

