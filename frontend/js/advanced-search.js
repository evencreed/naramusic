// Advanced Music Search System
class AdvancedMusicSearch {
  constructor() {
    this.searchResults = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.searchFilters = {
      query: '',
      genre: '',
      artist: '',
      album: '',
      year: '',
      mood: '',
      rating: '',
      sortBy: 'relevance'
    };
    this.init();
  }

  // Initialize advanced search
  init() {
    this.setupEventListeners();
    this.loadGenres();
    this.loadMoods();
  }

  // Setup event listeners
  setupEventListeners() {
    // Search form submission
    const searchForm = document.getElementById('advancedSearchForm');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.performSearch();
      });
    }

    // Real-time search on input change
    const searchInput = document.getElementById('advancedSearchInput');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.updateFilters();
          this.performSearch();
        }, 300);
      });
    }

    // Filter changes
    const filterElements = [
      'genreFilter', 'artistFilter', 'albumFilter', 
      'yearFilter', 'moodFilter', 'ratingFilter', 'sortByFilter'
    ];

    filterElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => {
          this.updateFilters();
          this.performSearch();
        });
      }
    });

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.clearFilters();
      });
    }

    // Pagination
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('advanced-search-page-btn')) {
        const page = parseInt(e.target.getAttribute('data-page'));
        this.goToPage(page);
      }
    });
  }

  // Load available genres
  async loadGenres() {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/spotify/genres`);
      if (response.ok) {
        const genres = await response.json();
        this.populateGenreFilter(genres);
      }
    } catch (error) {
      console.error('Error loading genres:', error);
      // Use fallback genres
      this.populateGenreFilter([
        'rock', 'pop', 'jazz', 'classical', 'electronic', 
        'hip-hop', 'country', 'blues', 'reggae', 'folk'
      ]);
    }
  }

  // Load available moods
  loadMoods() {
    const moods = [
      'happy', 'sad', 'energetic', 'calm', 'romantic', 
      'angry', 'nostalgic', 'uplifting', 'melancholic', 'peaceful'
    ];
    this.populateMoodFilter(moods);
  }

  // Populate genre filter dropdown
  populateGenreFilter(genres) {
    const genreFilter = document.getElementById('genreFilter');
    if (genreFilter) {
      genreFilter.innerHTML = '<option value="">Tüm Türler</option>';
      genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre.charAt(0).toUpperCase() + genre.slice(1);
        genreFilter.appendChild(option);
      });
    }
  }

  // Populate mood filter dropdown
  populateMoodFilter(moods) {
    const moodFilter = document.getElementById('moodFilter');
    if (moodFilter) {
      moodFilter.innerHTML = '<option value="">Tüm Ruh Halleri</option>';
      moods.forEach(mood => {
        const option = document.createElement('option');
        option.value = mood;
        option.textContent = this.translateMood(mood);
        moodFilter.appendChild(option);
      });
    }
  }

  // Translate mood to Turkish
  translateMood(mood) {
    const translations = {
      'happy': 'Mutlu',
      'sad': 'Hüzünlü',
      'energetic': 'Enerjik',
      'calm': 'Sakin',
      'romantic': 'Romantik',
      'angry': 'Öfkeli',
      'nostalgic': 'Nostaljik',
      'uplifting': 'Moral Verici',
      'melancholic': 'Melankolik',
      'peaceful': 'Huzurlu'
    };
    return translations[mood] || mood;
  }

  // Update search filters from form
  updateFilters() {
    this.searchFilters = {
      query: document.getElementById('advancedSearchInput')?.value || '',
      genre: document.getElementById('genreFilter')?.value || '',
      artist: document.getElementById('artistFilter')?.value || '',
      album: document.getElementById('albumFilter')?.value || '',
      year: document.getElementById('yearFilter')?.value || '',
      mood: document.getElementById('moodFilter')?.value || '',
      rating: document.getElementById('ratingFilter')?.value || '',
      sortBy: document.getElementById('sortByFilter')?.value || 'relevance'
    };
  }

  // Perform advanced search
  async performSearch(page = 1) {
    this.currentPage = page;
    const searchResults = document.getElementById('advancedSearchResults');
    const searchLoading = document.getElementById('advancedSearchLoading');
    
    if (searchLoading) searchLoading.classList.remove('d-none');
    if (searchResults) searchResults.innerHTML = '';

    try {
      const params = new URLSearchParams();
      
      // Add search parameters
      Object.keys(this.searchFilters).forEach(key => {
        if (this.searchFilters[key]) {
          params.append(key, this.searchFilters[key]);
        }
      });
      
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`${BACKEND_BASE}/api/search/advanced?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        this.searchResults = data.results;
        this.totalPages = data.totalPages;
        this.renderSearchResults();
        this.renderPagination();
        this.updateSearchInfo(data.total);
      } else {
        this.showError('Arama sırasında hata oluştu.');
      }
    } catch (error) {
      console.error('Error performing advanced search:', error);
      this.showError('Arama sırasında hata oluştu.');
    } finally {
      if (searchLoading) searchLoading.classList.add('d-none');
    }
  }

  // Render search results
  renderSearchResults() {
    const container = document.getElementById('advancedSearchResults');
    if (!container) return;

    if (this.searchResults.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-search fa-3x text-muted mb-3"></i>
            <h5>Sonuç bulunamadı</h5>
            <p class="text-muted">Farklı arama kriterleri deneyebilirsiniz.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.searchResults.map(result => this.createResultCard(result)).join('');
    
    // Initialize music previews and ratings for results
    document.dispatchEvent(new CustomEvent('searchResultsLoaded'));
  }

  // Create result card HTML
  createResultCard(result) {
    const ratingStars = result.averageRating ? 
      `<div class="result-rating">
        <div class="rating-stars">
          ${this.generateStarRating(result.averageRating)}
        </div>
        <span class="rating-value">${result.averageRating.toFixed(1)}</span>
      </div>` : '';

    const musicPreview = result.musicData ? 
      `<div class="music-preview-container" data-music='${JSON.stringify(result.musicData)}'></div>` : '';

    return `
      <div class="col-lg-6 mb-3">
        <div class="card result-card h-100">
          <div class="card-body">
            <div class="row">
              <div class="col-auto">
                <img src="${result.image || '/images/default-music.png'}" 
                     alt="${result.title}" 
                     class="result-image">
              </div>
              <div class="col">
                <h6 class="result-title">${result.title}</h6>
                <p class="result-artist text-muted">${result.artist}</p>
                ${result.album ? `<p class="result-album small">${result.album}</p>` : ''}
                ${result.year ? `<span class="badge bg-secondary">${result.year}</span>` : ''}
                ${result.genre ? `<span class="badge bg-primary ms-1">${result.genre}</span>` : ''}
                ${ratingStars}
              </div>
            </div>
            ${musicPreview}
            <div class="result-actions mt-2">
              <button class="btn btn-sm btn-outline-primary" onclick="addToPlaylist('${result.id}')">
                <i class="fas fa-plus"></i> Oynatma Listesi
              </button>
              <button class="btn btn-sm btn-outline-success" onclick="shareTrack('${result.id}')">
                <i class="fas fa-share"></i> Paylaş
              </button>
              ${result.spotifyUrl ? 
                `<a href="${result.spotifyUrl}" target="_blank" class="btn btn-sm btn-outline-info">
                  <i class="fab fa-spotify"></i> Spotify
                </a>` : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate star rating HTML
  generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';

    for (let i = 0; i < fullStars; i++) {
      stars += '<i class="fas fa-star text-warning"></i>';
    }

    if (hasHalfStar) {
      stars += '<i class="fas fa-star-half-alt text-warning"></i>';
    }

    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars += '<i class="far fa-star text-muted"></i>';
    }

    return stars;
  }

  // Render pagination
  renderPagination() {
    const container = document.getElementById('advancedSearchPagination');
    if (!container || this.totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let pagination = '<nav><ul class="pagination justify-content-center">';

    // Previous button
    if (this.currentPage > 1) {
      pagination += `
        <li class="page-item">
          <button class="page-link advanced-search-page-btn" data-page="${this.currentPage - 1}">
            <i class="fas fa-chevron-left"></i>
          </button>
        </li>
      `;
    }

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage ? 'active' : '';
      pagination += `
        <li class="page-item ${isActive}">
          <button class="page-link advanced-search-page-btn" data-page="${i}">${i}</button>
        </li>
      `;
    }

    // Next button
    if (this.currentPage < this.totalPages) {
      pagination += `
        <li class="page-item">
          <button class="page-link advanced-search-page-btn" data-page="${this.currentPage + 1}">
            <i class="fas fa-chevron-right"></i>
          </button>
        </li>
      `;
    }

    pagination += '</ul></nav>';
    container.innerHTML = pagination;
  }

  // Go to specific page
  goToPage(page) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.performSearch(page);
    }
  }

  // Update search info
  updateSearchInfo(total) {
    const infoElement = document.getElementById('searchResultsInfo');
    if (infoElement) {
      const start = (this.currentPage - 1) * 20 + 1;
      const end = Math.min(this.currentPage * 20, total);
      infoElement.textContent = `${total} sonuçtan ${start}-${end} arası gösteriliyor`;
    }
  }

  // Clear all filters
  clearFilters() {
    document.getElementById('advancedSearchInput').value = '';
    document.getElementById('genreFilter').value = '';
    document.getElementById('artistFilter').value = '';
    document.getElementById('albumFilter').value = '';
    document.getElementById('yearFilter').value = '';
    document.getElementById('moodFilter').value = '';
    document.getElementById('ratingFilter').value = '';
    document.getElementById('sortByFilter').value = 'relevance';
    
    this.searchFilters = {
      query: '',
      genre: '',
      artist: '',
      album: '',
      year: '',
      mood: '',
      rating: '',
      sortBy: 'relevance'
    };
    
    this.performSearch();
  }

  // Show error message
  showError(message) {
    const container = document.getElementById('advancedSearchResults');
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

  // Get current search filters
  getCurrentFilters() {
    return { ...this.searchFilters };
  }

  // Set search filters
  setFilters(filters) {
    this.searchFilters = { ...this.searchFilters, ...filters };
    this.updateFormFromFilters();
    this.performSearch();
  }

  // Update form from filters
  updateFormFromFilters() {
    Object.keys(this.searchFilters).forEach(key => {
      const element = document.getElementById(key === 'query' ? 'advancedSearchInput' : `${key}Filter`);
      if (element) {
        element.value = this.searchFilters[key];
      }
    });
  }
}

// Global functions for result actions
function addToPlaylist(trackId) {
  // Implementation for adding to playlist
  console.log('Adding to playlist:', trackId);
  alert('Oynatma listesi özelliği henüz geliştirilmekte.');
}

function shareTrack(trackId) {
  // Implementation for sharing track
  console.log('Sharing track:', trackId);
  if (navigator.share) {
    navigator.share({
      title: 'Müzik Paylaşımı',
      text: 'Bu müziği dinlemelisin!',
      url: window.location.href
    });
  } else {
    // Fallback for browsers that don't support Web Share API
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link kopyalandı!');
    });
  }
}

// Initialize advanced search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('advancedSearchForm')) {
    window.advancedSearch = new AdvancedMusicSearch();
  }
});

// Export for global access
window.AdvancedMusicSearch = AdvancedMusicSearch;
