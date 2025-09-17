// Music Rating System
class MusicRating {
  constructor() {
    this.currentUser = null;
    this.ratings = new Map(); // Cache for ratings
    this.init();
  }

  // Initialize rating system
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
    // Listen for posts loaded events
    document.addEventListener('postsLoaded', () => {
      this.initializeRatings();
    });

    document.addEventListener('contentLoaded', () => {
      this.initializeRatings();
    });

    document.addEventListener('searchResultsLoaded', () => {
      this.initializeRatings();
    });

    document.addEventListener('paginationLoaded', () => {
      this.initializeRatings();
    });

    document.addEventListener('categoryPostsLoaded', () => {
      this.initializeRatings();
    });

    document.addEventListener('latestPostsLoaded', () => {
      this.initializeRatings();
    });

    document.addEventListener('popularPostsLoaded', () => {
      this.initializeRatings();
    });
  }

  // Initialize ratings for all music previews
  initializeRatings() {
    const musicPreviews = document.querySelectorAll('.music-preview-container[data-music]');
    musicPreviews.forEach(container => {
      this.addRatingWidget(container);
    });
  }

  // Add rating widget to music preview container
  addRatingWidget(container) {
    const musicData = JSON.parse(container.getAttribute('data-music'));
    if (!musicData || !musicData.id) return;

    // Check if rating widget already exists
    if (container.querySelector('.music-rating-widget')) return;

    const ratingWidget = this.createRatingWidget(musicData);
    container.appendChild(ratingWidget);

    // Load existing rating
    this.loadRating(musicData.id, container);
  }

  // Create rating widget HTML
  createRatingWidget(musicData) {
    const widget = document.createElement('div');
    widget.className = 'music-rating-widget';
    widget.innerHTML = `
      <div class="music-rating-header">
        <span class="music-rating-label">Puanla:</span>
        <div class="music-rating-stars" data-music-id="${musicData.id}">
          ${this.createStarHTML()}
        </div>
        <span class="music-rating-value">0/10</span>
      </div>
      <div class="music-rating-stats">
        <small class="music-rating-average">Ortalama: <span class="average-value">-</span></small>
        <small class="music-rating-count">(<span class="count-value">0</span> değerlendirme)</small>
      </div>
    `;

    // Add event listeners for stars
    const stars = widget.querySelectorAll('.music-rating-star');
    stars.forEach((star, index) => {
      star.addEventListener('click', () => {
        this.rateMusic(musicData.id, index + 1, widget);
      });

      star.addEventListener('mouseenter', () => {
        this.highlightStars(stars, index + 1);
      });

      star.addEventListener('mouseleave', () => {
        this.resetStarHighlight(stars, musicData.id, widget);
      });
    });

    return widget;
  }

  // Create star HTML
  createStarHTML() {
    let stars = '';
    for (let i = 1; i <= 10; i++) {
      stars += `<i class="fas fa-star music-rating-star" data-rating="${i}"></i>`;
    }
    return stars;
  }

  // Rate music
  async rateMusic(musicId, rating, widget) {
    if (!this.currentUser) {
      alert('Lütfen giriş yapın.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/music/${musicId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ rating })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update UI
        this.updateRatingDisplay(widget, rating, result.average, result.count);
        
        // Cache the rating
        this.ratings.set(musicId, { rating, average: result.average, count: result.count });
        
        // Show success message
        this.showRatingMessage('Puanınız kaydedildi!', 'success');
      } else {
        const error = await response.json();
        this.showRatingMessage('Hata: ' + error.error, 'error');
      }
    } catch (error) {
      console.error('Error rating music:', error);
      this.showRatingMessage('Puan kaydedilirken hata oluştu.', 'error');
    }
  }

  // Load existing rating
  async loadRating(musicId, container) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/music/${musicId}/rating`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const widget = container.querySelector('.music-rating-widget');
        if (widget) {
          this.updateRatingDisplay(widget, data.userRating, data.average, data.count);
          this.ratings.set(musicId, { 
            rating: data.userRating, 
            average: data.average, 
            count: data.count 
          });
        }
      }
    } catch (error) {
      console.error('Error loading rating:', error);
    }
  }

  // Update rating display
  updateRatingDisplay(widget, userRating, average, count) {
    const stars = widget.querySelectorAll('.music-rating-star');
    const valueSpan = widget.querySelector('.music-rating-value');
    const averageSpan = widget.querySelector('.average-value');
    const countSpan = widget.querySelector('.count-value');

    // Update stars
    stars.forEach((star, index) => {
      if (index < userRating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });

    // Update values
    valueSpan.textContent = `${userRating}/10`;
    averageSpan.textContent = average.toFixed(1);
    countSpan.textContent = count;
  }

  // Highlight stars on hover
  highlightStars(stars, rating) {
    stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('highlight');
      } else {
        star.classList.remove('highlight');
      }
    });
  }

  // Reset star highlight
  resetStarHighlight(stars, musicId, widget) {
    const cachedRating = this.ratings.get(musicId);
    const userRating = cachedRating ? cachedRating.rating : 0;
    
    stars.forEach((star, index) => {
      star.classList.remove('highlight');
      if (index < userRating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }

  // Show rating message
  showRatingMessage(message, type) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    
    // Add to page
    document.body.appendChild(toast);
    
    // Show animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Get rating for music
  getRating(musicId) {
    return this.ratings.get(musicId);
  }

  // Get average rating for music
  async getAverageRating(musicId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/music/${musicId}/rating`);
      if (response.ok) {
        const data = await response.json();
        return data.average;
      }
    } catch (error) {
      console.error('Error getting average rating:', error);
    }
    return 0;
  }

  // Get top rated music
  async getTopRatedMusic(limit = 10) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/music/top-rated?limit=${limit}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting top rated music:', error);
    }
    return [];
  }
}

// Initialize music rating system
document.addEventListener('DOMContentLoaded', () => {
  window.musicRating = new MusicRating();
});

// Export for global access
window.MusicRating = MusicRating;
