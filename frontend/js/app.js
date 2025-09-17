// Backend base URL (lokal veya prod)
const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
const BACKEND_BASE = isLocalHost
  ? "http://localhost:4000"
  : "https://naramusic.onrender.com";

// Global state
let CURRENT_LANG = localStorage.getItem("lang") || "tr";
let CURRENT_USER = JSON.parse(localStorage.getItem("user") || "null");
let AUTH_TOKEN = localStorage.getItem('token') || null;
let currentPage = 1;
let isLoading = false;

// Utility functions
function showLoading(element) {
  if (element) {
    element.classList.add('loading');
    element.innerHTML = '<div class="text-center py-4"><div class="spinner"></div><p class="mt-2">Yükleniyor...</p></div>';
  }
}

function hideLoading(element) {
  if (element) {
    element.classList.remove('loading');
  }
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  const container = document.querySelector('.container') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Auth functions
function updateAuthUI() {
  const authButtons = document.getElementById('authButtons');
  const newPostBtn = document.querySelector('[data-bs-target="#createPostModal"]');
  const savedLink = document.getElementById('savedLink');
  const modLink = document.getElementById('modLink');
  
  if (!authButtons) return;
  
  if (CURRENT_USER) {
    authButtons.innerHTML = `
      <a class="btn btn-outline-light btn-sm" href="${location.pathname.includes('/pages/') ? '../pages/profil.html' : 'pages/profil.html'}">
        <i class="fas fa-user me-1"></i>Profil
      </a>
      <button id="logoutBtn" class="btn btn-outline-light btn-sm">
        <i class="fas fa-sign-out-alt me-1"></i>Çıkış
      </button>
    `;
    
    if (newPostBtn) {
      newPostBtn.classList.remove('disabled');
      newPostBtn.removeAttribute('disabled');
      newPostBtn.title = '';
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        CURRENT_USER = null;
        AUTH_TOKEN = null;
        location.reload();
      });
    }
    
    if (savedLink) savedLink.classList.remove('d-none');
    if (modLink) {
      modLink.classList.toggle('d-none', !(CURRENT_USER.role === 'admin' || CURRENT_USER.role === 'moderator'));
    }
  } else {
    authButtons.innerHTML = `
      <button class="btn btn-outline-light btn-sm" data-bs-toggle="modal" data-bs-target="#loginModal">
        <i class="fas fa-sign-in-alt me-1"></i>Giriş
      </button>
      <button class="btn btn-outline-light btn-sm" data-bs-toggle="modal" data-bs-target="#registerModal">
        <i class="fas fa-user-plus me-1"></i>Kayıt
      </button>
    `;
    
    if (newPostBtn) {
      newPostBtn.classList.add('disabled');
      newPostBtn.setAttribute('disabled', 'disabled');
      newPostBtn.title = 'Gönderi oluşturmak için giriş yapın';
    }
    
    if (savedLink) savedLink.classList.add('d-none');
    if (modLink) modLink.classList.add('d-none');
  }
}


// API functions with retry mechanism and HTTP/1.1 fallback
async function apiRequest(endpoint, options = {}, retries = 3) {
  const url = `${BACKEND_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` })
    },
    ...options
  };
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Trying ${url} (attempt ${attempt}/${retries})`);
      
      // Try with different fetch configurations
      let response;
      if (attempt === 1) {
        // First attempt: normal fetch
        response = await fetch(url, config);
      } else if (attempt === 2) {
        // Second attempt: with no-cors mode for HTTP2 issues
        response = await fetch(url, { ...config, mode: 'cors', cache: 'no-cache' });
      } else {
        // Third attempt: with different headers
        response = await fetch(url, { 
          ...config, 
          headers: { ...config.headers, 'Accept': 'application/json' }
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Success with ${url}`);
      return data;
      
    } catch (error) {
      console.error(`API Error (attempt ${attempt}/${retries}):`, error);
      
      // Check if it's a network error that might be retryable
      if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('HTTP2'))) {
        if (attempt < retries) {
          console.log(`Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
      }
      
      // If it's the last attempt, show error
      if (attempt === retries) {
        if (error.message.includes('HTTP2_PROTOCOL_ERROR') || error.message.includes('Failed to fetch')) {
          showAlert('Sunucu geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.', 'warning');
        } else {
          showAlert('Sunucuya bağlanırken hata oluştu. Lütfen sayfayı yenileyin.', 'danger');
        }
      }
      
      throw error;
    }
  }
}

// Post functions
async function loadLatestPostsPaginated(reset = false) {
  if (isLoading) return;
  
  const container = document.getElementById('latestPostsList');
  if (!container) return;
  
  if (reset) {
    currentPage = 1;
    container.innerHTML = '';
  }
  
  isLoading = true;
  showLoading(container);
  
  try {
    const data = await apiRequest(`/api/posts?page=${currentPage}&limit=6&sort=latest`);
    
    if (data.posts && data.posts.length > 0) {
      const postsHtml = data.posts.map(post => createPostCard(post)).join('');
      container.innerHTML += postsHtml;
      currentPage++;
    } else if (reset) {
      container.innerHTML = '<div class="col-12"><div class="text-center py-5"><p class="text-muted">Henüz gönderi bulunmuyor.</p></div></div>';
    }
    
    // Update load more button
    const loadMoreBtn = document.getElementById('loadMoreLatest');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = data.posts && data.posts.length === 6 ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Error loading latest posts:', error);
    container.innerHTML = '<div class="col-12"><div class="text-center py-5"><p class="text-danger">Gönderiler yüklenirken hata oluştu.</p></div></div>';
  } finally {
    isLoading = false;
    hideLoading(container);
  }
}

async function loadPopularPosts() {
  const container = document.getElementById('popularPosts');
  if (!container) return;
  
  showLoading(container);
  
  try {
    const data = await apiRequest('/api/posts?limit=5&sort=popular');
    
    if (data.posts && data.posts.length > 0) {
      const postsHtml = data.posts.map(post => createPopularPostItem(post)).join('');
      container.innerHTML = postsHtml;
    } else {
      container.innerHTML = '<p class="text-muted text-center">Henüz popüler gönderi bulunmuyor.</p>';
    }
  } catch (error) {
    console.error('Error loading popular posts:', error);
    container.innerHTML = '<p class="text-danger text-center">Popüler gönderiler yüklenirken hata oluştu.</p>';
  } finally {
    hideLoading(container);
  }
}

async function loadCategoryPosts(category) {
  const container = document.getElementById('categoryPosts');
  if (!container) return;
  
  showLoading(container);
  
  try {
    const data = await apiRequest(`/api/posts?category=${category}&limit=20`);
    
    if (data.posts && data.posts.length > 0) {
      const postsHtml = data.posts.map(post => createPostCard(post)).join('');
      container.innerHTML = `<div class="row g-4">${postsHtml}</div>`;
    } else {
      container.innerHTML = '<div class="text-center py-5"><p class="text-muted">Bu kategoride henüz gönderi bulunmuyor.</p></div>';
    }
  } catch (error) {
    console.error('Error loading category posts:', error);
    container.innerHTML = '<div class="text-center py-5"><p class="text-danger">Gönderiler yüklenirken hata oluştu.</p></div>';
  } finally {
    hideLoading(container);
  }
}

// UI Components
function createPostCard(post) {
  const timeAgo = getTimeAgo(post.createdAt);
  const categoryName = getCategoryName(post.category);
  const excerpt = post.content ? post.content.substring(0, 150) + '...' : '';
  
  return `
    <div class="col-md-6">
      <article class="card h-100 post-card">
        <div class="card-body">
          <div class="d-flex align-items-start mb-3">
            <img src="${post.author?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(post.author?.username || 'User')}" 
                 alt="${post.author?.username || 'User'}" class="rounded-circle me-3" style="width: 40px; height: 40px;">
            <div class="flex-grow-1">
              <h6 class="mb-0">@${post.author?.username || 'user'}</h6>
              <small class="text-muted">${timeAgo}</small>
            </div>
            <span class="badge bg-primary">${categoryName}</span>
          </div>
          
          <h5 class="card-title mb-3">
            <a href="pages/post.html?id=${post.id}" class="text-decoration-none">${post.title}</a>
          </h5>
          
          <p class="card-text text-muted mb-3">${excerpt}</p>
          
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex gap-3">
              <button class="btn btn-sm btn-outline-primary like-btn" data-post-id="${post.id}">
                <i class="fas fa-heart me-1"></i>${post.likes || 0}
              </button>
              <button class="btn btn-sm btn-outline-secondary comment-btn" data-post-id="${post.id}">
                <i class="fas fa-comment me-1"></i>${post.comments || 0}
              </button>
              <button class="btn btn-sm btn-outline-secondary share-btn" data-post-id="${post.id}">
                <i class="fas fa-share me-1"></i>Paylaş
              </button>
            </div>
            <button class="btn btn-sm btn-outline-warning bookmark-btn" data-post-id="${post.id}">
              <i class="fas fa-bookmark"></i>
            </button>
          </div>
        </div>
      </article>
    </div>
  `;
}

function createPopularPostItem(post) {
  const timeAgo = getTimeAgo(post.createdAt);
  
  return `
    <div class="d-flex align-items-start mb-3">
      <div class="flex-grow-1">
        <h6 class="mb-1">
          <a href="pages/post.html?id=${post.id}" class="text-decoration-none">${post.title}</a>
        </h6>
        <small class="text-muted">${timeAgo} • ${post.likes || 0} beğeni</small>
      </div>
    </div>
  `;
}

// Utility functions
function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Az önce';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dakika önce`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} gün önce`;
  return date.toLocaleDateString('tr-TR');
}

function getCategoryName(category) {
  const categories = {
    'yenimuzik': 'Yeni Müzik',
    'endustri': 'Endüstri',
    'degerlendirme': 'Değerlendirme',
    'album': 'Albüm',
    'roportaj': 'Röportaj',
    'etkinlik': 'Etkinlik',
    'dizifilm': 'Dizi & Film'
  };
  return categories[category] || 'Genel';
}

// Event handlers
function setupEventHandlers() {
  // Like button
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.like-btn')) {
      const btn = e.target.closest('.like-btn');
      const postId = btn.dataset.postId;
      
      if (!CURRENT_USER) {
        showAlert('Beğenmek için giriş yapın', 'warning');
        return;
      }
      
      try {
        await apiRequest(`/api/posts/${postId}/like`, { method: 'POST' });
        const currentLikes = parseInt(btn.textContent.match(/\d+/)?.[0] || 0);
        btn.innerHTML = `<i class="fas fa-heart me-1"></i>${currentLikes + 1}`;
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline-primary');
      } catch (error) {
        showAlert('Beğeni işlemi başarısız', 'danger');
      }
    }
    
    // Bookmark button
    if (e.target.closest('.bookmark-btn')) {
      const btn = e.target.closest('.bookmark-btn');
      const postId = btn.dataset.postId;
      
      if (!CURRENT_USER) {
        showAlert('Kaydetmek için giriş yapın', 'warning');
        return;
      }
      
      try {
        await apiRequest(`/api/posts/${postId}/bookmark`, { method: 'POST' });
        btn.classList.add('btn-warning');
        btn.classList.remove('btn-outline-warning');
        showAlert('Gönderi kaydedildi', 'success');
      } catch (error) {
        showAlert('Kaydetme işlemi başarısız', 'danger');
      }
    }
  });
  
  // Load more button
  const loadMoreBtn = document.getElementById('loadMoreLatest');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => loadLatestPostsPaginated(false));
  }
}

// Form handlers
function setupFormHandlers() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      
      try {
        const response = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        
        CURRENT_USER = response.user;
        AUTH_TOKEN = response.token;
        localStorage.setItem('user', JSON.stringify(CURRENT_USER));
        localStorage.setItem('token', AUTH_TOKEN);
        
        updateAuthUI();
        showAlert('Giriş başarılı!', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        modal.hide();
        
      } catch (error) {
        showAlert('Giriş başarısız: ' + error.message, 'danger');
      }
    });
  }
  
  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      
      try {
        const response = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        
        showAlert('Kayıt başarılı! E-posta adresinizi kontrol edin.', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
        modal.hide();
        
      } catch (error) {
        showAlert('Kayıt başarısız: ' + error.message, 'danger');
      }
    });
  }
  
  // Create post form
  const createPostForm = document.getElementById('newPostForm');
  if (createPostForm) {
    createPostForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!CURRENT_USER) {
        showAlert('Gönderi oluşturmak için giriş yapın', 'warning');
        return;
      }
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      
      try {
        await apiRequest('/api/posts', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        
        showAlert('Gönderi başarıyla oluşturuldu!', 'success');
        
        // Close modal and reload posts
        const modal = bootstrap.Modal.getInstance(document.getElementById('createPostModal'));
        modal.hide();
        
        // Reload posts if on main page
        if (document.getElementById('latestPostsList')) {
          loadLatestPostsPaginated(true);
        }
        
      } catch (error) {
        showAlert('Gönderi oluşturulamadı: ' + error.message, 'danger');
      }
    });
  }
}

// Stats functions
async function loadStats() {
  try {
    const data = await apiRequest('/api/stats');
    
    const totalPosts = document.getElementById('totalPosts');
    const totalUsers = document.getElementById('totalUsers');
    const totalComments = document.getElementById('totalComments');
    
    if (totalPosts) totalPosts.textContent = data.totalPosts || 0;
    if (totalUsers) totalUsers.textContent = data.totalUsers || 0;
    if (totalComments) totalComments.textContent = data.totalComments || 0;
    
  } catch (error) {
    console.error('Stats loading error:', error);
  }
}

// Featured post
async function loadFeaturedPost() {
  try {
    const data = await apiRequest('/api/posts?featured=true&limit=1');
    
    if (data.posts && data.posts.length > 0) {
      const post = data.posts[0];
      const titleEl = document.getElementById('heroPinnedTitle');
      const excerptEl = document.getElementById('heroPinnedExcerpt');
      const linkEl = document.getElementById('heroPinnedLink');
      const imgEl = document.getElementById('heroPinnedImg');
      
      if (titleEl) titleEl.textContent = post.title;
      if (excerptEl) excerptEl.textContent = post.content ? post.content.substring(0, 140) + '...' : '';
      if (linkEl) linkEl.href = `pages/post.html?id=${post.id}`;
      if (imgEl && post.mediaUrl) imgEl.src = post.mediaUrl;
    }
  } catch (error) {
    console.error('Featured post loading error:', error);
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  setupEventHandlers();
  setupFormHandlers();
  
  // Load content based on page
  if (document.getElementById('latestPostsList')) {
    loadLatestPostsPaginated(true);
  }
  
  if (document.getElementById('popularPosts')) {
    loadPopularPosts();
  }
  
  if (document.getElementById('categoryPosts')) {
    const category = document.body.getAttribute('data-category');
    if (category) {
      loadCategoryPosts(category);
    }
  }
  
  // Load stats
  loadStats();
  
  // Load featured post
  loadFeaturedPost();
});

// Export for use in other scripts
window.NaraMusic = {
  apiRequest,
  showAlert,
  loadLatestPostsPaginated,
  loadPopularPosts,
  loadCategoryPosts,
  CURRENT_USER,
  AUTH_TOKEN
};
