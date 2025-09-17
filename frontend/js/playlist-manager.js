// Playlist Management System
class PlaylistManager {
  constructor() {
    this.currentUser = null;
    this.currentPlaylist = null;
    this.playlists = [];
    this.init();
  }

  // Initialize playlist manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadPlaylists();
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
    // Create playlist button
    document.getElementById('createPlaylistBtn')?.addEventListener('click', () => {
      this.openCreatePlaylistModal();
    });

    // Save playlist button
    document.getElementById('savePlaylistBtn')?.addEventListener('click', () => {
      this.createPlaylist();
    });

    // Update playlist button
    document.getElementById('updatePlaylistBtn')?.addEventListener('click', () => {
      this.updatePlaylist();
    });

    // Delete playlist button
    document.getElementById('deletePlaylistBtn')?.addEventListener('click', () => {
      this.deletePlaylist();
    });

    // Tab change events
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
      tab.addEventListener('shown.bs.tab', (e) => {
        const target = e.target.getAttribute('data-bs-target');
        this.loadTabContent(target);
      });
    });

    // Sort buttons
    document.getElementById('sortByDateBtn')?.addEventListener('click', () => {
      this.sortPlaylists('date');
    });

    document.getElementById('sortByNameBtn')?.addEventListener('click', () => {
      this.sortPlaylists('name');
    });

    document.getElementById('sortByTracksBtn')?.addEventListener('click', () => {
      this.sortPlaylists('tracks');
    });

    // Public playlist filter
    document.getElementById('publicGenreFilter')?.addEventListener('change', () => {
      this.filterPublicPlaylists();
    });

    // Refresh public playlists
    document.getElementById('refreshPublicBtn')?.addEventListener('click', () => {
      this.loadPublicPlaylists();
    });

    // Music search for adding to playlist
    const musicSearchInput = document.getElementById('musicSearchInput');
    if (musicSearchInput) {
      let searchTimeout;
      musicSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchMusicForPlaylist(e.target.value);
        }, 300);
      });
    }
  }

  // Load playlists based on current tab
  async loadPlaylists() {
    const activeTab = document.querySelector('.nav-link.active');
    if (!activeTab) return;

    const target = activeTab.getAttribute('data-bs-target');
    this.loadTabContent(target);
  }

  // Load tab content
  async loadTabContent(tabId) {
    switch (tabId) {
      case '#my-playlists':
        await this.loadMyPlaylists();
        break;
      case '#public-playlists':
        await this.loadPublicPlaylists();
        break;
      case '#featured-playlists':
        await this.loadFeaturedPlaylists();
        break;
    }
  }

  // Load my playlists
  async loadMyPlaylists() {
    const container = document.getElementById('myPlaylistsList');
    const loading = document.getElementById('myPlaylistsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/playlists/my`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        this.playlists = await response.json();
        this.renderPlaylists(container, this.playlists);
      } else {
        this.showError(container, 'Listeler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading my playlists:', error);
      this.showError(container, 'Listeler yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load public playlists
  async loadPublicPlaylists() {
    const container = document.getElementById('publicPlaylistsList');
    const loading = document.getElementById('publicPlaylistsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const genre = document.getElementById('publicGenreFilter')?.value || '';
      const params = genre ? `?genre=${encodeURIComponent(genre)}` : '';
      
      const response = await fetch(`${BACKEND_BASE}/api/playlists/public${params}`);

      if (response.ok) {
        const playlists = await response.json();
        this.renderPlaylists(container, playlists, true);
      } else {
        this.showError(container, 'Herkese açık listeler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading public playlists:', error);
      this.showError(container, 'Herkese açık listeler yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load featured playlists
  async loadFeaturedPlaylists() {
    const container = document.getElementById('featuredPlaylistsList');
    const loading = document.getElementById('featuredPlaylistsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/playlists/featured`);

      if (response.ok) {
        const playlists = await response.json();
        this.renderPlaylists(container, playlists, true);
      } else {
        this.showError(container, 'Öne çıkan listeler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading featured playlists:', error);
      this.showError(container, 'Öne çıkan listeler yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Render playlists
  renderPlaylists(container, playlists, isPublic = false) {
    if (playlists.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-music fa-3x text-muted mb-3"></i>
            <h5>Henüz liste yok</h5>
            <p class="text-muted">${isPublic ? 'Herkese açık liste bulunamadı.' : 'Henüz oynatma listesi oluşturmamışsınız.'}</p>
            ${!isPublic ? '<button class="btn btn-primary" onclick="playlistManager.openCreatePlaylistModal()">İlk Listeni Oluştur</button>' : ''}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = playlists.map(playlist => this.createPlaylistCard(playlist, isPublic)).join('');
  }

  // Create playlist card HTML
  createPlaylistCard(playlist, isPublic = false) {
    const isOwner = !isPublic && playlist.userId === this.currentUser?.id;
    const trackCount = playlist.tracks ? playlist.tracks.length : 0;
    const duration = this.calculatePlaylistDuration(playlist.tracks || []);
    
    return `
      <div class="col-lg-4 col-md-6 mb-3">
        <div class="card playlist-card h-100">
          <div class="card-img-top playlist-cover" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 200px; position: relative;">
            <div class="playlist-overlay">
              <div class="playlist-info">
                <h6 class="playlist-title">${playlist.name}</h6>
                <p class="playlist-meta">
                  <i class="fas fa-music"></i> ${trackCount} şarkı
                  ${duration ? `<br><i class="fas fa-clock"></i> ${duration}` : ''}
                </p>
              </div>
              <div class="playlist-actions">
                <button class="btn btn-sm btn-light" onclick="playlistManager.playPlaylist('${playlist.id}')">
                  <i class="fas fa-play"></i>
                </button>
                ${isOwner ? `
                  <button class="btn btn-sm btn-outline-light" onclick="playlistManager.editPlaylist('${playlist.id}')">
                    <i class="fas fa-edit"></i>
                  </button>
                ` : ''}
                <button class="btn btn-sm btn-outline-light" onclick="playlistManager.viewPlaylist('${playlist.id}')">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="card-body">
            <h6 class="card-title">${playlist.name}</h6>
            <p class="card-text small text-muted">${playlist.description || 'Açıklama yok'}</p>
            <div class="d-flex justify-content-between align-items-center">
              <div class="playlist-tags">
                ${playlist.genre ? `<span class="badge bg-primary me-1">${playlist.genre}</span>` : ''}
                ${playlist.mood ? `<span class="badge bg-info">${playlist.mood}</span>` : ''}
              </div>
              <small class="text-muted">
                ${isPublic ? `@${playlist.username}` : 'Sizin listeniz'}
              </small>
            </div>
            <div class="playlist-stats mt-2">
              <small class="text-muted">
                <i class="fas fa-heart"></i> ${playlist.likes || 0} beğeni
                <i class="fas fa-share ms-2"></i> ${playlist.shares || 0} paylaşım
              </small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Calculate playlist duration
  calculatePlaylistDuration(tracks) {
    if (!tracks || tracks.length === 0) return null;
    
    // This would calculate total duration from track durations
    // For now, return a placeholder
    const totalMinutes = tracks.length * 3.5; // Average 3.5 minutes per track
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    
    if (hours > 0) {
      return `${hours}s ${minutes}dk`;
    }
    return `${minutes}dk`;
  }

  // Open create playlist modal
  openCreatePlaylistModal() {
    if (!this.currentUser) {
      alert('Lütfen giriş yapın.');
      return;
    }

    const modal = new bootstrap.Modal(document.getElementById('createPlaylistModal'));
    modal.show();
  }

  // Create new playlist
  async createPlaylist() {
    const formData = {
      name: document.getElementById('playlistName').value,
      description: document.getElementById('playlistDescription').value,
      genre: document.getElementById('playlistGenre').value,
      mood: document.getElementById('playlistMood').value,
      isPublic: document.getElementById('playlistPublic').checked,
      isCollaborative: document.getElementById('playlistCollaborative').checked
    };

    if (!formData.name.trim()) {
      alert('Lütfen liste adı girin.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const playlist = await response.json();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createPlaylistModal'));
        modal.hide();
        
        // Reset form
        document.getElementById('createPlaylistForm').reset();
        
        // Reload playlists
        this.loadMyPlaylists();
        
        alert('Oynatma listesi oluşturuldu!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('Liste oluşturulurken hata oluştu.');
    }
  }

  // Edit playlist
  async editPlaylist(playlistId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/playlists/${playlistId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const playlist = await response.json();
        this.currentPlaylist = playlist;
        this.fillEditForm(playlist);
        
        const modal = new bootstrap.Modal(document.getElementById('editPlaylistModal'));
        modal.show();
      } else {
        alert('Liste bilgileri alınamadı.');
      }
    } catch (error) {
      console.error('Error loading playlist:', error);
      alert('Liste yüklenirken hata oluştu.');
    }
  }

  // Fill edit form
  fillEditForm(playlist) {
    document.getElementById('editPlaylistId').value = playlist.id;
    document.getElementById('editPlaylistName').value = playlist.name;
    document.getElementById('editPlaylistDescription').value = playlist.description || '';
    document.getElementById('editPlaylistGenre').value = playlist.genre || '';
    document.getElementById('editPlaylistMood').value = playlist.mood || '';
    document.getElementById('editPlaylistPublic').checked = playlist.isPublic || false;
    document.getElementById('editPlaylistCollaborative').checked = playlist.isCollaborative || false;
  }

  // Update playlist
  async updatePlaylist() {
    const playlistId = document.getElementById('editPlaylistId').value;
    const formData = {
      name: document.getElementById('editPlaylistName').value,
      description: document.getElementById('editPlaylistDescription').value,
      genre: document.getElementById('editPlaylistGenre').value,
      mood: document.getElementById('editPlaylistMood').value,
      isPublic: document.getElementById('editPlaylistPublic').checked,
      isCollaborative: document.getElementById('editPlaylistCollaborative').checked
    };

    if (!formData.name.trim()) {
      alert('Lütfen liste adı girin.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/playlists/${playlistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editPlaylistModal'));
        modal.hide();
        
        // Reload playlists
        this.loadMyPlaylists();
        
        alert('Oynatma listesi güncellendi!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error updating playlist:', error);
      alert('Liste güncellenirken hata oluştu.');
    }
  }

  // Delete playlist
  async deletePlaylist() {
    if (!confirm('Bu oynatma listesini silmek istediğinizden emin misiniz?')) {
      return;
    }

    const playlistId = document.getElementById('editPlaylistId').value;

    try {
      const response = await fetch(`${BACKEND_BASE}/api/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editPlaylistModal'));
        modal.hide();
        
        // Reload playlists
        this.loadMyPlaylists();
        
        alert('Oynatma listesi silindi!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert('Liste silinirken hata oluştu.');
    }
  }

  // Play playlist
  playPlaylist(playlistId) {
    // This would implement playlist playback
    console.log('Playing playlist:', playlistId);
    alert('Oynatma özelliği geliştirilmekte.');
  }

  // View playlist details
  viewPlaylist(playlistId) {
    // This would open playlist detail page
    console.log('Viewing playlist:', playlistId);
    window.location.href = `playlist-detail.html?id=${playlistId}`;
  }

  // Sort playlists
  sortPlaylists(sortBy) {
    if (!this.playlists || this.playlists.length === 0) return;

    switch (sortBy) {
      case 'name':
        this.playlists.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'date':
        this.playlists.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'tracks':
        this.playlists.sort((a, b) => (b.tracks?.length || 0) - (a.tracks?.length || 0));
        break;
    }

    const container = document.getElementById('myPlaylistsList');
    if (container) {
      this.renderPlaylists(container, this.playlists);
    }
  }

  // Filter public playlists
  filterPublicPlaylists() {
    this.loadPublicPlaylists();
  }

  // Search music for playlist
  async searchMusicForPlaylist(query) {
    if (!query.trim()) {
      document.getElementById('musicSearchResults').innerHTML = '';
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/spotify/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        this.renderMusicSearchResults(data.tracks.items);
      }
    } catch (error) {
      console.error('Error searching music:', error);
    }
  }

  // Render music search results
  renderMusicSearchResults(tracks) {
    const container = document.getElementById('musicSearchResults');
    if (!container) return;

    if (tracks.length === 0) {
      container.innerHTML = '<div class="col-12 text-center py-3"><p class="text-muted">Sonuç bulunamadı.</p></div>';
      return;
    }

    container.innerHTML = tracks.map(track => `
      <div class="col-12 mb-2">
        <div class="card music-search-result">
          <div class="card-body py-2">
            <div class="row align-items-center">
              <div class="col-auto">
                <img src="${track.album.images[0]?.url || '/images/default-music.png'}" 
                     alt="${track.name}" class="music-search-cover">
              </div>
              <div class="col">
                <h6 class="music-search-title mb-0">${track.name}</h6>
                <p class="music-search-artist mb-0">${track.artists.map(a => a.name).join(', ')}</p>
              </div>
              <div class="col-auto">
                <button class="btn btn-sm btn-primary" onclick="playlistManager.addTrackToPlaylist('${track.id}')">
                  <i class="fas fa-plus"></i> Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Add track to playlist
  async addTrackToPlaylist(trackId) {
    if (!this.currentPlaylist) {
      alert('Lütfen önce bir oynatma listesi seçin.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/playlists/${this.currentPlaylist.id}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ trackId })
      });

      if (response.ok) {
        alert('Şarkı listeye eklendi!');
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addMusicModal'));
        modal.hide();
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      alert('Şarkı eklenirken hata oluştu.');
    }
  }

  // Show error message
  showError(container, message) {
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

// Initialize playlist manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.playlistManager = new PlaylistManager();
});

// Export for global access
window.PlaylistManager = PlaylistManager;
