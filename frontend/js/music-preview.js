// Music Preview System
class MusicPreview {
  constructor() {
    this.audioContext = null;
    this.currentAudio = null;
    this.currentPreview = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 30; // 30 seconds preview
    this.updateInterval = null;
  }

  // Initialize audio context
  async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // Create music preview widget
  createPreviewWidget(trackData) {
    const previewId = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return `
      <div class="music-preview" id="${previewId}" data-track-id="${trackData.id}">
        <div class="music-preview-header">
          <img src="${trackData.album?.images?.[0]?.url || '/images/default-album.png'}" 
               alt="Album Cover" class="music-preview-cover" 
               onerror="this.src='/images/default-album.png'">
          <div class="music-preview-info">
            <h6 class="music-preview-title">${trackData.name || 'Unknown Track'}</h6>
            <p class="music-preview-artist">${trackData.artists?.[0]?.name || 'Unknown Artist'}</p>
          </div>
          <div class="music-preview-controls">
            <button class="music-preview-btn" onclick="musicPreview.playPause('${previewId}')" id="playBtn-${previewId}">
              <i class="fas fa-play"></i>
            </button>
            <button class="music-preview-btn" onclick="musicPreview.stop('${previewId}')" id="stopBtn-${previewId}">
              <i class="fas fa-stop"></i>
            </button>
          </div>
        </div>
        <div class="music-preview-progress">
          <div class="music-preview-progress-bar" id="progress-${previewId}"></div>
        </div>
        <div class="music-preview-time">
          <span id="currentTime-${previewId}">0:00</span>
          <span id="duration-${previewId}">0:30</span>
        </div>
        <div class="music-preview-loading d-none" id="loading-${previewId}">
          <i class="fas fa-spinner fa-spin"></i> Yükleniyor...
        </div>
        <div class="music-preview-error d-none" id="error-${previewId}">
          Önizleme yüklenemedi
        </div>
      </div>
    `;
  }

  // Play or pause music
  async playPause(previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    const trackId = preview.getAttribute('data-track-id');
    const playBtn = document.getElementById(`playBtn-${previewId}`);
    const loadingEl = document.getElementById(`loading-${previewId}`);
    const errorEl = document.getElementById(`error-${previewId}`);

    // Stop current preview if different
    if (this.currentPreview && this.currentPreview !== previewId) {
      await this.stop(this.currentPreview);
    }

    if (this.isPlaying && this.currentPreview === previewId) {
      // Pause current
      await this.pause();
    } else {
      // Play new or resume
      await this.play(trackId, previewId);
    }
  }

  // Play music
  async play(trackId, previewId) {
    try {
      await this.initAudioContext();
      
      // Show loading
      const loadingEl = document.getElementById(`loading-${previewId}`);
      const errorEl = document.getElementById(`error-${previewId}`);
      const playBtn = document.getElementById(`playBtn-${previewId}`);
      
      loadingEl?.classList.remove('d-none');
      errorEl?.classList.add('d-none');
      playBtn?.setAttribute('disabled', 'true');

      // Get track details first
      const trackData = await this.getTrackDetails(trackId);
      if (!trackData || !trackData.preview_url) {
        throw new Error('Preview not available');
      }

      // Stop current audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // Create new audio
      this.currentAudio = new Audio(trackData.preview_url);
      this.currentAudio.crossOrigin = 'anonymous';
      
      // Set up audio events
      this.currentAudio.addEventListener('loadeddata', () => {
        loadingEl?.classList.add('d-none');
        playBtn?.removeAttribute('disabled');
        this.updatePlayButton(previewId, true);
      });

      this.currentAudio.addEventListener('error', () => {
        loadingEl?.classList.add('d-none');
        errorEl?.classList.remove('d-none');
        playBtn?.removeAttribute('disabled');
      });

      this.currentAudio.addEventListener('ended', () => {
        this.stop(previewId);
      });

      // Play audio
      await this.currentAudio.play();
      
      this.isPlaying = true;
      this.currentPreview = previewId;
      this.currentTime = 0;
      
      // Start progress update
      this.startProgressUpdate(previewId);
      
    } catch (error) {
      console.error('Music preview error:', error);
      const loadingEl = document.getElementById(`loading-${previewId}`);
      const errorEl = document.getElementById(`error-${previewId}`);
      const playBtn = document.getElementById(`playBtn-${previewId}`);
      
      loadingEl?.classList.add('d-none');
      errorEl?.classList.remove('d-none');
      playBtn?.removeAttribute('disabled');
    }
  }

  // Pause music
  async pause() {
    if (this.currentAudio && this.isPlaying) {
      this.currentAudio.pause();
      this.isPlaying = false;
      this.updatePlayButton(this.currentPreview, false);
      this.stopProgressUpdate();
    }
  }

  // Stop music
  async stop(previewId) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    this.isPlaying = false;
    this.currentPreview = null;
    this.currentTime = 0;
    
    this.updatePlayButton(previewId, false);
    this.stopProgressUpdate();
    this.resetProgress(previewId);
  }

  // Get track preview URL from Spotify
  async getTrackPreviewUrl(trackId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/spotify/track/${trackId}`);
      const data = await response.json();
      return data.preview_url;
    } catch (error) {
      console.error('Error fetching track preview:', error);
      return null;
    }
  }

  // Get track details for preview
  async getTrackDetails(trackId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/spotify/track/${trackId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching track details:', error);
      return null;
    }
  }

  // Update play button
  updatePlayButton(previewId, isPlaying) {
    const playBtn = document.getElementById(`playBtn-${previewId}`);
    if (playBtn) {
      const icon = playBtn.querySelector('i');
      if (icon) {
        icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
      }
    }
  }

  // Start progress update
  startProgressUpdate(previewId) {
    this.stopProgressUpdate();
    this.updateInterval = setInterval(() => {
      if (this.currentAudio && this.isPlaying) {
        this.currentTime = this.currentAudio.currentTime;
        this.updateProgress(previewId);
      }
    }, 100);
  }

  // Stop progress update
  stopProgressUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Update progress bar
  updateProgress(previewId) {
    const progressBar = document.getElementById(`progress-${previewId}`);
    const currentTimeEl = document.getElementById(`currentTime-${previewId}`);
    
    if (progressBar && this.duration > 0) {
      const progress = (this.currentTime / this.duration) * 100;
      progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
    
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.currentTime);
    }
  }

  // Reset progress
  resetProgress(previewId) {
    const progressBar = document.getElementById(`progress-${previewId}`);
    const currentTimeEl = document.getElementById(`currentTime-${previewId}`);
    
    if (progressBar) {
      progressBar.style.width = '0%';
    }
    
    if (currentTimeEl) {
      currentTimeEl.textContent = '0:00';
    }
  }

  // Format time
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Add music preview to post card
  addToPostCard(postCard, trackData) {
    if (!trackData) return;
    
    const previewContainer = postCard.querySelector('.music-preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = this.createPreviewWidget(trackData);
    } else {
      // Create container if it doesn't exist
      const container = document.createElement('div');
      container.className = 'music-preview-container';
      container.innerHTML = this.createPreviewWidget(trackData);
      postCard.appendChild(container);
    }
  }

  // Create preview widget from music data (for post cards)
  createPreviewWidgetFromMusicData(musicData) {
    if (!musicData || !musicData.trackId) return '';
    
    const previewId = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return `
      <div class="music-preview" id="${previewId}" data-track-id="${musicData.trackId}">
        <div class="music-preview-header">
          <img src="${musicData.coverUrl || '/images/default-album.png'}" 
               alt="Album Cover" class="music-preview-cover" 
               onerror="this.src='/images/default-album.png'">
          <div class="music-preview-info">
            <h6 class="music-preview-title">${musicData.trackName || 'Unknown Track'}</h6>
            <p class="music-preview-artist">${musicData.artistName || 'Unknown Artist'}</p>
          </div>
          <div class="music-preview-controls">
            <button class="music-preview-btn" onclick="musicPreview.playPause('${previewId}')" id="playBtn-${previewId}">
              <i class="fas fa-play"></i>
            </button>
            <button class="music-preview-btn" onclick="musicPreview.stop('${previewId}')" id="stopBtn-${previewId}">
              <i class="fas fa-stop"></i>
            </button>
          </div>
        </div>
        <div class="music-preview-progress">
          <div class="music-preview-progress-bar" id="progress-${previewId}"></div>
        </div>
        <div class="music-preview-time">
          <span id="currentTime-${previewId}">0:00</span>
          <span id="duration-${previewId}">0:30</span>
        </div>
        <div class="music-preview-loading d-none" id="loading-${previewId}">
          <i class="fas fa-spinner fa-spin"></i> Yükleniyor...
        </div>
        <div class="music-preview-error d-none" id="error-${previewId}">
          Önizleme yüklenemedi
        </div>
      </div>
    `;
  }
}

// Initialize music preview system
const musicPreview = new MusicPreview();

// Add music preview to existing post cards
function addMusicPreviewsToPosts() {
  const postCards = document.querySelectorAll('.card[data-post-id]');
  
  postCards.forEach(async (card) => {
    const postId = card.getAttribute('data-post-id');
    if (!postId) return;
    
    // Check if post has music data
    const musicContainer = card.querySelector('.music-preview-container[data-music]');
    if (musicContainer) {
      try {
        const musicData = JSON.parse(musicContainer.getAttribute('data-music'));
        if (musicData && musicData.trackId) {
          musicContainer.innerHTML = musicPreview.createPreviewWidgetFromMusicData(musicData);
        }
      } catch (error) {
        console.error('Error parsing music data:', error);
      }
    }
  });
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  addMusicPreviewsToPosts();
});

// Re-initialize when new content is loaded
document.addEventListener('contentLoaded', () => {
  addMusicPreviewsToPosts();
});

// Re-initialize when posts are loaded
document.addEventListener('postsLoaded', () => {
  addMusicPreviewsToPosts();
});

// Re-initialize when search results are loaded
document.addEventListener('searchResultsLoaded', () => {
  addMusicPreviewsToPosts();
});

// Re-initialize when pagination loads more posts
document.addEventListener('paginationLoaded', () => {
  addMusicPreviewsToPosts();
});

// Re-initialize when category posts are loaded
document.addEventListener('categoryPostsLoaded', () => {
  addMusicPreviewsToPosts();
});

// Re-initialize when latest posts are loaded
document.addEventListener('latestPostsLoaded', () => {
  addMusicPreviewsToPosts();
});

// Re-initialize when popular posts are loaded
document.addEventListener('popularPostsLoaded', () => {
  addMusicPreviewsToPosts();
});

// Export for global use
window.musicPreview = musicPreview;
