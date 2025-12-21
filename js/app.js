// r3dg0d.net - Main Application JavaScript

// ============================================
// Configuration
// ============================================
const CONFIG = {
    apiBaseUrl: '',
    spotify: {
        updateInterval: 30000 // 30 seconds
    },
    discord: {
        updateInterval: 60000 // 1 minute
    },
    views: {
        updateInterval: 30000 // 30 seconds
    }
};

// ============================================
// Tab Navigation
// ============================================
function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update buttons
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${tabId}`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// ============================================
// Terminal Window
// ============================================
class Terminal {
    constructor() {
        this.window = document.getElementById('terminal-window');
        this.output = document.getElementById('terminal-output');
        this.input = document.getElementById('terminal-input');
        this.form = document.getElementById('terminal-form');
        this.dragHandle = document.getElementById('terminal-drag-handle');
        this.closeBtn = document.getElementById('terminal-close');
        this.minimizeBtn = document.getElementById('terminal-minimize');
        
        this.terminalColor = '#22c55e';
        this.commandHistory = [];
        this.historyIndex = -1;
        
        this.init();
    }
    
    init() {
        if (!this.window) return;
        
        // Position terminal
        this.window.style.top = '100px';
        this.window.style.left = '50%';
        this.window.style.transform = 'translateX(-50%)';
        
        // Form submit
        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.executeCommand(this.input.value.trim());
            this.input.value = '';
        });
        
        // Command history navigation
        this.input?.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.historyIndex < this.commandHistory.length - 1) {
                    this.historyIndex++;
                    this.input.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.input.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
                } else {
                    this.historyIndex = -1;
                    this.input.value = '';
                }
            }
        });
        
        // Close button
        this.closeBtn?.addEventListener('click', () => this.close());
        
        // Minimize button
        this.minimizeBtn?.addEventListener('click', () => this.minimize());
        
        // Drag functionality
        this.initDrag();
        
        // Focus input when terminal is shown
        const observer = new MutationObserver(() => {
            if (!this.window.classList.contains('hidden')) {
                this.input?.focus();
            }
        });
        observer.observe(this.window, { attributes: true, attributeFilter: ['class'] });
    }
    
    initDrag() {
        if (!this.dragHandle || !this.window) return;
        
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        
        this.dragHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.window.style.transform = 'none';
            offsetX = e.clientX - this.window.offsetLeft;
            offsetY = e.clientY - this.window.offsetTop;
            document.body.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const x = Math.max(0, Math.min(window.innerWidth - this.window.offsetWidth, e.clientX - offsetX));
            const y = Math.max(0, Math.min(window.innerHeight - this.window.offsetHeight, e.clientY - offsetY));
            
            this.window.style.left = x + 'px';
            this.window.style.top = y + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    }
    
    show() {
        this.window?.classList.remove('hidden', 'minimized');
        this.input?.focus();
    }
    
    close() {
        this.window?.classList.add('hidden');
    }
    
    minimize() {
        this.window?.classList.toggle('minimized');
    }
    
    executeCommand(cmd) {
        if (!cmd) return;
        
        // Add to history
        this.commandHistory.push(cmd);
        this.historyIndex = -1;
        
        // Show command in output
        this.addLine(`<span class="terminal-prompt" style="color: ${this.terminalColor}">$</span> ${this.escapeHtml(cmd)}`, true);
        
        const [command, ...args] = cmd.toLowerCase().split(' ');
        const argText = args.join(' ');
        
        switch (command) {
            case 'help':
                this.addLine(`Available commands:
- ping: Test connectivity
- clear: Clear console
- color [hex/name]: Change terminal color
- close: Close the terminal
- minimize: Minimize the terminal
- echo [text]: Echo text back
- snake: Play snake game`);
                break;
                
            case 'ping':
                this.addLine('pong!');
                break;
                
            case 'clear':
                this.output.innerHTML = '';
                break;
                
            case 'color':
                if (argText) {
                    const color = argText.startsWith('#') ? argText : argText;
                    this.terminalColor = color;
                    this.addLine(`Terminal color changed to ${color}`);
                } else {
                    this.addLine('Usage: color [hex/name]');
                }
                break;
                
            case 'close':
                this.close();
                break;
                
            case 'minimize':
                this.minimize();
                break;
                
            case 'echo':
                this.addLine(argText || '');
                break;
                
            case 'snake':
                this.addLine('Launching snake game...');
                window.snakeGame?.show();
                break;
                
            default:
                this.addLine(`Command not found: ${command}. Type "help" for available commands.`);
        }
        
        // Scroll to bottom
        this.output.scrollTop = this.output.scrollHeight;
    }
    
    addLine(text, isCommand = false) {
        const div = document.createElement('div');
        div.className = 'terminal-line' + (isCommand ? ' command' : '');
        div.innerHTML = text;
        this.output?.appendChild(div);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// Snake Game
// ============================================
class SnakeGame {
    constructor() {
        this.window = document.getElementById('snake-window');
        this.canvas = document.getElementById('snake-canvas');
        this.ctx = this.canvas?.getContext('2d');
        this.scoreEl = document.getElementById('snake-score');
        this.highEl = document.getElementById('snake-high');
        this.closeBtn = document.getElementById('snake-close');
        this.dragHandle = document.getElementById('snake-drag-handle');
        
        this.gridSize = 10;
        this.tileCount = 20;
        this.snake = [];
        this.food = { x: 0, y: 0 };
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');
        this.gameLoop = null;
        this.isPaused = false;
        this.isGameOver = false;
        
        this.init();
    }
    
    init() {
        if (!this.window) return;
        
        // Position
        this.window.style.top = '150px';
        this.window.style.left = 'calc(50% + 200px)';
        
        // Close button
        this.closeBtn?.addEventListener('click', () => this.close());
        
        // Drag
        this.initDrag();
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.window.classList.contains('hidden')) return;
            
            switch (e.key) {
                case 'ArrowUp':
                    if (this.direction.y !== 1) this.nextDirection = { x: 0, y: -1 };
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    if (this.direction.y !== -1) this.nextDirection = { x: 0, y: 1 };
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    if (this.direction.x !== 1) this.nextDirection = { x: -1, y: 0 };
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    if (this.direction.x !== -1) this.nextDirection = { x: 1, y: 0 };
                    e.preventDefault();
                    break;
                case ' ':
                    e.preventDefault();
                    this.togglePause();
                    break;
            }
        });
        
        // Update high score display
        if (this.highEl) this.highEl.textContent = this.highScore;
    }
    
    initDrag() {
        if (!this.dragHandle || !this.window) return;
        
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        
        this.dragHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - this.window.offsetLeft;
            offsetY = e.clientY - this.window.offsetTop;
            document.body.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const x = Math.max(0, Math.min(window.innerWidth - this.window.offsetWidth, e.clientX - offsetX));
            const y = Math.max(0, Math.min(window.innerHeight - this.window.offsetHeight, e.clientY - offsetY));
            
            this.window.style.left = x + 'px';
            this.window.style.top = y + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    }
    
    show() {
        this.window?.classList.remove('hidden');
        this.reset();
        this.start();
    }
    
    close() {
        this.window?.classList.add('hidden');
        this.stop();
    }
    
    reset() {
        this.snake = [{ x: 10, y: 10 }];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.spawnFood();
        this.updateScore();
    }
    
    start() {
        this.stop();
        this.gameLoop = setInterval(() => this.update(), 100);
    }
    
    stop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }
    
    togglePause() {
        if (this.isGameOver) {
            this.reset();
            this.start();
            return;
        }
        this.isPaused = !this.isPaused;
    }
    
    update() {
        if (this.isPaused || this.isGameOver) return;
        
        this.direction = this.nextDirection;
        
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };
        
        // Check collision with walls
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this.gameOver();
            return;
        }
        
        // Check collision with self
        for (const segment of this.snake) {
            if (head.x === segment.x && head.y === segment.y) {
                this.gameOver();
                return;
            }
        }
        
        this.snake.unshift(head);
        
        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score++;
            this.updateScore();
            this.spawnFood();
        } else {
            this.snake.pop();
        }
        
        this.draw();
    }
    
    spawnFood() {
        do {
            this.food = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
        } while (this.snake.some(s => s.x === this.food.x && s.y === this.food.y));
    }
    
    draw() {
        if (!this.ctx) return;
        
        // Clear
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw food
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fillRect(
            this.food.x * this.gridSize,
            this.food.y * this.gridSize,
            this.gridSize - 1,
            this.gridSize - 1
        );
        
        // Draw snake
        this.snake.forEach((segment, i) => {
            this.ctx.fillStyle = i === 0 ? '#22c55e' : '#16a34a';
            this.ctx.fillRect(
                segment.x * this.gridSize,
                segment.y * this.gridSize,
                this.gridSize - 1,
                this.gridSize - 1
            );
        });
        
        // Draw game over
        if (this.isGameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#ef4444';
            this.ctx.font = '16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 10);
            
            this.ctx.fillStyle = '#a1a1aa';
            this.ctx.font = '12px monospace';
            this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
            this.ctx.fillText('Space to restart', this.canvas.width / 2, this.canvas.height / 2 + 30);
        }
    }
    
    gameOver() {
        this.isGameOver = true;
        this.stop();
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('snakeHighScore', this.highScore.toString());
            if (this.highEl) this.highEl.textContent = this.highScore;
        }
        
        this.draw();
    }
    
    updateScore() {
        if (this.scoreEl) this.scoreEl.textContent = this.score;
    }
}

function initTerminal() {
    const helpBtn = document.getElementById('help-btn');
    
    window.terminal = new Terminal();
    window.snakeGame = new SnakeGame();
    
    helpBtn?.addEventListener('click', () => {
        window.terminal?.show();
    });
    
    // Close terminal with Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const terminal = document.getElementById('terminal-window');
            const snake = document.getElementById('snake-window');
            if (terminal && !terminal.classList.contains('hidden')) {
                window.terminal?.close();
            }
            if (snake && !snake.classList.contains('hidden')) {
                window.snakeGame?.close();
            }
        }
    });
}

// ============================================
// Starfield Animation
// ============================================
function initStarfield() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let stars = [];
    let shootingStars = [];
    const numStars = 300;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    function createStars() {
        stars = [];
        for (let i = 0; i < numStars; i++) {
            const depth = Math.random();
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                baseX: Math.random() * canvas.width,
                baseY: Math.random() * canvas.height,
                size: depth * 1.5 + 0.3,
                depth: depth,
                opacity: depth * 0.6 + 0.2,
                twinkleSpeed: Math.random() * 0.03 + 0.01,
                twinklePhase: Math.random() * Math.PI * 2,
                hue: Math.random() > 0.9 ? Math.random() * 60 + 200 : 0 // Some blue-ish stars
            });
        }
    }
    
    function createShootingStar() {
        if (shootingStars.length < 2 && Math.random() < 0.002) {
            const startX = Math.random() * canvas.width;
            shootingStars.push({
                x: startX,
                y: 0,
                length: Math.random() * 80 + 40,
                speed: Math.random() * 8 + 4,
                angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
                opacity: 1,
                trail: []
            });
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Smooth mouse following
        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;
        
        // Draw stars with parallax
        stars.forEach(star => {
            // Parallax effect based on mouse position
            const parallaxX = (mouseX - canvas.width / 2) * star.depth * 0.02;
            const parallaxY = (mouseY - canvas.height / 2) * star.depth * 0.02;
            
            star.x = star.baseX + parallaxX;
            star.y = star.baseY + parallaxY;
            
            // Twinkle effect
            star.twinklePhase += star.twinkleSpeed;
            const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
            const opacity = star.opacity * twinkle;
            
            // Draw star glow
            if (star.size > 1) {
                const gradient = ctx.createRadialGradient(
                    star.x, star.y, 0,
                    star.x, star.y, star.size * 3
                );
                if (star.hue > 0) {
                    gradient.addColorStop(0, `hsla(${star.hue}, 70%, 80%, ${opacity * 0.5})`);
                    gradient.addColorStop(1, 'transparent');
                } else {
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.3})`);
                    gradient.addColorStop(1, 'transparent');
                }
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }
            
            // Draw star core
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            if (star.hue > 0) {
                ctx.fillStyle = `hsla(${star.hue}, 70%, 90%, ${opacity})`;
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            }
            ctx.fill();
        });
        
        // Create and draw shooting stars
        createShootingStar();
        
        shootingStars = shootingStars.filter(ss => {
            ss.x += Math.cos(ss.angle) * ss.speed;
            ss.y += Math.sin(ss.angle) * ss.speed;
            ss.opacity -= 0.01;
            
            // Draw shooting star with trail
            const gradient = ctx.createLinearGradient(
                ss.x, ss.y,
                ss.x - Math.cos(ss.angle) * ss.length,
                ss.y - Math.sin(ss.angle) * ss.length
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`);
            gradient.addColorStop(0.3, `rgba(200, 220, 255, ${ss.opacity * 0.5})`);
            gradient.addColorStop(1, 'transparent');
            
            ctx.beginPath();
            ctx.moveTo(ss.x, ss.y);
            ctx.lineTo(
                ss.x - Math.cos(ss.angle) * ss.length,
                ss.y - Math.sin(ss.angle) * ss.length
            );
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
            
            // Draw bright head
            ctx.beginPath();
            ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${ss.opacity})`;
            ctx.fill();
            
            return ss.opacity > 0 && ss.x < canvas.width + 100 && ss.y < canvas.height + 100;
        });
        
        requestAnimationFrame(animate);
    }
    
    resize();
    createStars();
    animate();
    
    // Track mouse for parallax effect
    document.addEventListener('mousemove', (e) => {
        targetMouseX = e.clientX;
        targetMouseY = e.clientY;
    });
    
    window.addEventListener('resize', () => {
        resize();
        createStars();
    });
}

// ============================================
// Music Player
// ============================================
class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audio-player');
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
<<        this._volumeCleanup = null;
        
        this.elements = {
            playBtn: document.getElementById('play-btn'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            playIcon: document.getElementById('play-icon'),
            pauseIcon: document.getElementById('pause-icon'),
            songTitle: document.getElementById('song-title'),
            songArtist: document.getElementById('song-artist'),
            albumArt: document.getElementById('album-art'),
            progressFill: document.getElementById('progress-fill'),
            currentTime: document.getElementById('current-time'),
            totalTime: document.getElementById('total-time'),
            volumeFill: document.getElementById('volume-fill'),
            volumeText: document.getElementById('volume-text'),
            progressBar: document.querySelector('.progress-bar'),
            volumeBar: document.getElementById('volume-bar'),
            volumeThumb: document.getElementById('volume-thumb'),
            volumeIconBtn: document.getElementById('volume-icon-btn'),
            // Mini player elements
            songTitleMini: document.getElementById('song-title-mini'),
            songArtistMini: document.getElementById('song-artist-mini'),
            albumArtMini: document.getElementById('album-art-mini')
        };
        
        this.init();
    }
    
    async init() {
        await this.loadPlaylist();
        this.bindEvents();
        this.setVolume(0.7);
    }
    
    async loadPlaylist() {
        try {
            const response = await fetch('/api/music/playlist');
            if (response.ok) {
                const data = await response.json();
                this.playlist = data.tracks || [];
                if (this.playlist.length > 0) {
                    this.loadTrack(0);
                } else {
                    this.updateUI({ title: 'No tracks available', artist: '' });
                }
            }
        } catch (error) {
            console.error('Error loading playlist:', error);
            this.updateUI({ title: 'Error loading music', artist: '' });
        }
    }
    
    loadTrack(index) {
        if (this.playlist.length === 0) return;
        
        this.currentIndex = index;
        const track = this.playlist[index];
        
        this.audio.src = track.url;
        this.updateUI(track);
        
        if (this.isPlaying) {
            this.audio.play();
        }
    }
    
    updateUI(track) {
        if (this.elements.songTitle) {
            this.elements.songTitle.textContent = track.title || 'Unknown Track';
        }
        if (this.elements.songArtist) {
            this.elements.songArtist.textContent = track.artist || 'Unknown Artist';
        }
        if (this.elements.albumArt && track.cover) {
            this.elements.albumArt.src = track.cover;
        }
        
        // Update mini player
        if (this.elements.songTitleMini) {
            this.elements.songTitleMini.textContent = track.title || 'Unknown Track';
        }
        if (this.elements.songArtistMini) {
            this.elements.songArtistMini.textContent = track.artist || 'Unknown Artist';
        }
        if (this.elements.albumArtMini && track.cover) {
            this.elements.albumArtMini.src = track.cover;
        }
    }
    
    bindEvents() {
        // Play/Pause
        this.elements.playBtn?.addEventListener('click', () => this.togglePlay());
        
        // Previous/Next
        this.elements.prevBtn?.addEventListener('click', () => this.prev());
        this.elements.nextBtn?.addEventListener('click', () => this.next());
        
        // Audio events
        this.audio?.addEventListener('timeupdate', () => this.updateProgress());
        this.audio?.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio?.addEventListener('ended', () => this.next());
        
        // Progress bar click
        this.initSeekDrag();
        
        // Volume (re-coded)
        this.initVolumeControl();
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    if (e.shiftKey) this.prev();
                    else if (this.audio) this.audio.currentTime -= 5;
                    break;
                case 'ArrowRight':
                    if (e.shiftKey) this.next();
                    else if (this.audio) this.audio.currentTime += 5;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.setVolume(Math.min(1, this.audio.volume + 0.1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.setVolume(Math.max(0, this.audio.volume - 0.1));
                    break;
            }
        });
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (this.audio && this.playlist.length > 0) {
            this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton();
        }
    }
    
    pause() {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }
    
    prev() {
        if (this.playlist.length === 0) return;
        
        const newIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        this.loadTrack(newIndex);
    }
    
    next() {
        if (this.playlist.length === 0) return;
        
        const newIndex = (this.currentIndex + 1) % this.playlist.length;
        this.loadTrack(newIndex);
    }
    
    updatePlayButton() {
        if (this.elements.playIcon && this.elements.pauseIcon) {
            this.elements.playIcon.style.display = this.isPlaying ? 'none' : 'block';
            this.elements.pauseIcon.style.display = this.isPlaying ? 'block' : 'none';
        }
    }
    
    updateProgress() {
        if (!this.audio || !this.audio.duration) return;
        
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percent}%`;
        }
        
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(this.audio.currentTime);
        }
    }
    
    updateDuration() {
        if (this.elements.totalTime && this.audio?.duration) {
            this.elements.totalTime.textContent = this.formatTime(this.audio.duration);
        }
    }
    
    setVolume(value) {
        if (this.audio) {
            this.audio.volume = value;
        }
        
        if (this.elements.volumeFill) {
            this.elements.volumeFill.style.width = `${value * 100}%`;
        }
        
        if (this.elements.volumeText) {
            this.elements.volumeText.textContent = `${Math.round(value * 100)}%`;
        }
        
        // Update thumb + aria
        if (this.elements.volumeThumb) {
            this.elements.volumeThumb.style.left = `${value * 100}%`;
        }
        if (this.elements.volumeBar) {
            this.elements.volumeBar.setAttribute('aria-valuenow', String(Math.round(value * 100)));
        }
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    initVolumeControl() {
        const bar = this.elements.volumeBar;
        if (!bar || !this.audio) return;

        // Cleanup previous bindings if any (defensive)
        if (typeof this._volumeCleanup === 'function') {
            this._volumeCleanup();
            this._volumeCleanup = null;
        }

        const setFromClientX = (clientX) => {
            const rect = bar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            this.setVolume(percent);
        };

        const onPointerDown = (e) => {
            bar.classList.add('dragging');
            try { bar.setPointerCapture(e.pointerId); } catch {}
            setFromClientX(e.clientX);
            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (!bar.classList.contains('dragging')) return;
            setFromClientX(e.clientX);
            e.preventDefault();
        };

        const onPointerUp = (e) => {
            bar.classList.remove('dragging');
            try { bar.releasePointerCapture(e.pointerId); } catch {}
        };

        const onKeyDown = (e) => {
            const step = e.shiftKey ? 0.1 : 0.05;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.setVolume(Math.max(0, this.audio.volume - step));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.setVolume(Math.min(1, this.audio.volume + step));
            } else if (e.key === 'Home') {
                e.preventDefault();
                this.setVolume(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                this.setVolume(1);
            }
        };

        bar.addEventListener('pointerdown', onPointerDown);
        bar.addEventListener('pointermove', onPointerMove);
        bar.addEventListener('pointerup', onPointerUp);
        bar.addEventListener('pointercancel', onPointerUp);
        bar.addEventListener('keydown', onKeyDown);

        // Clicking icon focuses the slider for keyboard control (right-aligned UX)
        this.elements.volumeIconBtn?.addEventListener('click', () => bar.focus());

        this._volumeCleanup = () => {
            bar.removeEventListener('pointerdown', onPointerDown);
            bar.removeEventListener('pointermove', onPointerMove);
            bar.removeEventListener('pointerup', onPointerUp);
            bar.removeEventListener('pointercancel', onPointerUp);
            bar.removeEventListener('keydown', onKeyDown);
        };
    }

    initSeekDrag() {
        const bar = this.elements.progressBar;
        if (!bar || !this.audio) return;

        let isDragging = false;

        const setFromClientX = (clientX) => {
            const rect = bar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            if (this.audio.duration && isFinite(this.audio.duration)) {
                this.audio.currentTime = percent * this.audio.duration;
            }
        };

        const onDown = (e) => {
            isDragging = true;
            document.body.style.userSelect = 'none';
            setFromClientX(e.clientX);
        };

        const onMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            setFromClientX(e.clientX);
        };

        const onUp = () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.userSelect = '';
        };

        // Mouse
        bar.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);

        // Touch
        bar.addEventListener('touchstart', (e) => {
            isDragging = true;
            document.body.style.userSelect = 'none';
            const t = e.touches[0];
            if (t) setFromClientX(t.clientX);
        }, { passive: true });

        bar.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const t = e.touches[0];
            if (t) setFromClientX(t.clientX);
            e.preventDefault();
        }, { passive: false });

        bar.addEventListener('touchend', onUp);
    }
}

// ============================================
// Discord Presence
// ============================================
async function updateDiscordPresence() {
    try {
        const response = await fetch('/api/discord/presence');
        if (response.ok) {
            const data = await response.json();
            updateDiscordUI(data);
        }
    } catch (error) {
        console.error('Error fetching Discord presence:', error);
        updateDiscordUI({ status: 'offline' });
    }
}

function updateDiscordUI(data) {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('discord-status-text');
    const avatar = document.getElementById('discord-avatar');
    
    if (statusDot) {
        // Remove all status classes (both regular and small variants)
        statusDot.classList.remove('online', 'idle', 'dnd', 'offline');
        // Add the current status class
        statusDot.classList.add(data.status || 'offline');
    }
    
    if (statusText) {
        const statusMap = {
            'online': 'Online',
            'idle': 'Away',
            'dnd': 'Do Not Disturb',
            'offline': 'Offline'
        };
        statusText.textContent = statusMap[data.status] || 'Offline';
        
        // Add color class based on status
        statusText.classList.remove('text-green-400', 'text-yellow-400', 'text-red-400', 'text-gray-500');
        const colorMap = {
            'online': 'text-green-400',
            'idle': 'text-yellow-400',
            'dnd': 'text-red-400',
            'offline': 'text-gray-500'
        };
        statusText.classList.add(colorMap[data.status] || 'text-gray-500');
    }
    
    if (avatar && data.avatar) {
        avatar.src = data.avatar;
    }
}

// ============================================
// View Counter
// ============================================
async function incrementViewCount() {
    try {
        const response = await fetch('/api/views/hit');
        if (response.ok) {
            const data = await response.json();
            updateViewCounterUI(data.count || 0);
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
    }
}

async function updateViewCounter() {
    try {
        const response = await fetch('/api/views');
        if (response.ok) {
            const data = await response.json();
            updateViewCounterUI(data.count || 0);
        }
    } catch (error) {
        console.error('Error updating view counter:', error);
    }
}

function updateViewCounterUI(count) {
    const viewCountEl = document.getElementById('view-count');
    if (viewCountEl) {
        viewCountEl.textContent = count.toLocaleString();
    }
}

// ============================================
// Projects
// ============================================
async function loadProjects() {
    const container = document.getElementById('projects-list');
    if (!container) return;
    
    try {
        const response = await fetch('https://api.github.com/users/r3dg0d/repos?per_page=100&sort=updated');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const repos = await response.json();
        
        // Filter and sort
        const projects = repos
            .filter(repo => !repo.fork)
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 10);
        
        if (projects.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-500">No projects found.</div>';
            return;
        }
        
        container.innerHTML = '';
        
        projects.forEach(repo => {
            const projectDiv = document.createElement('div');
            projectDiv.className = 'project-item';
            
            const language = repo.language || 'N/A';
            const stars = repo.stargazers_count || 0;
            const description = repo.description || 'No description available.';
            
            projectDiv.innerHTML = `
                <h3><a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${repo.name}</a></h3>
                <p>${description}</p>
                <div class="project-meta">
                    <span class="project-tag">${language}</span>
                    <span class="project-tag">⭐ ${stars}</span>
                </div>
            `;
            
            container.appendChild(projectDiv);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
        container.innerHTML = `<div class="text-xs text-red-400">Error loading projects: ${error.message}</div>`;
    }
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    initTabs();
    initTerminal();
    initStarfield();
    
    // Initialize music player
    window.musicPlayer = new MusicPlayer();
    
    // Initialize view counter
    incrementViewCount();
    updateViewCounter();
    setInterval(updateViewCounter, CONFIG.views.updateInterval);
    
    // Initialize Discord presence
    updateDiscordPresence();
    setInterval(updateDiscordPresence, CONFIG.discord.updateInterval);
    
    // Load projects when projects tab is viewed
    const projectsTab = document.querySelector('[data-tab="projects"]');
    if (projectsTab) {
        projectsTab.addEventListener('click', () => {
            const container = document.getElementById('projects-list');
            if (container && container.children.length === 1 && container.children[0].textContent.includes('Loading')) {
                loadProjects();
            }
        });
    }
});

