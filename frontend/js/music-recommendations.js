// Music Recommendation System
class MusicRecommendations {
  constructor() {
    this.currentUser = null;
    this.userPreferences = null;
    this.recommendations = [];
    this.recommendationTypes = {
      basedOnHistory: 'Tarihçeye Göre',
      basedOnPreferences: 'Tercihlere Göre',
      basedOnSimilarUsers: 'Benzer Kullanıcılara Göre',
      basedOnTrending: 'Trend Olan',
      basedOnMood: 'Ruh Haline Göre',
      basedOnGenre: 'Türe Göre'
    };
    this.init();
  }

  // Initialize recommendation system
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadUserPreferences();
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
    // Recommendation type buttons
    document.querySelectorAll('.recommendation-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.getAttribute('data-type');
        this.loadRecommendations(type);
      });
    });

    // Refresh recommendations
    document.getElementById('refreshRecommendationsBtn')?.addEventListener('click', () => {
      this.refreshRecommendations();
    });

    // Like/Unlike recommendations
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('recommendation-like-btn')) {
        const trackId = e.target.getAttribute('data-track-id');
        this.toggleLikeRecommendation(trackId, e.target);
      }
    });

    // Add to playlist buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-to-playlist-btn')) {
        const trackId = e.target.getAttribute('data-track-id');
        this.addToPlaylist(trackId);
      }
    });
  }

  // Load user preferences
  async loadUserPreferences() {
    if (!this.currentUser) return;

    try {
      const response = await fetch(`${BACKEND_BASE}/api/users/${this.currentUser.id}/music-preferences`);
      if (response.ok) {
        this.userPreferences = await response.json();
        this.loadRecommendations('basedOnPreferences');
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  }

  // Load recommendations based on type
  async loadRecommendations(type = 'basedOnPreferences') {
    const container = document.getElementById('recommendationsContainer');
    const loading = document.getElementById('recommendationsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const params = new URLSearchParams({ type });
      const response = await fetch(`${BACKEND_BASE}/api/recommendations?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.recommendations = data.recommendations;
        this.renderRecommendations(data.recommendations, type);
        this.updateRecommendationTypeButtons(type);
      } else {
        this.showError('Öneriler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      this.showError('Öneriler yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Render recommendations
  renderRecommendations(recommendations, type) {
    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    if (recommendations.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-music fa-3x text-muted mb-3"></i>
            <h5>Öneri bulunamadı</h5>
            <p class="text-muted">Daha fazla müzik dinleyerek önerilerimizi geliştirebilirsiniz.</p>
          </div>
        </div>
      `;
      return;
    }

    const typeTitle = this.recommendationTypes[type] || 'Öneriler';
    container.innerHTML = `
      <div class="col-12 mb-3">
        <h5>${typeTitle}</h5>
        <p class="text-muted small">Size özel olarak seçilmiş ${recommendations.length} öneri</p>
      </div>
      ${recommendations.map(rec => this.createRecommendationCard(rec, type)).join('')}
    `;

    // Initialize music previews for recommendations
    document.dispatchEvent(new CustomEvent('recommendationsLoaded'));
  }

  // Create recommendation card
  createRecommendationCard(recommendation, type) {
    const confidence = Math.round(recommendation.confidence * 100);
    const reason = this.getRecommendationReason(recommendation, type);
    
    return `
      <div class="col-lg-4 col-md-6 mb-3">
        <div class="card recommendation-card h-100">
          <div class="card-body">
            <div class="row align-items-start">
              <div class="col-auto">
                <img src="${recommendation.image || '/images/default-music.png'}" 
                     alt="${recommendation.title}" 
                     class="recommendation-cover">
              </div>
              <div class="col">
                <h6 class="recommendation-title">${recommendation.title}</h6>
                <p class="recommendation-artist text-muted">${recommendation.artist}</p>
                <div class="recommendation-meta">
                  <span class="badge bg-primary">${recommendation.genre || 'Müzik'}</span>
                  <span class="badge bg-info">${confidence}% uyum</span>
                </div>
                <p class="recommendation-reason small text-muted mt-2">
                  <i class="fas fa-lightbulb"></i> ${reason}
                </p>
              </div>
            </div>
            
            ${recommendation.musicData ? `
              <div class="music-preview-container mt-3" data-music='${JSON.stringify(recommendation.musicData)}'></div>
            ` : ''}
            
            <div class="recommendation-actions mt-3">
              <button class="btn btn-sm btn-outline-primary recommendation-like-btn" data-track-id="${recommendation.id}">
                <i class="fas fa-heart"></i> Beğen
              </button>
              <button class="btn btn-sm btn-outline-success add-to-playlist-btn" data-track-id="${recommendation.id}">
                <i class="fas fa-plus"></i> Listeye Ekle
              </button>
              <button class="btn btn-sm btn-outline-info" onclick="window.open('${recommendation.spotifyUrl}', '_blank')">
                <i class="fab fa-spotify"></i> Spotify
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Get recommendation reason
  getRecommendationReason(recommendation, type) {
    const reasons = {
      basedOnHistory: 'Daha önce dinlediğiniz müziklere benzer',
      basedOnPreferences: 'Müzik tercihlerinize uygun',
      basedOnSimilarUsers: 'Sizinle benzer zevklere sahip kullanıcıların beğendiği',
      basedOnTrending: 'Şu anda popüler olan',
      basedOnMood: 'Mevcut ruh halinize uygun',
      basedOnGenre: 'Sevdiğiniz türde'
    };
    
    return reasons[type] || 'Size özel olarak seçilmiş';
  }

  // Update recommendation type buttons
  updateRecommendationTypeButtons(activeType) {
    document.querySelectorAll('.recommendation-type-btn').forEach(btn => {
      const type = btn.getAttribute('data-type');
      if (type === activeType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Toggle like recommendation
  async toggleLikeRecommendation(trackId, button) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/recommendations/${trackId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const icon = button.querySelector('i');
        
        if (data.liked) {
          icon.classList.remove('far');
          icon.classList.add('fas');
          button.classList.add('btn-primary');
          button.classList.remove('btn-outline-primary');
        } else {
          icon.classList.remove('fas');
          icon.classList.add('far');
          button.classList.remove('btn-primary');
          button.classList.add('btn-outline-primary');
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  // Add to playlist
  addToPlaylist(trackId) {
    // This would open playlist selection modal
    console.log('Adding to playlist:', trackId);
    alert('Oynatma listesi seçimi özelliği geliştirilmekte.');
  }

  // Refresh recommendations
  refreshRecommendations() {
    const activeType = document.querySelector('.recommendation-type-btn.active')?.getAttribute('data-type') || 'basedOnPreferences';
    this.loadRecommendations(activeType);
  }

  // Get personalized recommendations
  async getPersonalizedRecommendations() {
    if (!this.currentUser) return [];

    try {
      const response = await fetch(`${BACKEND_BASE}/api/recommendations/personalized`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
    }
    return [];
  }

  // Get trending recommendations
  async getTrendingRecommendations() {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/recommendations/trending`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting trending recommendations:', error);
    }
    return [];
  }

  // Get mood-based recommendations
  async getMoodRecommendations(mood) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/recommendations/mood?mood=${encodeURIComponent(mood)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting mood recommendations:', error);
    }
    return [];
  }

  // Get genre-based recommendations
  async getGenreRecommendations(genre) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/recommendations/genre?genre=${encodeURIComponent(genre)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting genre recommendations:', error);
    }
    return [];
  }

  // Show error message
  showError(message) {
    const container = document.getElementById('recommendationsContainer');
    if (container) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
          </div>
        </div>
      `;
    }
  }

  // Get current recommendations
  getCurrentRecommendations() {
    return this.recommendations;
  }

  // Get recommendation types
  getRecommendationTypes() {
    return this.recommendationTypes;
  }
}

// Initialize music recommendations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('recommendationsContainer')) {
    window.musicRecommendations = new MusicRecommendations();
  }
});

// Export for global access
window.MusicRecommendations = MusicRecommendations;
