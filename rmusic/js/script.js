// ============================
// DOM Utilities
// ============================

function getElementByIdSafe(id) {
    return document.getElementById(id);
}

function createElementWithClass(tag, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
}

// ============================
// Player System (Lightweight)
// ============================

const playerSystem = {
    mainPlayer: {
        container: getElementByIdSafe("playshow"),
        video: document.querySelector("#playshow video"),
        title: getElementByIdSafe("nameartist"),
        btnPlay: getElementByIdSafe("play"),
        btnBack: getElementByIdSafe("backward"),
        btnNext: getElementByIdSafe("forward"),
        btnHide: getElementByIdSafe("hideplay"),
        btnMinimize: getElementByIdSafe("minimize"),
        bar: document.querySelector(".bar"),
        progress: document.querySelector(".prbar"),
        time1: getElementByIdSafe("time1"),
        time2: getElementByIdSafe("time2")
    },
    
    miniPlayer: {
        container: document.querySelector(".miniplay"),
        video: document.querySelector(".miniplay video"),
        btnPlay: getElementByIdSafe("play2"),
        btnMaximize: getElementByIdSafe("minimize2"),
        visible: false
    },
    
    videos: [],
    currentPlaylist: [],
    currentIndex: -1,
    isPlaying: false,
    currentVideoId: null,
    
    init: function() {
        console.log("🎬 Initializing player system...");
        this.fetchVideosFromServer();
        this.bindMainPlayerEvents();
        this.bindMiniPlayerEvents();
        this.setupVideoListeners();
        this.setupDragAndDrop();
    },
    
    fetchVideosFromServer: async function() {
        try {
            const response = await fetch('/videos');
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const videos = await response.json();
            
            if (!Array.isArray(videos)) {
                throw new Error('Invalid response format');
            }
            
            this.videos = videos;
            this.currentPlaylist = [...videos];
            
            console.log(`✅ Loaded ${this.videos.length} videos`);
            this.buildVideoCards();
            
        } catch (error) {
            console.error("❌ Error fetching videos:", error);
            this.showError("تعذر تحميل الفيديوهات. تأكد من اتصال السيرفر.");
            this.buildVideoCards();
        }
    },
    
    buildVideoCards: function() {
        const container = getElementByIdSafe('contentcatd');
        if (!container) {
            console.error("❌ Content container not found!");
            return;
        }
        
        container.innerHTML = '';
        
        if (this.videos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video-slash"></i>
                    <h3>لا توجد فيديوهات</h3>
                    <p>اسحب وأفلت ملفات فيديو هنا أو انقر زر الرفع</p>
                </div>
            `;
            return;
        }
        
        console.log(`🖼️ Building ${this.videos.length} video cards...`);
        
        this.videos.forEach(video => {
            const card = this.createVideoCard(video);
            container.appendChild(card);
        });
        
        this.setupCardEventListeners();
        console.log("✅ Video cards built successfully");
    },
    
    createVideoCard: function(video) {
        const card = createElementWithClass('div', 'card');
        card.dataset.id = video.id;
        card.dataset.title = video.name;
        card.dataset.filename = video.filename;
        
        // Get file extension
        const ext = video.filename.split('.').pop().toLowerCase();
        const isVideo = ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext);
        const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
        
        // Create thumbnail container
        const thumbnail = createElementWithClass('div', 'card-thumbnail');
        
        // Check if thumbnail exists
        if (video.thumbnail_url && isVideo) {
            // Create image element for thumbnail
            const img = document.createElement('img');
            img.src = video.thumbnail_url;
            img.alt = video.name;
            img.loading = 'lazy';
            img.onerror = () => {
                // If thumbnail fails to load, show fallback
                img.style.display = 'none';
                thumbnail.style.background = this.getFallbackGradient(ext);
                thumbnail.innerHTML = `<i class="${this.getFileIcon(ext)}"></i>`;
            };
            thumbnail.appendChild(img);
        } else {
            // Show fallback based on file type
            thumbnail.style.background = this.getFallbackGradient(ext);
            thumbnail.innerHTML = `<i class="${this.getFileIcon(ext)}"></i>`;
        }
        
        // File info
        const fileSize = video.file_size ? 
            this.formatFileSize(video.file_size) : 'غير معروف';
        
        const overlay = createElementWithClass('div', 'overlay');
        overlay.innerHTML = `
            <div class="video-info">
                <h3 class="video-title" title="${video.name}">${this.truncateText(video.name, 30)}</h3>
                <div class="file-info">
                    <span class="file-type">${this.getFileTypeName(ext)}</span>
                    <span class="file-size">${fileSize}</span>
                </div>
            </div>
        `;
        
        // Play button
        const playBtn = createElementWithClass('div', 'play-btn');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.title = 'تشغيل الفيديو';
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            playBtn.style.opacity = '1';
            playBtn.style.transform = 'translate(-50%, -50%) scale(1)';
        });
        
        card.addEventListener('mouseleave', () => {
            playBtn.style.opacity = '0';
            playBtn.style.transform = 'translate(-50%, -50%) scale(0.8)';
        });
        
        card.appendChild(thumbnail);
        card.appendChild(overlay);
        card.appendChild(playBtn);
        
        return card;
    },
    
    getFallbackGradient: function(ext) {
        const isVideo = ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext);
        const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
        
        if (isVideo) {
            return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        } else if (isAudio) {
            return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        } else {
            return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        }
    },
    
    getFileIcon: function(ext) {
        const isVideo = ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext);
        const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
        
        if (isVideo) return 'fas fa-video';
        if (isAudio) return 'fas fa-music';
        return 'fas fa-file';
    },
    
    getFileTypeName: function(ext) {
        const typeMap = {
            'mp4': 'MP4',
            'avi': 'AVI',
            'mov': 'MOV',
            'mkv': 'MKV',
            'webm': 'WEBM',
            'mp3': 'MP3',
            'wav': 'WAV',
            'ogg': 'OGG'
        };
        return typeMap[ext] || ext.toUpperCase();
    },
    
    bindMainPlayerEvents: function() {
        if (!this.mainPlayer.btnPlay) return;
        
        this.mainPlayer.btnPlay.onclick = () => this.togglePlayPause();
        this.mainPlayer.btnHide.onclick = () => {
            this.stopVideo();
            this.hideMainPlayer();
        };
        this.mainPlayer.btnMinimize.onclick = () => this.minimizePlayer();
        this.mainPlayer.btnBack.onclick = () => this.playPrevious();
        this.mainPlayer.btnNext.onclick = () => this.playNext();
        this.mainPlayer.progress.onclick = (e) => this.seekVideo(e);
    },
    
    bindMiniPlayerEvents: function() {
        if (!this.miniPlayer.btnPlay) return;
        
        this.miniPlayer.btnPlay.onclick = () => this.togglePlayPause();
        this.miniPlayer.btnMaximize.onclick = () => this.maximizePlayer();
    },
    
    setupCardEventListeners: function() {
        const container = getElementByIdSafe('contentcatd');
        if (!container) return;
        
        container.addEventListener("click", (e) => {
            if (e.target.closest('.play-btn')) {
                const card = e.target.closest('.card');
                if (card) this.handleCardClick(card);
                return;
            }
            
            const card = e.target.closest('.card');
            if (card && !e.target.closest('.play-btn')) {
                this.handleCardClick(card);
            }
        });
    },
    
    setupVideoListeners: function() {
        if (!this.mainPlayer.video) {
            console.warn("⚠️ Main video element not found");
            return;
        }
        
        this.mainPlayer.video.addEventListener("timeupdate", () => this.updateProgress());
        this.mainPlayer.video.addEventListener("play", () => {
            this.isPlaying = true;
            this.updatePlayButtons();
        });
        this.mainPlayer.video.addEventListener("pause", () => {
            this.isPlaying = false;
            this.updatePlayButtons();
        });
        this.mainPlayer.video.addEventListener("ended", () => this.playNext());
        this.mainPlayer.video.addEventListener("error", () => this.handleVideoError());
        
        if (this.miniPlayer.video) {
            this.miniPlayer.video.addEventListener("timeupdate", () => this.updateProgress());
            this.miniPlayer.video.addEventListener("play", () => {
                this.isPlaying = true;
                this.updatePlayButtons();
            });
            this.miniPlayer.video.addEventListener("pause", () => {
                this.isPlaying = false;
                this.updatePlayButtons();
            });
            this.miniPlayer.video.addEventListener("ended", () => this.playNext());
            this.miniPlayer.video.addEventListener("error", () => this.handleVideoError());
        }
    },
    
    setupDragAndDrop: function() {
        const dropArea = getElementByIdSafe('contentcatd');
        if (!dropArea) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('drag-over');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('drag-over');
            }, false);
        });
        
        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadFilesToServer(Array.from(files));
            }
        }, false);
    },
    
    handleCardClick: function(card) {
        const videoId = parseInt(card.dataset.id);
        const videoTitle = card.dataset.title;
        const videoFilename = card.dataset.filename;
        
        this.playVideo(videoFilename, videoTitle, videoId);
    },
    
    playVideo: function(filename, title, videoId = -1) {
        this.stopAllVideos();
        this.currentVideoId = videoId;
        
        this.currentIndex = this.currentPlaylist.findIndex(v => v.id === videoId);
        if (this.currentIndex === -1) this.currentIndex = 0;
        
        const videoSrc = `/video/${filename}`;
        this.setupVideoElements(videoSrc);
        
        if (this.mainPlayer.title) {
            this.mainPlayer.title.textContent = title;
        }
        
        this.attemptVideoPlay();
        
        if (!this.miniPlayer.visible) {
            this.showMainPlayer();
        }
        
        this.isPlaying = true;
        this.updatePlayButtons();
    },
    
    setupVideoElements: function(src) {
        if (!this.mainPlayer.video) return;
        
        this.mainPlayer.video.pause();
        if (this.miniPlayer.video) this.miniPlayer.video.pause();
        
        this.mainPlayer.video.src = src;
        if (this.miniPlayer.video) this.miniPlayer.video.src = src;
        
        if (this.miniPlayer.visible && this.miniPlayer.video) {
            this.mainPlayer.video.muted = true;
            this.miniPlayer.video.muted = false;
        } else {
            this.mainPlayer.video.muted = false;
            if (this.miniPlayer.video) this.miniPlayer.video.muted = true;
        }
        
        this.mainPlayer.video.load();
        if (this.miniPlayer.video) this.miniPlayer.video.load();
    },
    
    attemptVideoPlay: function() {
        const video = this.miniPlayer.visible ? this.miniPlayer.video : this.mainPlayer.video;
        if (!video) return;
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("⚠️ Auto-play prevented:", error.name);
                this.isPlaying = false;
                this.updatePlayButtons();
            });
        }
    },
    
    togglePlayPause: function() {
        try {
            const video = this.miniPlayer.visible ? this.miniPlayer.video : this.mainPlayer.video;
            if (!video) return;
            
            if (video.paused) {
                video.play().catch(console.warn);
            } else {
                video.pause();
            }
            this.updatePlayButtons();
        } catch (e) {
            console.error("❌ Toggle play/pause error:", e);
        }
    },
    
    updatePlayButtons: function() {
        let isPlaying = false;
        const video = this.miniPlayer.visible ? this.miniPlayer.video : this.mainPlayer.video;
        
        if (video) isPlaying = !video.paused;
        
        const playIcon = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        
        if (this.mainPlayer.btnPlay) this.mainPlayer.btnPlay.innerHTML = playIcon;
        if (this.miniPlayer.btnPlay) this.miniPlayer.btnPlay.innerHTML = playIcon;
    },
    
    stopAllVideos: function() {
        if (this.mainPlayer.video) this.mainPlayer.video.pause();
        if (this.miniPlayer.video) this.miniPlayer.video.pause();
    },
    
    stopVideo: function() {
        this.stopAllVideos();
        this.isPlaying = false;
        this.updatePlayButtons();
        this.updateProgress();
    },
    
    playNext: function() {
        if (this.currentPlaylist.length === 0) {
            this.showNotification("لا توجد فيديوهات في القائمة", "warning");
            return;
        }
        
        if (this.currentPlaylist.length === 1) {
            this.replayCurrentVideo();
            return;
        }
        
        let nextIndex = (this.currentIndex + 1) % this.currentPlaylist.length;
        const nextVideo = this.currentPlaylist[nextIndex];
        
        if (nextVideo) {
            this.playVideo(nextVideo.filename, nextVideo.name, nextVideo.id);
        }
    },
    
    playPrevious: function() {
        if (this.currentPlaylist.length === 0) {
            this.showNotification("لا توجد فيديوهات في القائمة", "warning");
            return;
        }
        
        if (this.currentPlaylist.length === 1) {
            this.replayCurrentVideo();
            return;
        }
        
        let prevIndex = (this.currentIndex - 1 + this.currentPlaylist.length) % this.currentPlaylist.length;
        const prevVideo = this.currentPlaylist[prevIndex];
        
        if (prevVideo) {
            this.playVideo(prevVideo.filename, prevVideo.name, prevVideo.id);
        }
    },
    
    replayCurrentVideo: function() {
        if (this.currentIndex >= 0 && this.currentIndex < this.currentPlaylist.length) {
            const currentVideo = this.currentPlaylist[this.currentIndex];
            if (currentVideo) {
                this.playVideo(currentVideo.filename, currentVideo.name, currentVideo.id);
            }
        }
    },
    
    seekVideo: function(e) {
        if (!this.mainPlayer.progress) return;
        
        const rect = this.mainPlayer.progress.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        
        const video = this.miniPlayer.visible ? this.miniPlayer.video : this.mainPlayer.video;
        
        if (video && video.duration && !isNaN(video.duration)) {
            const time = percent * video.duration;
            video.currentTime = time;
            this.updateProgress();
        }
    },
    
    updateProgress: function() {
        if (!this.mainPlayer.time1 || !this.mainPlayer.time2 || !this.mainPlayer.bar) return;
        
        const video = this.miniPlayer.visible ? this.miniPlayer.video : this.mainPlayer.video;
        
        if (!video) return;
        
        const currentTime = video.currentTime || 0;
        const duration = video.duration || 0;
        
        if (duration && !isNaN(duration)) {
            this.mainPlayer.time1.textContent = this.formatTime(currentTime);
            this.mainPlayer.time2.textContent = this.formatTime(duration);
            
            const percent = (currentTime / duration) * 100;
            this.mainPlayer.bar.style.width = percent + "%";
        }
    },
    
    formatTime: function(seconds) {
        if (isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    formatFileSize: function(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    
    truncateText: function(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    showMainPlayer: function() {
        if (!this.mainPlayer.container) return;
        
        this.mainPlayer.container.style.display = "flex";
        if (this.miniPlayer.container) {
            this.miniPlayer.container.style.display = "none";
        }
        this.miniPlayer.visible = false;
        
        if (this.mainPlayer.video && this.miniPlayer.video) {
            this.miniPlayer.video.muted = true;
            this.mainPlayer.video.muted = false;
            this.mainPlayer.video.currentTime = this.miniPlayer.video.currentTime;
            
            if (!this.miniPlayer.video.paused) {
                this.mainPlayer.video.play().catch(console.warn);
            }
        }
    },
    
    hideMainPlayer: function() {
        if (this.mainPlayer.container) {
            this.mainPlayer.container.style.display = "none";
        }
    },
    
    minimizePlayer: function() {
        if (!this.miniPlayer.container || !this.mainPlayer.container) return;
        
        this.mainPlayer.container.style.display = "none";
        this.miniPlayer.container.style.display = "flex";
        this.miniPlayer.visible = true;
        
        if (this.mainPlayer.video && this.miniPlayer.video) {
            this.mainPlayer.video.muted = true;
            this.miniPlayer.video.muted = false;
            this.miniPlayer.video.currentTime = this.mainPlayer.video.currentTime;
            
            if (!this.mainPlayer.video.paused) {
                this.miniPlayer.video.play().catch(console.warn);
            }
            this.mainPlayer.video.pause();
        }
    },
    
    maximizePlayer: function() {
        this.showMainPlayer();
        if (this.miniPlayer.video) {
            this.miniPlayer.video.pause();
        }
    },
    
    handleVideoError: function() {
        this.showError("حدث خطأ في تشغيل الفيديو");
        this.stopVideo();
    },
    
    showError: function(message) {
        const errorDiv = createElementWithClass('div', 'error-message');
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    },
    
    showNotification: function(message, type = 'info') {
        const notification = createElementWithClass('div', `notification notification-${type}`);
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                            type === 'warning' ? 'exclamation-triangle' : 
                            'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    },
    
    deleteVideoFromServer: async function(videoId) {
        try {
            const response = await fetch(`/video/${videoId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification("تم حذف الفيديو بنجاح", "success");
                await this.fetchVideosFromServer();
                
                if (this.currentVideoId === videoId) {
                    this.stopVideo();
                    this.hideMainPlayer();
                }
                return true;
            } else {
                this.showError("فشل في حذف الفيديو");
                return false;
            }
        } catch (error) {
            console.error("❌ Delete error:", error);
            this.showError("حدث خطأ أثناء حذف الفيديو");
            return false;
        }
    }
};

// ============================
// File Upload System
// ============================

async function uploadFilesToServer(files) {
    const processingBanner = getElementByIdSafe('processingBanner');
    if (!processingBanner) return;
    
    processingBanner.style.display = 'flex';
    updateProgressBar(0, files.length);
    
    let processedCount = 0;
    let successCount = 0;
    
    for (const file of files) {
        try {
            if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
                console.warn("⚠️ Skipping non-video/audio file:", file.name);
                processedCount++;
                updateProgressBar(processedCount, files.length);
                continue;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                successCount++;
            } else {
                console.error("❌ Upload failed for", file.name);
            }
            
            processedCount++;
            updateProgressBar(processedCount, files.length);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error("❌ Error processing", file.name, ":", error);
        }
    }
    
    setTimeout(() => {
        processingBanner.style.display = 'none';
        const processingBar = getElementByIdSafe('processingBar');
        if (processingBar) processingBar.style.width = '0%';
        
        if (successCount > 0) {
            playerSystem.showNotification(`تم رفع ${successCount} ملف بنجاح`, "success");
            playerSystem.fetchVideosFromServer();
        } else {
            playerSystem.showError("فشل رفع جميع الملفات");
        }
    }, 500);
}

function updateProgressBar(processedCount, totalFiles) {
    const processingBar = getElementByIdSafe('processingBar');
    const processingText = getElementByIdSafe('processingText');
    
    if (!processingBar || !processingText) return;
    
    const progressPercent = (processedCount / totalFiles) * 100;
    processingBar.style.width = progressPercent + '%';
    processingText.textContent = `جاري المعالجة ${processedCount} من ${totalFiles}`;
}

function uploadfile() {
    const fileInput = getElementByIdSafe('fileInput');
    if (!fileInput) return;
    
    fileInput.value = '';
    fileInput.click();
    
    fileInput.onchange = () => {
        const files = Array.from(fileInput.files);
        if (files.length === 0) return;
        
        const supportedFiles = files.filter(file => 
            file.type.startsWith('video/') || file.type.startsWith('audio/')
        );
        
        if (supportedFiles.length > 0) {
            uploadFilesToServer(supportedFiles);
        } else {
            playerSystem.showError("الرجاء اختيار ملفات فيديو أو صوت فقط");
        }
    };
}

// ============================
// Context Menu
// ============================

document.addEventListener('DOMContentLoaded', () => {
    const contextMenu = document.getElementById('contextMenu');
    let currentCard = null;
    
    if (!contextMenu) return;

    document.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.card');
        if (card) {
            e.preventDefault();
            currentCard = card;
            
            const menuWidth = contextMenu.offsetWidth;
            const menuHeight = contextMenu.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let left = e.pageX;
            let top = e.pageY;
            
            if (left + menuWidth > viewportWidth) left = e.pageX - menuWidth;
            if (top + menuHeight > viewportHeight) top = e.pageY - menuHeight;

            contextMenu.style.top = top + 'px';
            contextMenu.style.left = left + 'px';
            contextMenu.style.display = 'block';
        } else {
            contextMenu.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#contextMenu')) {
            contextMenu.style.display = 'none';
        }
    });

    const playBtn = document.getElementById('playBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const miniPlayBtn = document.getElementById('miniPlayBtn');
    
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (!currentCard) return;
            playerSystem.handleCardClick(currentCard);
            contextMenu.style.display = 'none';
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!currentCard) return;
            
            const videoId = parseInt(currentCard.dataset.id);
            const videoName = currentCard.dataset.title;
            
            if (confirm(`هل تريد حذف الفيديو "${videoName}"؟`)) {
                const success = await playerSystem.deleteVideoFromServer(videoId);
                if (success) contextMenu.style.display = 'none';
            }
        });
    }

    if (miniPlayBtn) {
        miniPlayBtn.addEventListener('click', () => {
            if (!currentCard) return;
            
            const videoId = parseInt(currentCard.dataset.id);
            const videoTitle = currentCard.dataset.title;
            const videoFilename = currentCard.dataset.filename;
            
            if (!playerSystem.miniPlayer.visible) {
                playerSystem.minimizePlayer();
            }
            
            playerSystem.playVideo(videoFilename, videoTitle, videoId);
            contextMenu.style.display = 'none';
        });
    }
});

// ============================
// Search System
// ============================

const searchInput = document.getElementById('searchcard');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.card');
        let visibleCount = 0;
        
        cards.forEach(card => {
            const title = card.dataset.title || '';
            
            if (title.toLowerCase().includes(searchTerm)) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        const container = getElementByIdSafe('contentcatd');
        const emptyState = container.querySelector('.empty-state');
        
        if (visibleCount === 0 && searchTerm !== '') {
            if (!emptyState) {
                const noResults = createElementWithClass('div', 'empty-state');
                noResults.innerHTML = `
                    <i class="fas fa-search"></i>
                    <h3>No results</h3>
                    <p>No matching videos were found."${searchTerm}"</p>
                `;
                container.appendChild(noResults);
            }
        } else if (emptyState && searchTerm === '') {
            emptyState.remove();
        }
    });
}

// ============================
// Initialize on page load
// ============================

document.addEventListener('DOMContentLoaded', () => {
    playerSystem.init();
    
    const uploadBtn = document.querySelector('button[onclick="uploadfile()"]');
    if (uploadBtn) uploadBtn.onclick = uploadfile;
    
    const hideBtn = document.getElementById('hideplay');
    if (hideBtn) {
        hideBtn.onclick = () => {
            playerSystem.stopVideo();
            playerSystem.hideMainPlayer();
        };
    }
    
    console.log("✅ System loaded successfully");
});































function Settinges(){
    const settinges = document.getElementById("settinges");
    settinges.style.display = 'block';
}
function hidestng(){
    const settinges = document.getElementById("settinges");
    settinges.style.display = 'none';
}









const slider = document.getElementById("volumeSlider");
const progress = document.getElementById("progress");
const thumb = document.getElementById("thumb");

let isDragging = false;

// جلب الصوت المحفوظ
let savedVolume = localStorage.getItem("volume");
let volume = savedVolume !== null ? parseFloat(savedVolume) : 0.5;

// تطبيق الصوت على كل الموقع
function applyVolume(value) {
    document.querySelectorAll("audio, video").forEach(media => {
        media.volume = value;
    });
}

// أول تحميل
applyVolume(volume);
progress.style.width = (volume * 100) + "%";

// تغيير الصوت
function setVolume(clientX) {
    const rect = slider.getBoundingClientRect();
    let percent = (clientX - rect.left) / rect.width;

    percent = Math.max(0, Math.min(1, percent));

    volume = percent;
    progress.style.width = (percent * 100) + "%";

    localStorage.setItem("volume", percent);
    applyVolume(percent);
}

// ماوس
slider.addEventListener("mousedown", e => {
    isDragging = true;
    setVolume(e.clientX);
});

document.addEventListener("mousemove", e => {
    if (isDragging) setVolume(e.clientX);
});

document.addEventListener("mouseup", () => {
    isDragging = false;
});

// لمس الهاتف
slider.addEventListener("touchstart", e => {
    setVolume(e.touches[0].clientX);
});

slider.addEventListener("touchmove", e => {
    setVolume(e.touches[0].clientX);
});






document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
});
