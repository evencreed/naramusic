// Chart Management System
class ChartManager {
  constructor() {
    this.currentUser = null;
    this.charts = {};
    this.currentTab = 'songs';
    this.init();
  }

  // Initialize chart manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadInitialCharts();
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
    document.getElementById('refreshChartsBtn')?.addEventListener('click', () => {
      this.refreshCharts();
    });

    // Filter change events
    document.querySelectorAll('select[id$="Filter"]').forEach(select => {
      select.addEventListener('change', () => {
        this.loadCurrentTabChart();
      });
    });
  }

  // Switch tab
  switchTab(tabId) {
    this.currentTab = tabId.replace('#', '');
    this.loadCurrentTabChart();
  }

  // Load initial charts
  loadInitialCharts() {
    this.loadSongsChart();
  }

  // Load current tab chart
  loadCurrentTabChart() {
    switch (this.currentTab) {
      case 'songs':
        this.loadSongsChart();
        break;
      case 'albums':
        this.loadAlbumsChart();
        break;
      case 'artists':
        this.loadArtistsChart();
        break;
      case 'genres':
        this.loadGenresChart();
        break;
      case 'analytics':
        this.loadAnalyticsCharts();
        break;
    }
  }

  // Load songs chart
  async loadSongsChart() {
    const container = document.getElementById('songsList');
    const loading = document.getElementById('songsLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const period = document.getElementById('songPeriodFilter')?.value || 'week';
      const genre = document.getElementById('songGenreFilter')?.value || '';
      
      const params = new URLSearchParams({
        type: 'songs',
        period,
        genre
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/charts?${params}`);

      if (response.ok) {
        const data = await response.json();
        this.renderSongsList(container, data.songs);
        this.renderSongsStatsChart(data.stats);
      } else {
        this.showError(container, 'Şarkı listesi yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading songs chart:', error);
      this.showError(container, 'Şarkı listesi yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load albums chart
  async loadAlbumsChart() {
    const container = document.getElementById('albumsList');
    const loading = document.getElementById('albumsLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const period = document.getElementById('albumPeriodFilter')?.value || 'week';
      const genre = document.getElementById('albumGenreFilter')?.value || '';
      
      const params = new URLSearchParams({
        type: 'albums',
        period,
        genre
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/charts?${params}`);

      if (response.ok) {
        const data = await response.json();
        this.renderAlbumsList(container, data.albums);
        this.renderAlbumsStatsChart(data.stats);
      } else {
        this.showError(container, 'Albüm listesi yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading albums chart:', error);
      this.showError(container, 'Albüm listesi yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load artists chart
  async loadArtistsChart() {
    const container = document.getElementById('artistsList');
    const loading = document.getElementById('artistsLoading');
    
    if (loading) loading.classList.remove('d-none');
    if (container) container.innerHTML = '';

    try {
      const period = document.getElementById('artistPeriodFilter')?.value || 'week';
      const genre = document.getElementById('artistGenreFilter')?.value || '';
      
      const params = new URLSearchParams({
        type: 'artists',
        period,
        genre
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/charts?${params}`);

      if (response.ok) {
        const data = await response.json();
        this.renderArtistsList(container, data.artists);
        this.renderArtistsStatsChart(data.stats);
      } else {
        this.showError(container, 'Sanatçı listesi yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading artists chart:', error);
      this.showError(container, 'Sanatçı listesi yüklenirken hata oluştu.');
    } finally {
      if (loading) loading.classList.add('d-none');
    }
  }

  // Load genres chart
  async loadGenresChart() {
    try {
      const period = document.getElementById('genrePeriodFilter')?.value || 'week';
      
      const params = new URLSearchParams({
        type: 'genres',
        period
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/charts?${params}`);

      if (response.ok) {
        const data = await response.json();
        this.renderGenresPieChart(data.genres);
        this.renderGenresBarChart(data.genres);
        this.renderGenreDetails(data.genres);
      } else {
        console.error('Genres chart data could not be loaded');
      }
    } catch (error) {
      console.error('Error loading genres chart:', error);
    }
  }

  // Load analytics charts
  async loadAnalyticsCharts() {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/analytics/charts`);

      if (response.ok) {
        const data = await response.json();
        this.renderListeningTrendsChart(data.listeningTrends);
        this.renderUserActivityChart(data.userActivity);
        this.renderPopularityOverTimeChart(data.popularityOverTime);
        this.renderGenreEvolutionChart(data.genreEvolution);
      } else {
        console.error('Analytics data could not be loaded');
      }
    } catch (error) {
      console.error('Error loading analytics charts:', error);
    }
  }

  // Render songs list
  renderSongsList(container, songs) {
    if (!container) return;

    if (songs.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-music fa-3x text-muted mb-3"></i>
            <h5>Şarkı bulunamadı</h5>
            <p class="text-muted">Bu kriterlere uygun şarkı bulunamadı.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = songs.map((song, index) => `
      <div class="col-12">
        <div class="chart-item">
          <div class="row align-items-center">
            <div class="col-auto">
              <div class="chart-rank">${index + 1}</div>
            </div>
            <div class="col-auto">
              <img src="${song.image || '/images/default-music.png'}" 
                   alt="${song.title}" 
                   class="chart-image">
            </div>
            <div class="col">
              <div class="chart-content">
                <h6 class="chart-title">${song.title}</h6>
                <p class="chart-artist">${song.artist}</p>
                <div class="chart-meta">
                  <span class="badge bg-primary">${song.genre || 'Müzik'}</span>
                  <span class="chart-views">
                    <i class="fas fa-eye"></i> ${song.views || 0} görüntüleme
                  </span>
                  <span class="chart-likes">
                    <i class="fas fa-heart"></i> ${song.likes || 0} beğeni
                  </span>
                </div>
              </div>
            </div>
            <div class="col-auto">
              <div class="chart-actions">
                ${song.musicData ? `
                  <div class="music-preview-container" data-music='${JSON.stringify(song.musicData)}'></div>
                ` : ''}
                <button class="btn btn-sm btn-outline-primary" onclick="chartManager.viewSong('${song.id}')">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="chartManager.addToPlaylist('${song.id}')">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Initialize music previews
    document.dispatchEvent(new CustomEvent('chartSongsLoaded'));
  }

  // Render albums list
  renderAlbumsList(container, albums) {
    if (!container) return;

    if (albums.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-compact-disc fa-3x text-muted mb-3"></i>
            <h5>Albüm bulunamadı</h5>
            <p class="text-muted">Bu kriterlere uygun albüm bulunamadı.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = albums.map((album, index) => `
      <div class="col-md-6 col-lg-4">
        <div class="chart-item">
          <div class="chart-rank">${index + 1}</div>
          <img src="${album.image || '/images/default-album.png'}" 
               alt="${album.title}" 
               class="chart-image">
          <div class="chart-content">
            <h6 class="chart-title">${album.title}</h6>
            <p class="chart-artist">${album.artist}</p>
            <div class="chart-meta">
              <span class="badge bg-primary">${album.genre || 'Müzik'}</span>
              <span class="chart-year">${album.year || ''}</span>
            </div>
            <div class="chart-stats">
              <span><i class="fas fa-eye"></i> ${album.views || 0}</span>
              <span><i class="fas fa-heart"></i> ${album.likes || 0}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render artists list
  renderArtistsList(container, artists) {
    if (!container) return;

    if (artists.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-user fa-3x text-muted mb-3"></i>
            <h5>Sanatçı bulunamadı</h5>
            <p class="text-muted">Bu kriterlere uygun sanatçı bulunamadı.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = artists.map((artist, index) => `
      <div class="col-md-6 col-lg-4">
        <div class="chart-item">
          <div class="chart-rank">${index + 1}</div>
          <img src="${artist.image || '/images/default-artist.png'}" 
               alt="${artist.name}" 
               class="chart-image">
          <div class="chart-content">
            <h6 class="chart-title">${artist.name}</h6>
            <div class="chart-meta">
              <span class="badge bg-primary">${artist.genre || 'Müzik'}</span>
              <span class="chart-followers">${artist.followers || 0} takipçi</span>
            </div>
            <div class="chart-stats">
              <span><i class="fas fa-music"></i> ${artist.tracks || 0} şarkı</span>
              <span><i class="fas fa-compact-disc"></i> ${artist.albums || 0} albüm</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render songs stats chart
  renderSongsStatsChart(stats) {
    const ctx = document.getElementById('songsStatsChart');
    if (!ctx || !stats) return;

    if (this.charts.songsStats) {
      this.charts.songsStats.destroy();
    }

    this.charts.songsStats = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Popüler', 'Orta', 'Az Popüler'],
        datasets: [{
          data: [stats.popular || 0, stats.medium || 0, stats.unpopular || 0],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  // Render albums stats chart
  renderAlbumsStatsChart(stats) {
    const ctx = document.getElementById('albumsStatsChart');
    if (!ctx || !stats) return;

    if (this.charts.albumsStats) {
      this.charts.albumsStats.destroy();
    }

    this.charts.albumsStats = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stats.labels || [],
        datasets: [{
          label: 'Albüm Sayısı',
          data: stats.data || [],
          backgroundColor: '#36A2EB',
          borderColor: '#36A2EB',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Render artists stats chart
  renderArtistsStatsChart(stats) {
    const ctx = document.getElementById('artistsStatsChart');
    if (!ctx || !stats) return;

    if (this.charts.artistsStats) {
      this.charts.artistsStats.destroy();
    }

    this.charts.artistsStats = new Chart(ctx, {
      type: 'line',
      data: {
        labels: stats.labels || [],
        datasets: [{
          label: 'Takipçi Sayısı',
          data: stats.data || [],
          borderColor: '#FF6384',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Render genres pie chart
  renderGenresPieChart(genres) {
    const ctx = document.getElementById('genresPieChart');
    if (!ctx || !genres) return;

    if (this.charts.genresPie) {
      this.charts.genresPie.destroy();
    }

    const labels = genres.map(g => g.name);
    const data = genres.map(g => g.count);
    const colors = this.generateColors(genres.length);

    this.charts.genresPie = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  // Render genres bar chart
  renderGenresBarChart(genres) {
    const ctx = document.getElementById('genresBarChart');
    if (!ctx || !genres) return;

    if (this.charts.genresBar) {
      this.charts.genresBar.destroy();
    }

    const labels = genres.map(g => g.name);
    const data = genres.map(g => g.count);

    this.charts.genresBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Şarkı Sayısı',
          data: data,
          backgroundColor: '#36A2EB',
          borderColor: '#36A2EB',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Render genre details
  renderGenreDetails(genres) {
    const container = document.getElementById('genreDetails');
    if (!container || !genres) return;

    container.innerHTML = genres.map(genre => `
      <div class="genre-detail-item mb-3">
        <div class="d-flex justify-content-between align-items-center">
          <span class="genre-name">${genre.name}</span>
          <span class="badge bg-primary">${genre.count}</span>
        </div>
        <div class="progress mt-1" style="height: 4px;">
          <div class="progress-bar" style="width: ${(genre.count / Math.max(...genres.map(g => g.count))) * 100}%"></div>
        </div>
      </div>
    `).join('');
  }

  // Render listening trends chart
  renderListeningTrendsChart(data) {
    const ctx = document.getElementById('listeningTrendsChart');
    if (!ctx || !data) return;

    if (this.charts.listeningTrends) {
      this.charts.listeningTrends.destroy();
    }

    this.charts.listeningTrends = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: [{
          label: 'Dinleme Sayısı',
          data: data.data || [],
          borderColor: '#FF6384',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Render user activity chart
  renderUserActivityChart(data) {
    const ctx = document.getElementById('userActivityChart');
    if (!ctx || !data) return;

    if (this.charts.userActivity) {
      this.charts.userActivity.destroy();
    }

    this.charts.userActivity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels || [],
        datasets: [{
          label: 'Aktif Kullanıcılar',
          data: data.data || [],
          backgroundColor: '#36A2EB',
          borderColor: '#36A2EB',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Render popularity over time chart
  renderPopularityOverTimeChart(data) {
    const ctx = document.getElementById('popularityOverTimeChart');
    if (!ctx || !data) return;

    if (this.charts.popularityOverTime) {
      this.charts.popularityOverTime.destroy();
    }

    this.charts.popularityOverTime = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: data.datasets || []
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Render genre evolution chart
  renderGenreEvolutionChart(data) {
    const ctx = document.getElementById('genreEvolutionChart');
    if (!ctx || !data) return;

    if (this.charts.genreEvolution) {
      this.charts.genreEvolution.destroy();
    }

    this.charts.genreEvolution = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: data.datasets || []
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Helper functions
  generateColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 360) / count;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
  }

  viewSong(songId) {
    console.log('Viewing song:', songId);
    // This would open song detail page
  }

  addToPlaylist(songId) {
    console.log('Adding to playlist:', songId);
    // This would open playlist selection modal
  }

  refreshCharts() {
    this.loadCurrentTabChart();
  }

  showError(container, message) {
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
}

// Initialize chart manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.chartManager = new ChartManager();
});

// Export for global access
window.ChartManager = ChartManager;
