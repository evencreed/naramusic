// Lyrics Management System
class LyricsManager {
  constructor() {
    this.currentUser = null;
    this.lyricsCache = new Map();
    this.currentLyrics = null;
    this.init();
  }

  // Initialize lyrics manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
  }

  // Load current user from localStorage
  loadCurrentUser() {
    const userData = localStorage.getItem('user');
    if (userData) {
      this.currentUser = JSON.parse(userData);
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Listen for music preview events
    document.addEventListener('musicPreviewLoaded', (e) => {
      this.loadLyricsForTrack(e.detail.trackId);
    });

    // Listen for track selection events
    document.addEventListener('trackSelected', (e) => {
      this.loadLyricsForTrack(e.detail.trackId);
    });
  }

  // Load lyrics for a track
  async loadLyricsForTrack(trackId) {
    if (!trackId) return;

    // Check cache first
    if (this.lyricsCache.has(trackId)) {
      this.displayLyrics(this.lyricsCache.get(trackId));
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/lyrics/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const lyrics = await response.json();
        this.lyricsCache.set(trackId, lyrics);
        this.displayLyrics(lyrics);
      } else if (response.status === 404) {
        this.displayNoLyrics();
      } else {
        console.error('Error loading lyrics:', response.statusText);
        this.displayLyricsError();
      }
    } catch (error) {
      console.error('Error loading lyrics:', error);
      this.displayLyricsError();
    }
  }

  // Display lyrics
  displayLyrics(lyrics) {
    // Find or create lyrics container
    let container = document.getElementById('lyricsContainer');
    if (!container) {
      container = this.createLyricsContainer();
    }

    container.innerHTML = `
      <div class="lyrics-content">
        <div class="lyrics-header">
          <h6 class="lyrics-title">${lyrics.title}</h6>
          <p class="lyrics-artist">${lyrics.artist}</p>
          ${lyrics.album ? `<p class="lyrics-album">${lyrics.album}</p>` : ''}
        </div>
        <div class="lyrics-text">
          ${this.formatLyrics(lyrics.text)}
        </div>
        <div class="lyrics-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="lyricsManager.shareLyrics('${lyrics.trackId}')">
            <i class="fas fa-share"></i> Paylaş
          </button>
          <button class="btn btn-sm btn-outline-secondary" onclick="lyricsManager.copyLyrics('${lyrics.trackId}')">
            <i class="fas fa-copy"></i> Kopyala
          </button>
          ${this.currentUser ? `
            <button class="btn btn-sm btn-outline-success" onclick="lyricsManager.saveLyrics('${lyrics.trackId}')">
              <i class="fas fa-bookmark"></i> Kaydet
            </button>
          ` : ''}
        </div>
        ${lyrics.translation ? `
          <div class="lyrics-translation">
            <h6>Çeviri</h6>
            <div class="translation-text">
              ${this.formatLyrics(lyrics.translation)}
            </div>
          </div>
        ` : ''}
        <div class="lyrics-footer">
          <small class="text-muted">
            Kaynak: ${lyrics.source || 'Bilinmiyor'} | 
            ${lyrics.language || 'Türkçe'} | 
            ${lyrics.isExplicit ? 'Açık İçerik' : 'Genel İçerik'}
          </small>
        </div>
      </div>
    `;

    this.currentLyrics = lyrics;
    this.showLyricsContainer();
  }

  // Display no lyrics message
  displayNoLyrics() {
    let container = document.getElementById('lyricsContainer');
    if (!container) {
      container = this.createLyricsContainer();
    }

    container.innerHTML = `
      <div class="lyrics-content">
        <div class="lyrics-empty">
          <i class="fas fa-music fa-3x text-muted mb-3"></i>
          <h6>Şarkı Sözleri Bulunamadı</h6>
          <p class="text-muted">Bu şarkı için söz bulunamadı.</p>
          <button class="btn btn-sm btn-outline-primary" onclick="lyricsManager.requestLyrics()">
            <i class="fas fa-plus"></i> Söz Ekle
          </button>
        </div>
      </div>
    `;

    this.showLyricsContainer();
  }

  // Display lyrics error
  displayLyricsError() {
    let container = document.getElementById('lyricsContainer');
    if (!container) {
      container = this.createLyricsContainer();
    }

    container.innerHTML = `
      <div class="lyrics-content">
        <div class="lyrics-error">
          <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
          <h6>Sözler Yüklenemedi</h6>
          <p class="text-muted">Şarkı sözleri yüklenirken bir hata oluştu.</p>
          <button class="btn btn-sm btn-outline-primary" onclick="lyricsManager.retryLoadLyrics()">
            <i class="fas fa-redo"></i> Tekrar Dene
          </button>
        </div>
      </div>
    `;

    this.showLyricsContainer();
  }

  // Create lyrics container
  createLyricsContainer() {
    const container = document.createElement('div');
    container.id = 'lyricsContainer';
    container.className = 'lyrics-container';
    
    // Add to page
    const mainContent = document.querySelector('main .container') || document.querySelector('main');
    if (mainContent) {
      mainContent.appendChild(container);
    }
    
    return container;
  }

  // Show lyrics container
  showLyricsContainer() {
    const container = document.getElementById('lyricsContainer');
    if (container) {
      container.style.display = 'block';
      container.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Hide lyrics container
  hideLyricsContainer() {
    const container = document.getElementById('lyricsContainer');
    if (container) {
      container.style.display = 'none';
    }
  }

  // Format lyrics text
  formatLyrics(text) {
    if (!text) return '';
    
    // Split by lines and format
    const lines = text.split('\n');
    return lines.map(line => {
      if (line.trim() === '') {
        return '<br>';
      }
      return `<div class="lyrics-line">${this.escapeHtml(line)}</div>`;
    }).join('');
  }

  // Escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Share lyrics
  shareLyrics(trackId) {
    if (!this.currentLyrics) return;

    const lyrics = this.currentLyrics;
    const shareText = `${lyrics.title} - ${lyrics.artist}\n\n${lyrics.text}`;
    
    if (navigator.share) {
      navigator.share({
        title: `${lyrics.title} - ${lyrics.artist}`,
        text: shareText,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Şarkı sözleri kopyalandı!');
      });
    }
  }

  // Copy lyrics
  copyLyrics(trackId) {
    if (!this.currentLyrics) return;

    const lyrics = this.currentLyrics;
    const lyricsText = lyrics.text;
    
    navigator.clipboard.writeText(lyricsText).then(() => {
      alert('Şarkı sözleri kopyalandı!');
    });
  }

  // Save lyrics
  async saveLyrics(trackId) {
    if (!this.currentUser || !this.currentLyrics) return;

    try {
      const response = await fetch(`${BACKEND_BASE}/api/lyrics/${trackId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          lyrics: this.currentLyrics.text,
          translation: this.currentLyrics.translation
        })
      });

      if (response.ok) {
        alert('Şarkı sözleri kaydedildi!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error saving lyrics:', error);
      alert('Şarkı sözleri kaydedilirken hata oluştu.');
    }
  }

  // Request lyrics
  requestLyrics() {
    // This would open a modal for requesting lyrics
    console.log('Requesting lyrics...');
    alert('Şarkı sözü ekleme özelliği geliştirilmekte.');
  }

  // Retry load lyrics
  retryLoadLyrics() {
    // This would retry loading lyrics
    console.log('Retrying lyrics load...');
    // You would need to store the current track ID to retry
  }

  // Search lyrics
  async searchLyrics(query) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/lyrics/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const results = await response.json();
        return results;
      }
    } catch (error) {
      console.error('Error searching lyrics:', error);
    }
    return [];
  }

  // Get saved lyrics
  async getSavedLyrics() {
    if (!this.currentUser) return [];

    try {
      const response = await fetch(`${BACKEND_BASE}/api/lyrics/saved`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting saved lyrics:', error);
    }
    return [];
  }

  // Get lyrics by track ID
  async getLyricsByTrackId(trackId) {
    if (this.lyricsCache.has(trackId)) {
      return this.lyricsCache.get(trackId);
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/lyrics/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const lyrics = await response.json();
        this.lyricsCache.set(trackId, lyrics);
        return lyrics;
      }
    } catch (error) {
      console.error('Error getting lyrics by track ID:', error);
    }
    return null;
  }

  // Clear lyrics cache
  clearCache() {
    this.lyricsCache.clear();
  }

  // Get current lyrics
  getCurrentLyrics() {
    return this.currentLyrics;
  }
}

// Initialize lyrics manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.lyricsManager = new LyricsManager();
});

// Export for global access
window.LyricsManager = LyricsManager;
