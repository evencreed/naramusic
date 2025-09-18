// Profile Management System
class ProfileManager {
  constructor() {
    this.currentUser = null;
    this.profileData = null;
    this.musicPreferences = null;
    this.init();
  }

  // Initialize profile manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadProfileData();
  }

  // Load current user from localStorage
  loadCurrentUser() {
    const userData = localStorage.getItem('user');
    if (userData) {
      this.currentUser = JSON.parse(userData);
    } else {
      // Redirect to login if no user
      window.location.href = '../index.html';
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Profile edit button
    document.getElementById('editProfileBtn')?.addEventListener('click', () => {
      this.openProfileEditModal();
    });

    // Music preferences buttons
    document.getElementById('editGenresBtn')?.addEventListener('click', () => {
      this.openMusicPreferencesModal('genres');
    });

    document.getElementById('editMoodBtn')?.addEventListener('click', () => {
      this.openMusicPreferencesModal('mood');
    });

    // Save buttons
    document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
      this.saveProfile();
    });

    document.getElementById('saveMusicPreferencesBtn')?.addEventListener('click', () => {
      this.saveMusicPreferences();
    });

    // Tab change events
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
      tab.addEventListener('shown.bs.tab', (e) => {
        const target = e.target.getAttribute('data-bs-target');
        this.loadTabContent(target);
      });
    });

    // Music collection filters
    document.getElementById('musicGenreFilter')?.addEventListener('change', () => {
      this.filterMusicCollection();
    });

    document.getElementById('musicMoodFilter')?.addEventListener('change', () => {
      this.filterMusicCollection();
    });

    document.getElementById('musicSortFilter')?.addEventListener('change', () => {
      this.filterMusicCollection();
    });

    // Quick action buttons
    document.getElementById('createPostBtn')?.addEventListener('click', () => {
      window.location.href = 'newpost.html';
    });

    document.getElementById('addMusicBtn')?.addEventListener('click', () => {
      this.openMusicSearchModal();
    });
  }

  // Load profile data
  async loadProfileData() {
    if (!this.currentUser) return;

    try {
      // Load user profile
      const response = await fetch(`${BACKEND_BASE}/api/users/${this.currentUser.id}`);
      if (response.ok) {
        this.profileData = await response.json();
        this.displayProfileData();
      }

      // Load music preferences
      await this.loadMusicPreferences();

      // Load user stats
      await this.loadUserStats();

    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  }

  // Display profile data
  displayProfileData() {
    if (!this.profileData) return;

    // Basic info
    document.getElementById('profileUsername').textContent = this.profileData.username || 'Kullanıcı';
    document.getElementById('profileEmail').textContent = this.profileData.email || '';
    document.getElementById('profileBio').textContent = this.profileData.bio || 'Henüz profil açıklaması eklenmemiş.';

    // Avatar
    const avatar = document.getElementById('profileAvatar');
    if (this.profileData.avatarUrl) {
      avatar.src = this.profileData.avatarUrl;
    }

    // Fill edit form
    document.getElementById('editUsername').value = this.profileData.username || '';
    document.getElementById('editEmail').value = this.profileData.email || '';
    document.getElementById('editBio').value = this.profileData.bio || '';
    document.getElementById('editLocation').value = this.profileData.location || '';
    document.getElementById('editWebsite').value = this.profileData.website || '';
  }

  // Load music preferences
  async loadMusicPreferences() {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/users/${this.currentUser.id}/music-preferences`);
      if (response.ok) {
        this.musicPreferences = await response.json();
        this.displayMusicPreferences();
      }
    } catch (error) {
      console.error('Error loading music preferences:', error);
      // Initialize empty preferences
      this.musicPreferences = {
        favoriteGenres: [],
        musicMood: [],
        favoriteArtist: '',
        favoriteSong: '',
        totalListened: 0,
        mostListened: '',
        listeningStats: {}
      };
      this.displayMusicPreferences();
    }
  }

  // Display music preferences
  displayMusicPreferences() {
    if (!this.musicPreferences) return;

    // Display favorite genres
    const genresContainer = document.getElementById('favoriteGenres');
    if (genresContainer) {
      genresContainer.innerHTML = this.musicPreferences.favoriteGenres?.map(genre => 
        `<span class="badge bg-primary me-1 mb-1">${genre}</span>`
      ).join('') || '<span class="text-muted">Henüz tür seçilmemiş</span>';
    }

    // Display music mood
    const moodContainer = document.getElementById('musicMood');
    if (moodContainer) {
      moodContainer.innerHTML = this.musicPreferences.musicMood?.map(mood => 
        `<span class="badge bg-info me-1 mb-1">${mood}</span>`
      ).join('') || '<span class="text-muted">Henüz ruh hali seçilmemiş</span>';
    }

    // Display stats
    document.getElementById('totalListened').textContent = this.musicPreferences.totalListened || 0;
    document.getElementById('mostListened').textContent = this.musicPreferences.mostListened || '-';
    document.getElementById('favoriteArtist').textContent = this.musicPreferences.favoriteArtist || '-';

    // Fill preferences form
    this.fillMusicPreferencesForm();
  }

  // Fill music preferences form
  fillMusicPreferencesForm() {
    if (!this.musicPreferences) return;

    // Check genre checkboxes
    this.musicPreferences.favoriteGenres?.forEach(genre => {
      const checkbox = document.getElementById(`genre${genre.charAt(0).toUpperCase() + genre.slice(1)}`);
      if (checkbox) checkbox.checked = true;
    });

    // Check mood checkboxes
    this.musicPreferences.musicMood?.forEach(mood => {
      const checkbox = document.getElementById(`mood${mood.charAt(0).toUpperCase() + mood.slice(1)}`);
      if (checkbox) checkbox.checked = true;
    });

    // Fill text fields
    document.getElementById('prefFavoriteArtist').value = this.musicPreferences.favoriteArtist || '';
    document.getElementById('prefFavoriteSong').value = this.musicPreferences.favoriteSong || '';
  }

  // Load user stats
  async loadUserStats() {
    try {
      // Load user posts
      const postsResponse = await fetch(`${BACKEND_BASE}/api/users/${this.currentUser.id}/posts`);
      if (postsResponse.ok) {
        const posts = await postsResponse.json();
        document.getElementById('profilePosts').textContent = posts.length;
      }

      // Load user comments (this would need a new endpoint)
      // For now, we'll set a placeholder
      document.getElementById('profileComments').textContent = '0';

      // Load user likes (this would need a new endpoint)
      // For now, we'll set a placeholder
      document.getElementById('profileLikes').textContent = '0';

    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  }

  // Load tab content
  async loadTabContent(tabId) {
    switch (tabId) {
      case '#posts':
        await this.loadMyPosts();
        break;
      case '#comments':
        await this.loadMyComments();
        break;
      case '#favorites':
        await this.loadMyFavorites();
        break;
      case '#music':
        await this.loadMyMusicCollection();
        break;
    }
  }

  // Load my posts
  async loadMyPosts() {
    const container = document.getElementById('myPostsList');
    const loading = document.getElementById('myPostsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/users/${this.currentUser.id}/posts`);
      if (response.ok) {
        const posts = await response.json();
        
        if (posts.length === 0) {
          container.innerHTML = '<div class="col-12 text-center py-4"><p class="text-muted">Henüz gönderi paylaşmamışsınız.</p></div>';
        } else {
          container.innerHTML = posts.map(post => `
            <div class="col-md-6 mb-3">
              <div class="card h-100">
                <div class="card-body">
                  <h6 class="card-title">${post.title}</h6>
                  <p class="card-text small">${post.content.substring(0, 100)}...</p>
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${new Date(post.createdAt).toLocaleDateString('tr-TR')}</small>
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-primary" onclick="window.location.href='post.html?id=${post.id}'">
                        <i class="fas fa-eye"></i>
                      </button>
                      <button class="btn btn-outline-secondary" onclick="editPost('${post.id}')">
                        <i class="fas fa-edit"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (error) {
      console.error('Error loading my posts:', error);
      container.innerHTML = '<div class="col-12 text-center py-4"><p class="text-danger">Gönderiler yüklenemedi.</p></div>';
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load my comments
  async loadMyComments() {
    const container = document.getElementById('myCommentsList');
    const loading = document.getElementById('myCommentsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      // This would need a new endpoint for user comments
      // For now, show placeholder
      container.innerHTML = '<div class="text-center py-4"><p class="text-muted">Yorumlar yükleniyor...</p></div>';
    } catch (error) {
      console.error('Error loading my comments:', error);
      container.innerHTML = '<div class="text-center py-4"><p class="text-danger">Yorumlar yüklenemedi.</p></div>';
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load my favorites
  async loadMyFavorites() {
    const container = document.getElementById('myFavoritesList');
    const loading = document.getElementById('myFavoritesLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/users/me/bookmarks`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const favorites = await response.json();
        
        if (favorites.length === 0) {
          container.innerHTML = '<div class="col-12 text-center py-4"><p class="text-muted">Henüz favori gönderiniz yok.</p></div>';
        } else {
          container.innerHTML = favorites.map(post => `
            <div class="col-md-6 mb-3">
              <div class="card h-100">
                <div class="card-body">
                  <h6 class="card-title">${post.title}</h6>
                  <p class="card-text small">${post.content.substring(0, 100)}...</p>
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${new Date(post.createdAt).toLocaleDateString('tr-TR')}</small>
                    <button class="btn btn-outline-primary btn-sm" onclick="window.location.href='post.html?id=${post.id}'">
                      <i class="fas fa-eye"></i> Görüntüle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (error) {
      console.error('Error loading my favorites:', error);
      container.innerHTML = '<div class="col-12 text-center py-4"><p class="text-danger">Favoriler yüklenemedi.</p></div>';
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load my music collection
  async loadMyMusicCollection() {
    const container = document.getElementById('myMusicList');
    const loading = document.getElementById('myMusicLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      // This would need a new endpoint for user music collection
      // For now, show placeholder
      container.innerHTML = '<div class="col-12 text-center py-4"><p class="text-muted">Müzik koleksiyonunuz yükleniyor...</p></div>';
    } catch (error) {
      console.error('Error loading my music collection:', error);
      container.innerHTML = '<div class="col-12 text-center py-4"><p class="text-danger">Müzik koleksiyonu yüklenemedi.</p></div>';
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Open profile edit modal
  openProfileEditModal() {
    const modal = new bootstrap.Modal(document.getElementById('profileEditModal'));
    modal.show();
  }

  // Open music preferences modal
  openMusicPreferencesModal(type) {
    const modal = new bootstrap.Modal(document.getElementById('musicPreferencesModal'));
    modal.show();
  }

  // Save profile
  async saveProfile() {
    const formData = {
      username: document.getElementById('editUsername').value,
      email: document.getElementById('editEmail').value,
      bio: document.getElementById('editBio').value,
      location: document.getElementById('editLocation').value,
      website: document.getElementById('editWebsite').value
    };

    try {
      const response = await fetch(`${BACKEND_BASE}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        this.profileData = updatedUser.user;
        this.displayProfileData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('profileEditModal'));
        modal.hide();
        
        alert('Profil başarıyla güncellendi!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Profil güncellenirken hata oluştu.');
    }
  }

  // Save music preferences
  async saveMusicPreferences() {
    const formData = {
      favoriteGenres: Array.from(document.querySelectorAll('input[name="genres"]:checked')).map(cb => cb.value),
      musicMood: Array.from(document.querySelectorAll('input[name="moods"]:checked')).map(cb => cb.value),
      favoriteArtist: document.getElementById('prefFavoriteArtist').value,
      favoriteSong: document.getElementById('prefFavoriteSong').value
    };

    try {
      const response = await fetch(`${BACKEND_BASE}/api/users/me/music-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        this.musicPreferences = await response.json();
        this.displayMusicPreferences();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('musicPreferencesModal'));
        modal.hide();
        
        alert('Müzik tercihleri başarıyla güncellendi!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error saving music preferences:', error);
      alert('Müzik tercihleri güncellenirken hata oluştu.');
    }
  }

  // Filter music collection
  filterMusicCollection() {
    // This would implement filtering logic
    console.log('Filtering music collection...');
  }

  // Open music search modal
  openMusicSearchModal() {
    // This would open the music search modal
    console.log('Opening music search modal...');
  }
}

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProfileManager();
});

// Global functions for inline event handlers
function editPost(postId) {
  // This would open post edit modal
  console.log('Editing post:', postId);
}
