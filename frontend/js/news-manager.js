// News Management System
class NewsManager {
  constructor() {
    this.currentUser = null;
    this.news = [];
    this.currentCategory = 'all';
    this.currentPage = 1;
    this.totalPages = 1;
    this.sortBy = 'date';
    this.init();
  }

  // Initialize news manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadNews();
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
    // Category buttons
    document.querySelectorAll('.news-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchCategory(e.target.getAttribute('data-category'));
      });
    });

    // Sort buttons
    document.getElementById('sortByDateBtn')?.addEventListener('click', () => {
      this.sortNews('date');
    });

    document.getElementById('sortByPopularityBtn')?.addEventListener('click', () => {
      this.sortNews('popularity');
    });

    // Load more button
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
      this.loadMoreNews();
    });

    // Refresh button
    document.getElementById('refreshNewsBtn')?.addEventListener('click', () => {
      this.refreshNews();
    });

    // Newsletter form
    document.getElementById('newsletterForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.subscribeNewsletter();
    });

    // Share news button
    document.getElementById('shareNewsBtn')?.addEventListener('click', () => {
      this.shareNews();
    });
  }

  // Switch news category
  switchCategory(category) {
    this.currentCategory = category;
    this.currentPage = 1;
    
    // Update active button
    document.querySelectorAll('.news-category-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    this.loadNews();
  }

  // Load news
  async loadNews() {
    const newsList = document.getElementById('newsList');
    const newsLoading = document.getElementById('newsLoading');
    const featuredNews = document.getElementById('featuredNews');
    const trendingNews = document.getElementById('trendingNews');
    
    if (newsLoading) newsLoading.classList.remove('d-none');
    if (newsList) newsList.innerHTML = '';
    if (featuredNews) featuredNews.innerHTML = '';
    if (trendingNews) trendingNews.innerHTML = '';

    try {
      const params = new URLSearchParams({
        category: this.currentCategory,
        page: this.currentPage,
        sortBy: this.sortBy
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/news?${params}`);

      if (response.ok) {
        const data = await response.json();
        this.news = data.news;
        this.totalPages = data.totalPages;
        
        this.renderNewsList(newsList, this.news);
        this.renderFeaturedNews(featuredNews, data.featuredNews);
        this.renderTrendingNews(trendingNews, data.trendingNews);
        this.updateLoadMoreButton();
      } else {
        this.showError(newsList, 'Haberler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading news:', error);
      this.showError(newsList, 'Haberler yüklenirken hata oluştu.');
    } finally {
      if (newsLoading) newsLoading.classList.add('d-none');
    }
  }

  // Render news list
  renderNewsList(container, news) {
    if (!container) return;

    if (news.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-newspaper fa-3x text-muted mb-3"></i>
          <h5>Haber bulunamadı</h5>
          <p class="text-muted">Bu kategoride henüz haber bulunmuyor.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = news.map(article => this.createNewsCard(article)).join('');
  }

  // Create news card HTML
  createNewsCard(article) {
    const publishedDate = new Date(article.publishedAt);
    const formattedDate = publishedDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const categoryText = this.getCategoryText(article.category);
    const readTime = this.calculateReadTime(article.content);
    
    return `
      <div class="news-card mb-3">
        <div class="row g-3">
          <div class="col-md-4">
            <img src="${article.image || '/images/default-news.jpg'}" 
                 alt="${article.title}" 
                 class="news-image">
          </div>
          <div class="col-md-8">
            <div class="news-content">
              <div class="news-meta">
                <span class="badge bg-primary">${categoryText}</span>
                <span class="news-date">
                  <i class="fas fa-calendar"></i> ${formattedDate}
                </span>
                <span class="news-read-time">
                  <i class="fas fa-clock"></i> ${readTime} dk
                </span>
              </div>
              <h6 class="news-title">
                <a href="#" onclick="newsManager.viewNews('${article.id}')" class="text-decoration-none">
                  ${article.title}
                </a>
              </h6>
              <p class="news-excerpt">${article.excerpt || article.content.substring(0, 150) + '...'}</p>
              <div class="news-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="newsManager.viewNews('${article.id}')">
                  <i class="fas fa-eye"></i> Oku
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="newsManager.likeNews('${article.id}')">
                  <i class="fas fa-heart"></i> ${article.likes || 0}
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="newsManager.shareNews('${article.id}')">
                  <i class="fas fa-share"></i> Paylaş
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="newsManager.bookmarkNews('${article.id}')">
                  <i class="fas fa-bookmark"></i> Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render featured news
  renderFeaturedNews(container, featuredNews) {
    if (!container || !featuredNews) return;

    const publishedDate = new Date(featuredNews.publishedAt);
    const formattedDate = publishedDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    container.innerHTML = `
      <div class="featured-news">
        <img src="${featuredNews.image || '/images/default-news.jpg'}" 
             alt="${featuredNews.title}" 
             class="featured-news-image">
        <div class="featured-news-overlay">
          <div class="featured-news-content">
            <span class="badge bg-warning">Öne Çıkan</span>
            <h4 class="featured-news-title">
              <a href="#" onclick="newsManager.viewNews('${featuredNews.id}')" class="text-white text-decoration-none">
                ${featuredNews.title}
              </a>
            </h4>
            <p class="featured-news-excerpt">${featuredNews.excerpt || featuredNews.content.substring(0, 200) + '...'}</p>
            <div class="featured-news-meta">
              <span class="text-white-50">
                <i class="fas fa-calendar"></i> ${formattedDate}
              </span>
              <span class="text-white-50 ms-3">
                <i class="fas fa-clock"></i> ${this.calculateReadTime(featuredNews.content)} dk
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render trending news
  renderTrendingNews(container, trendingNews) {
    if (!container || !trendingNews) return;

    if (trendingNews.length === 0) {
      container.innerHTML = '<p class="text-muted small">Trend haber bulunamadı.</p>';
      return;
    }

    container.innerHTML = trendingNews.map((article, index) => `
      <div class="trending-news-item">
        <div class="trending-rank">${index + 1}</div>
        <div class="trending-content">
          <h6 class="trending-title">
            <a href="#" onclick="newsManager.viewNews('${article.id}')" class="text-decoration-none">
              ${article.title}
            </a>
          </h6>
          <div class="trending-meta">
            <span class="text-muted small">
              <i class="fas fa-fire"></i> ${article.views || 0} görüntüleme
            </span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // View news detail
  async viewNews(newsId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/news/${newsId}`);
      
      if (response.ok) {
        const article = await response.json();
        this.showNewsDetail(article);
        
        // Increment view count
        this.incrementViewCount(newsId);
      } else {
        alert('Haber detayları alınamadı.');
      }
    } catch (error) {
      console.error('Error loading news detail:', error);
      alert('Haber detayları yüklenirken hata oluştu.');
    }
  }

  // Show news detail modal
  showNewsDetail(article) {
    const publishedDate = new Date(article.publishedAt);
    const formattedDate = publishedDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    document.getElementById('newsDetailTitle').textContent = article.title;
    document.getElementById('newsDetailBody').innerHTML = `
      <div class="news-detail">
        <div class="news-detail-meta mb-3">
          <span class="badge bg-primary">${this.getCategoryText(article.category)}</span>
          <span class="text-muted ms-2">
            <i class="fas fa-calendar"></i> ${formattedDate}
          </span>
          <span class="text-muted ms-2">
            <i class="fas fa-eye"></i> ${article.views || 0} görüntüleme
          </span>
          <span class="text-muted ms-2">
            <i class="fas fa-heart"></i> ${article.likes || 0} beğeni
          </span>
        </div>
        ${article.image ? `
          <img src="${article.image}" alt="${article.title}" class="img-fluid rounded mb-3">
        ` : ''}
        <div class="news-detail-content">
          ${article.content}
        </div>
        ${article.tags && article.tags.length > 0 ? `
          <div class="news-tags mt-3">
            <strong>Etiketler:</strong>
            ${article.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
    
    // Store current news ID for share action
    document.getElementById('shareNewsBtn').setAttribute('data-news-id', article.id);
    
    const modal = new bootstrap.Modal(document.getElementById('newsDetailModal'));
    modal.show();
  }

  // Like news
  async likeNews(newsId) {
    if (!this.currentUser) {
      alert('Lütfen giriş yapın.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/news/${newsId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Update like count in UI
        this.updateLikeCount(newsId, data.likes);
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error liking news:', error);
      alert('Beğeni işlemi sırasında hata oluştu.');
    }
  }

  // Share news
  shareNews(newsId = null) {
    const targetNewsId = newsId || document.getElementById('shareNewsBtn').getAttribute('data-news-id');
    
    if (navigator.share) {
      navigator.share({
        title: 'Müzik Haberi',
        text: 'Bu haberi okumalısın!',
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

  // Bookmark news
  async bookmarkNews(newsId) {
    if (!this.currentUser) {
      alert('Lütfen giriş yapın.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/news/${newsId}/bookmark`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.bookmarked ? 'Haber kaydedildi!' : 'Haber kayıtlardan çıkarıldı!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error bookmarking news:', error);
      alert('Kaydetme işlemi sırasında hata oluştu.');
    }
  }

  // Sort news
  sortNews(sortBy) {
    this.sortBy = sortBy;
    this.currentPage = 1;
    
    // Update active sort button
    document.querySelectorAll('#newsList .btn-group .btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`sortBy${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}Btn`).classList.add('active');
    
    this.loadNews();
  }

  // Load more news
  loadMoreNews() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadNews();
    }
  }

  // Refresh news
  refreshNews() {
    this.currentPage = 1;
    this.loadNews();
  }

  // Subscribe to newsletter
  async subscribeNewsletter() {
    const email = document.querySelector('#newsletterForm input[type="email"]').value;
    
    if (!email) {
      alert('Lütfen e-posta adresinizi girin.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        alert('Haber bültenine başarıyla abone oldunuz!');
        document.getElementById('newsletterForm').reset();
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      alert('Abonelik işlemi sırasında hata oluştu.');
    }
  }

  // Helper functions
  getCategoryText(category) {
    const categories = {
      'releases': 'Yeni Çıkışlar',
      'concerts': 'Konserler',
      'artists': 'Sanatçılar',
      'industry': 'Sektör',
      'awards': 'Ödüller',
      'technology': 'Teknoloji'
    };
    return categories[category] || category;
  }

  calculateReadTime(content) {
    const wordsPerMinute = 200;
    const wordCount = content.split(' ').length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  updateLikeCount(newsId, likes) {
    const likeButton = document.querySelector(`[onclick*="likeNews('${newsId}')"]`);
    if (likeButton) {
      likeButton.innerHTML = `<i class="fas fa-heart"></i> ${likes}`;
    }
  }

  incrementViewCount(newsId) {
    // This would increment view count in the background
    console.log('Incrementing view count for news:', newsId);
  }

  updateLoadMoreButton() {
    const loadMoreDiv = document.getElementById('loadMoreNews');
    if (loadMoreDiv) {
      if (this.currentPage < this.totalPages) {
        loadMoreDiv.style.display = 'block';
      } else {
        loadMoreDiv.style.display = 'none';
      }
    }
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

// Initialize news manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.newsManager = new NewsManager();
});

// Export for global access
window.NewsManager = NewsManager;
