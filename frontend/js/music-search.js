// Music Search System
class MusicSearch {
  constructor() {
    this.searchInput = null;
    this.searchResults = null;
    this.searchTimeout = null;
    this.currentQuery = '';
    this.selectedTrack = null;
  }

  // Initialize music search
  init() {
    this.searchInput = document.getElementById('musicSearchInput');
    this.searchResults = document.getElementById('musicSearchResults');
    
    if (!this.searchInput || !this.searchResults) return;

    // Setup search input
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearchInput(e.target.value);
    });

    // Setup search results click handling
    this.searchResults.addEventListener('click', (e) => {
      this.handleTrackSelection(e);
    });
  }

  // Handle search input
  handleSearchInput(query) {
    this.currentQuery = query.trim();
    
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Show loading state
    if (this.currentQuery.length > 2) {
      this.showLoadingState();
      
      // Debounce search
      this.searchTimeout = setTimeout(() => {
        this.searchTracks(this.currentQuery);
      }, 500);
    } else {
      this.showEmptyState();
    }
  }

  // Search tracks on Spotify
  async searchTracks(query) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/spotify/search?q=${encodeURIComponent(query)}&type=track&limit=20`);
      const data = await response.json();
      
      if (data.tracks && data.tracks.items) {
        this.displaySearchResults(data.tracks.items);
      } else {
        this.showNoResultsState();
      }
    } catch (error) {
      console.error('Music search error:', error);
      this.showErrorState();
    }
  }

  // Display search results
  displaySearchResults(tracks) {
    if (!tracks || tracks.length === 0) {
      this.showNoResultsState();
      return;
    }

    this.searchResults.innerHTML = tracks.map(track => `
      <div class="col-md-6 mb-3">
        <div class="card music-search-result" data-track-id="${track.id}">
          <div class="card-body p-3">
            <div class="d-flex align-items-center gap-3">
              <img src="${track.album?.images?.[0]?.url || '/images/default-album.png'}" 
                   alt="Album Cover" 
                   class="music-search-cover"
                   onerror="this.src='/images/default-album.png'">
              <div class="flex-grow-1">
                <h6 class="music-search-title mb-1">${track.name}</h6>
                <p class="music-search-artist mb-1">${track.artists?.[0]?.name || 'Unknown Artist'}</p>
                <small class="text-muted">${track.album?.name || 'Unknown Album'}</small>
              </div>
              <div class="music-search-actions">
                ${track.preview_url ? `
                  <button class="btn btn-sm btn-outline-primary music-preview-btn" 
                          data-track-id="${track.id}" 
                          title="Önizle">
                    <i class="fas fa-play"></i>
                  </button>
                ` : ''}
                <button class="btn btn-sm btn-primary music-select-btn" 
                        data-track-id="${track.id}" 
                        title="Seç">
                  <i class="fas fa-check"></i>
                </button>
              </div>
            </div>
            ${track.preview_url ? `
              <div class="music-preview-container mt-2" id="preview-${track.id}"></div>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Setup preview buttons
    this.setupPreviewButtons();
  }

  // Setup preview buttons
  setupPreviewButtons() {
    const previewButtons = this.searchResults.querySelectorAll('.music-preview-btn');
    previewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackId = btn.getAttribute('data-track-id');
        this.togglePreview(trackId);
      });
    });
  }

  // Toggle music preview
  async togglePreview(trackId) {
    const previewContainer = document.getElementById(`preview-${trackId}`);
    if (!previewContainer) return;

    // If preview already exists, remove it
    if (previewContainer.innerHTML.trim()) {
      previewContainer.innerHTML = '';
      return;
    }

    try {
      // Get track details
      const response = await fetch(`${BACKEND_BASE}/api/spotify/track/${trackId}`);
      const trackData = await response.json();
      
      if (trackData && trackData.preview_url) {
        // Create preview widget
        const previewWidget = musicPreview.createPreviewWidget(trackData);
        previewContainer.innerHTML = previewWidget;
      }
    } catch (error) {
      console.error('Error loading track preview:', error);
    }
  }

  // Handle track selection
  handleTrackSelection(e) {
    const selectBtn = e.target.closest('.music-select-btn');
    if (!selectBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const trackId = selectBtn.getAttribute('data-track-id');
    const card = selectBtn.closest('.music-search-result');
    
    if (card && trackId) {
      this.selectTrack(trackId, card);
    }
  }

  // Select track
  selectTrack(trackId, cardElement) {
    // Get track data from card
    const title = cardElement.querySelector('.music-search-title')?.textContent || '';
    const artist = cardElement.querySelector('.music-search-artist')?.textContent || '';
    const album = cardElement.querySelector('small')?.textContent || '';
    const coverUrl = cardElement.querySelector('.music-search-cover')?.src || '';

    // Store selected track
    this.selectedTrack = {
      id: trackId,
      name: title,
      artist: artist,
      album: album,
      coverUrl: coverUrl
    };

    // Update UI to show selection
    this.updateSelectionUI(cardElement);

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('musicSearchModal'));
    if (modal) {
      modal.hide();
    }

    // Trigger custom event
    document.dispatchEvent(new CustomEvent('trackSelected', {
      detail: this.selectedTrack
    }));
  }

  // Update selection UI
  updateSelectionUI(selectedCard) {
    // Remove previous selection
    this.searchResults.querySelectorAll('.music-search-result').forEach(card => {
      card.classList.remove('selected');
    });

    // Add selection to current card
    selectedCard.classList.add('selected');
  }

  // Show loading state
  showLoadingState() {
    this.searchResults.innerHTML = `
      <div class="col-12 text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Aranıyor...</span>
        </div>
        <div class="text-muted mt-2">Müzik aranıyor...</div>
      </div>
    `;
  }

  // Show empty state
  showEmptyState() {
    this.searchResults.innerHTML = `
      <div class="col-12 text-center py-4">
        <div class="text-muted">Arama yapmak için yukarıdaki alana yazın</div>
      </div>
    `;
  }

  // Show no results state
  showNoResultsState() {
    this.searchResults.innerHTML = `
      <div class="col-12 text-center py-4">
        <div class="text-muted">Arama kriterlerinize uygun müzik bulunamadı</div>
      </div>
    `;
  }

  // Show error state
  showErrorState() {
    this.searchResults.innerHTML = `
      <div class="col-12 text-center py-4">
        <div class="text-danger">Arama sırasında bir hata oluştu</div>
      </div>
    `;
  }

  // Get selected track
  getSelectedTrack() {
    return this.selectedTrack;
  }

  // Clear selection
  clearSelection() {
    this.selectedTrack = null;
  }
}

// Initialize music search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const musicSearch = new MusicSearch();
  musicSearch.init();
  
  // Make it globally available
  window.musicSearch = musicSearch;
});

// CSS for music search results
const musicSearchStyles = `
  .music-search-result {
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .music-search-result:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  
  .music-search-result.selected {
    border-color: var(--accent);
    background: rgba(154, 208, 255, 0.05);
  }
  
  .music-search-cover {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
  }
  
  .music-search-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  
  .music-search-artist {
    font-size: 12px;
    color: var(--muted);
    margin: 0;
  }
  
  .music-search-actions {
    display: flex;
    gap: 4px;
  }
  
  .music-search-actions .btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = musicSearchStyles;
document.head.appendChild(styleSheet);
