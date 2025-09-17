// Social Features Management System
class SocialManager {
  constructor() {
    this.currentUser = null;
    this.friends = [];
    this.followers = [];
    this.following = [];
    this.notifications = [];
    this.socialFeed = [];
    this.currentTab = 'feed';
    this.init();
  }

  // Initialize social manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadSocialData();
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
    // Tab change events
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
      tab.addEventListener('shown.bs.tab', (e) => {
        const target = e.target.getAttribute('data-bs-target');
        this.switchTab(target);
      });
    });

    // Refresh button
    document.getElementById('refreshSocialBtn')?.addEventListener('click', () => {
      this.refreshSocialData();
    });

    // Search users button
    document.getElementById('searchUsersBtn')?.addEventListener('click', () => {
      this.openSearchUsersModal();
    });

    // User search input
    document.getElementById('userSearchInput')?.addEventListener('input', (e) => {
      this.searchUsers(e.target.value);
    });

    // Sort buttons
    document.getElementById('sortFriendsByNameBtn')?.addEventListener('click', () => {
      this.sortFriends('name');
    });

    document.getElementById('sortFriendsByActivityBtn')?.addEventListener('click', () => {
      this.sortFriends('activity');
    });

    // Load more feed button
    document.getElementById('loadMoreFeedBtn')?.addEventListener('click', () => {
      this.loadMoreFeed();
    });

    // Mark all notifications as read
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
      this.markAllNotificationsAsRead();
    });

    // Follow user button
    document.getElementById('followUserBtn')?.addEventListener('click', () => {
      this.followUser();
    });
  }

  // Switch tab
  switchTab(tabId) {
    this.currentTab = tabId.replace('#', '');
    this.loadTabContent(tabId);
  }

  // Load tab content
  loadTabContent(tabId) {
    switch (tabId) {
      case '#feed':
        this.loadSocialFeed();
        break;
      case '#friends':
        this.loadFriends();
        break;
      case '#followers':
        this.loadFollowers();
        break;
      case '#following':
        this.loadFollowing();
        break;
      case '#notifications':
        this.loadNotifications();
        break;
    }
  }

  // Load social data
  async loadSocialData() {
    await Promise.all([
      this.loadSocialFeed(),
      this.loadOnlineFriends(),
      this.loadSuggestedFriends()
    ]);
  }

  // Load social feed
  async loadSocialFeed() {
    const container = document.getElementById('socialFeed');
    const loading = document.getElementById('feedLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/feed`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.socialFeed = data.feed;
        this.renderSocialFeed(container, this.socialFeed);
        this.updateLoadMoreButton();
      } else {
        this.showError(container, 'Sosyal akış yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading social feed:', error);
      this.showError(container, 'Sosyal akış yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load friends
  async loadFriends() {
    const container = document.getElementById('friendsList');
    const loading = document.getElementById('friendsLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/friends`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        this.friends = await response.json();
        this.renderFriendsList(container, this.friends);
      } else {
        this.showError(container, 'Arkadaş listesi yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      this.showError(container, 'Arkadaş listesi yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load followers
  async loadFollowers() {
    const container = document.getElementById('followersList');
    const loading = document.getElementById('followersLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/followers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        this.followers = await response.json();
        this.renderUserList(container, this.followers, 'followers');
      } else {
        this.showError(container, 'Takipçi listesi yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading followers:', error);
      this.showError(container, 'Takipçi listesi yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load following
  async loadFollowing() {
    const container = document.getElementById('followingList');
    const loading = document.getElementById('followingLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/following`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        this.following = await response.json();
        this.renderUserList(container, this.following, 'following');
      } else {
        this.showError(container, 'Takip listesi yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading following:', error);
      this.showError(container, 'Takip listesi yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load notifications
  async loadNotifications() {
    const container = document.getElementById('notificationsList');
    const loading = document.getElementById('notificationsLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/notifications`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.notifications = data.notifications;
        this.renderNotifications(container, this.notifications);
        this.updateNotificationBadge(data.unreadCount);
      } else {
        this.showError(container, 'Bildirimler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.showError(container, 'Bildirimler yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load online friends
  async loadOnlineFriends() {
    const container = document.getElementById('onlineFriends');
    if (!container) return;

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/online-friends`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const onlineFriends = await response.json();
        this.renderOnlineFriends(container, onlineFriends);
      }
    } catch (error) {
      console.error('Error loading online friends:', error);
    }
  }

  // Load suggested friends
  async loadSuggestedFriends() {
    const container = document.getElementById('suggestedFriends');
    if (!container) return;

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/suggested-friends`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const suggestedFriends = await response.json();
        this.renderSuggestedFriends(container, suggestedFriends);
      }
    } catch (error) {
      console.error('Error loading suggested friends:', error);
    }
  }

  // Render social feed
  renderSocialFeed(container, feed) {
    if (!container) return;

    if (feed.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-home fa-3x text-muted mb-3"></i>
          <h5>Sosyal akış boş</h5>
          <p class="text-muted">Arkadaşlarınızın aktivitelerini görmek için onları takip edin.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = feed.map(activity => this.createActivityCard(activity)).join('');
  }

  // Create activity card
  createActivityCard(activity) {
    const timeAgo = this.getTimeAgo(activity.createdAt);
    
    return `
      <div class="activity-card mb-3">
        <div class="row">
          <div class="col-auto">
            <img src="${activity.user.avatarUrl || '/images/default-avatar.png'}" 
                 alt="${activity.user.username}" 
                 class="activity-avatar">
          </div>
          <div class="col">
            <div class="activity-content">
              <div class="activity-header">
                <strong>${activity.user.username}</strong>
                <span class="activity-action">${this.getActivityAction(activity.type)}</span>
                <span class="activity-time">${timeAgo}</span>
              </div>
              <div class="activity-body">
                ${this.getActivityContent(activity)}
              </div>
              <div class="activity-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="socialManager.likeActivity('${activity.id}')">
                  <i class="fas fa-heart"></i> ${activity.likes || 0}
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="socialManager.commentActivity('${activity.id}')">
                  <i class="fas fa-comment"></i> ${activity.comments || 0}
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="socialManager.shareActivity('${activity.id}')">
                  <i class="fas fa-share"></i> Paylaş
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Get activity action text
  getActivityAction(type) {
    const actions = {
      'post_created': 'yeni bir gönderi oluşturdu',
      'music_rated': 'bir şarkıyı puanladı',
      'playlist_created': 'yeni bir oynatma listesi oluşturdu',
      'event_joined': 'bir etkinliğe katıldı',
      'friend_added': 'yeni bir arkadaş ekledi'
    };
    return actions[type] || 'bir aktivite gerçekleştirdi';
  }

  // Get activity content
  getActivityContent(activity) {
    switch (activity.type) {
      case 'post_created':
        return `
          <div class="activity-post">
            <h6>${activity.data.title}</h6>
            <p>${activity.data.content.substring(0, 200)}...</p>
            ${activity.data.musicData ? `
              <div class="music-preview-container" data-music='${JSON.stringify(activity.data.musicData)}'></div>
            ` : ''}
          </div>
        `;
      case 'music_rated':
        return `
          <div class="activity-music">
            <div class="row align-items-center">
              <div class="col-auto">
                <img src="${activity.data.image}" alt="${activity.data.title}" class="activity-music-image">
              </div>
              <div class="col">
                <h6>${activity.data.title}</h6>
                <p class="text-muted">${activity.data.artist}</p>
                <div class="music-rating">
                  ${this.renderStars(activity.data.rating)}
                </div>
              </div>
            </div>
          </div>
        `;
      case 'playlist_created':
        return `
          <div class="activity-playlist">
            <h6>${activity.data.name}</h6>
            <p class="text-muted">${activity.data.description}</p>
            <div class="playlist-stats">
              <span class="badge bg-primary">${activity.data.trackCount} şarkı</span>
            </div>
          </div>
        `;
      case 'event_joined':
        return `
          <div class="activity-event">
            <h6>${activity.data.title}</h6>
            <p class="text-muted">${activity.data.venue} - ${activity.data.date}</p>
          </div>
        `;
      default:
        return `<p>${activity.data.description || 'Aktivite detayı yok'}</p>`;
    }
  }

  // Render stars for rating
  renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 10; i++) {
      if (i <= rating) {
        stars += '<i class="fas fa-star text-warning"></i>';
      } else {
        stars += '<i class="far fa-star text-muted"></i>';
      }
    }
    return stars;
  }

  // Render friends list
  renderFriendsList(container, friends) {
    if (!container) return;

    if (friends.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-users fa-3x text-muted mb-3"></i>
            <h5>Henüz arkadaş yok</h5>
            <p class="text-muted">Arkadaş eklemek için kullanıcı arama özelliğini kullanın.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = friends.map(friend => this.createUserCard(friend, 'friend')).join('');
  }

  // Render user list (followers/following)
  renderUserList(container, users, type) {
    if (!container) return;

    if (users.length === 0) {
      const typeText = type === 'followers' ? 'takipçi' : 'takip ettiğiniz kullanıcı';
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-user fa-3x text-muted mb-3"></i>
            <h5>Henüz ${typeText} yok</h5>
            <p class="text-muted">Daha fazla kullanıcı ile etkileşime geçin.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = users.map(user => this.createUserCard(user, type)).join('');
  }

  // Create user card
  createUserCard(user, type) {
    const isOnline = user.isOnline || false;
    const lastSeen = user.lastSeen ? this.getTimeAgo(user.lastSeen) : 'Çevrimdışı';
    
    return `
      <div class="col-md-6 col-lg-4">
        <div class="user-card">
          <div class="user-avatar-container">
            <img src="${user.avatarUrl || '/images/default-avatar.png'}" 
                 alt="${user.username}" 
                 class="user-avatar">
            ${isOnline ? '<div class="online-indicator"></div>' : ''}
          </div>
          <div class="user-info">
            <h6 class="user-name">${user.username}</h6>
            <p class="user-status">${isOnline ? 'Çevrimiçi' : lastSeen}</p>
            <div class="user-stats">
              <span><i class="fas fa-music"></i> ${user.musicCount || 0}</span>
              <span><i class="fas fa-users"></i> ${user.followersCount || 0}</span>
            </div>
            <div class="user-actions">
              <button class="btn btn-sm btn-outline-primary" onclick="socialManager.viewUserProfile('${user.id}')">
                <i class="fas fa-eye"></i> Profil
              </button>
              ${type === 'friend' ? `
                <button class="btn btn-sm btn-outline-danger" onclick="socialManager.removeFriend('${user.id}')">
                  <i class="fas fa-user-minus"></i> Kaldır
                </button>
              ` : type === 'following' ? `
                <button class="btn btn-sm btn-outline-danger" onclick="socialManager.unfollowUser('${user.id}')">
                  <i class="fas fa-user-times"></i> Takibi Bırak
                </button>
              ` : `
                <button class="btn btn-sm btn-outline-success" onclick="socialManager.followUser('${user.id}')">
                  <i class="fas fa-user-plus"></i> Takip Et
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render notifications
  renderNotifications(container, notifications) {
    if (!container) return;

    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-bell fa-3x text-muted mb-3"></i>
          <h5>Bildirim yok</h5>
          <p class="text-muted">Henüz bildiriminiz bulunmuyor.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = notifications.map(notification => this.createNotificationCard(notification)).join('');
  }

  // Create notification card
  createNotificationCard(notification) {
    const timeAgo = this.getTimeAgo(notification.createdAt);
    const isRead = notification.isRead || false;
    
    return `
      <div class="notification-card ${isRead ? '' : 'unread'} mb-3">
        <div class="row align-items-center">
          <div class="col-auto">
            <div class="notification-icon">
              <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
            </div>
          </div>
          <div class="col">
            <div class="notification-content">
              <h6 class="notification-title">${notification.title}</h6>
              <p class="notification-message">${notification.message}</p>
              <span class="notification-time">${timeAgo}</span>
            </div>
          </div>
          <div class="col-auto">
            ${!isRead ? `
              <button class="btn btn-sm btn-outline-primary" onclick="socialManager.markNotificationAsRead('${notification.id}')">
                <i class="fas fa-check"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Get notification icon
  getNotificationIcon(type) {
    const icons = {
      'friend_request': 'fa-user-plus',
      'friend_accepted': 'fa-user-check',
      'like': 'fa-heart',
      'comment': 'fa-comment',
      'follow': 'fa-user-plus',
      'music_rated': 'fa-star'
    };
    return icons[type] || 'fa-bell';
  }

  // Render online friends
  renderOnlineFriends(container, friends) {
    if (!container) return;

    if (friends.length === 0) {
      container.innerHTML = '<p class="text-muted small">Çevrimiçi arkadaş yok.</p>';
      return;
    }

    container.innerHTML = friends.map(friend => `
      <div class="online-friend-item">
        <img src="${friend.avatarUrl || '/images/default-avatar.png'}" 
             alt="${friend.username}" 
             class="online-friend-avatar">
        <span class="online-friend-name">${friend.username}</span>
      </div>
    `).join('');
  }

  // Render suggested friends
  renderSuggestedFriends(container, friends) {
    if (!container) return;

    if (friends.length === 0) {
      container.innerHTML = '<p class="text-muted small">Önerilen arkadaş yok.</p>';
      return;
    }

    container.innerHTML = friends.map(friend => `
      <div class="suggested-friend-item">
        <img src="${friend.avatarUrl || '/images/default-avatar.png'}" 
             alt="${friend.username}" 
             class="suggested-friend-avatar">
        <div class="suggested-friend-info">
          <h6 class="suggested-friend-name">${friend.username}</h6>
          <p class="suggested-friend-reason">${friend.reason}</p>
        </div>
        <button class="btn btn-sm btn-primary" onclick="socialManager.addFriend('${friend.id}')">
          <i class="fas fa-user-plus"></i>
        </button>
      </div>
    `).join('');
  }

  // Search users
  async searchUsers(query) {
    if (!query.trim()) {
      document.getElementById('userSearchResults').innerHTML = '';
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/search-users?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const users = await response.json();
        this.renderUserSearchResults(users);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  }

  // Render user search results
  renderUserSearchResults(users) {
    const container = document.getElementById('userSearchResults');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<p class="text-muted">Kullanıcı bulunamadı.</p>';
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="user-search-result">
        <div class="row align-items-center">
          <div class="col-auto">
            <img src="${user.avatarUrl || '/images/default-avatar.png'}" 
                 alt="${user.username}" 
                 class="user-search-avatar">
          </div>
          <div class="col">
            <h6 class="user-search-name">${user.username}</h6>
            <p class="user-search-info">${user.followersCount || 0} takipçi</p>
          </div>
          <div class="col-auto">
            <button class="btn btn-sm btn-primary" onclick="socialManager.viewUserProfile('${user.id}')">
              <i class="fas fa-eye"></i> Profil
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Open search users modal
  openSearchUsersModal() {
    const modal = new bootstrap.Modal(document.getElementById('searchUsersModal'));
    modal.show();
  }

  // View user profile
  async viewUserProfile(userId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const user = await response.json();
        this.showUserProfileModal(user);
      } else {
        alert('Kullanıcı profili alınamadı.');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      alert('Kullanıcı profili yüklenirken hata oluştu.');
    }
  }

  // Show user profile modal
  showUserProfileModal(user) {
    document.getElementById('userProfileTitle').textContent = user.username;
    document.getElementById('userProfileBody').innerHTML = `
      <div class="user-profile-detail">
        <div class="row">
          <div class="col-md-4">
            <img src="${user.avatarUrl || '/images/default-avatar.png'}" 
                 alt="${user.username}" 
                 class="img-fluid rounded">
          </div>
          <div class="col-md-8">
            <h5>${user.username}</h5>
            <p class="text-muted">${user.bio || 'Biyografi yok'}</p>
            <div class="user-stats">
              <div class="stat-item">
                <strong>${user.followersCount || 0}</strong>
                <span>Takipçi</span>
              </div>
              <div class="stat-item">
                <strong>${user.followingCount || 0}</strong>
                <span>Takip</span>
              </div>
              <div class="stat-item">
                <strong>${user.musicCount || 0}</strong>
                <span>Müzik</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Store current user ID for follow action
    document.getElementById('followUserBtn').setAttribute('data-user-id', user.id);
    
    const modal = new bootstrap.Modal(document.getElementById('userProfileModal'));
    modal.show();
  }

  // Follow user
  async followUser(userId = null) {
    const targetUserId = userId || document.getElementById('followUserBtn').getAttribute('data-user-id');
    
    if (!this.currentUser) {
      alert('Lütfen giriş yapın.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/follow/${targetUserId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        alert('Kullanıcı takip edildi!');
        // Close modal if open
        const modal = bootstrap.Modal.getInstance(document.getElementById('userProfileModal'));
        if (modal) modal.hide();
        // Refresh data
        this.loadSocialData();
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error following user:', error);
      alert('Takip işlemi sırasında hata oluştu.');
    }
  }

  // Add friend
  async addFriend(userId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/add-friend/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        alert('Arkadaşlık isteği gönderildi!');
        this.loadSuggestedFriends();
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      alert('Arkadaş ekleme işlemi sırasında hata oluştu.');
    }
  }

  // Remove friend
  async removeFriend(userId) {
    if (!confirm('Bu arkadaşı listeden kaldırmak istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/remove-friend/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        alert('Arkadaş listeden kaldırıldı!');
        this.loadFriends();
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Arkadaş kaldırma işlemi sırasında hata oluştu.');
    }
  }

  // Unfollow user
  async unfollowUser(userId) {
    if (!confirm('Bu kullanıcıyı takip etmeyi bırakmak istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/unfollow/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        alert('Takip bırakıldı!');
        this.loadFollowing();
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      alert('Takip bırakma işlemi sırasında hata oluştu.');
    }
  }

  // Like activity
  async likeActivity(activityId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/like-activity/${activityId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        // Update like count in UI
        this.updateActivityLikeCount(activityId);
      }
    } catch (error) {
      console.error('Error liking activity:', error);
    }
  }

  // Comment activity
  commentActivity(activityId) {
    // This would open comment modal
    console.log('Commenting on activity:', activityId);
    alert('Yorum özelliği geliştirilmekte.');
  }

  // Share activity
  shareActivity(activityId) {
    // This would open share modal
    console.log('Sharing activity:', activityId);
    alert('Paylaşım özelliği geliştirilmekte.');
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        this.loadNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead() {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/social/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        this.loadNotifications();
        this.updateNotificationBadge(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  // Sort friends
  sortFriends(sortBy) {
    if (!this.friends || this.friends.length === 0) return;

    switch (sortBy) {
      case 'name':
        this.friends.sort((a, b) => a.username.localeCompare(b.username));
        break;
      case 'activity':
        this.friends.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
        break;
    }

    const container = document.getElementById('friendsList');
    if (container) {
      this.renderFriendsList(container, this.friends);
    }
  }

  // Load more feed
  loadMoreFeed() {
    // This would load more feed items
    console.log('Loading more feed...');
    alert('Daha fazla yükleme özelliği geliştirilmekte.');
  }

  // Refresh social data
  refreshSocialData() {
    this.loadSocialData();
  }

  // Helper functions
  getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Az önce';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dakika önce`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} gün önce`;
    return date.toLocaleDateString('tr-TR');
  }

  updateLoadMoreButton() {
    const loadMoreDiv = document.getElementById('loadMoreFeed');
    if (loadMoreDiv) {
      // Show/hide based on whether there are more items
      loadMoreDiv.style.display = 'block';
    }
  }

  updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  updateActivityLikeCount(activityId) {
    // This would update the like count in the UI
    console.log('Updating like count for activity:', activityId);
  }

  showError(container, message) {
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger" role="alert">
          <i class="fas fa-exclamation-triangle me-2"></i>
          ${message}
        </div>
      `;
    }
  }
}

// Initialize social manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.socialManager = new SocialManager();
});

// Export for global access
window.SocialManager = SocialManager;
