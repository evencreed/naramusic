// Analytics Management System
class AnalyticsManager {
  constructor() {
    this.currentUser = null;
    this.analyticsData = {};
    this.charts = {};
    this.currentTab = 'overview';
    this.init();
  }

  // Initialize analytics manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadAnalyticsData();
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
    document.getElementById('refreshAnalyticsBtn')?.addEventListener('click', () => {
      this.refreshAnalytics();
    });

    // Export data button
    document.getElementById('exportDataBtn')?.addEventListener('click', () => {
      this.exportData();
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
      case '#overview':
        this.loadOverviewData();
        break;
      case '#listening':
        this.loadListeningHabitsData();
        break;
      case '#genres':
        this.loadGenresData();
        break;
      case '#artists':
        this.loadArtistsData();
        break;
      case '#time':
        this.loadTimeAnalysisData();
        break;
      case '#social':
        this.loadSocialData();
        break;
    }
  }

  // Load analytics data
  async loadAnalyticsData() {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/analytics/user`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        this.analyticsData = await response.json();
        this.loadOverviewData();
      } else {
        console.error('Error loading analytics data');
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  }

  // Load overview data
  loadOverviewData() {
    this.updateKeyMetrics();
    this.renderGenreDistributionChart();
    this.renderMonthlyTrendChart();
    this.renderTopArtists();
    this.renderTopTracks();
  }

  // Load listening habits data
  loadListeningHabitsData() {
    this.renderDailyListeningChart();
    this.renderWeeklyListeningChart();
    this.updateListeningHabitsDetails();
  }

  // Load genres data
  loadGenresData() {
    this.renderGenreAnalysisChart();
    this.renderGenreDetails();
  }

  // Load artists data
  loadArtistsData() {
    this.renderArtistDistributionChart();
    this.renderArtistTrendChart();
  }

  // Load time analysis data
  loadTimeAnalysisData() {
    this.renderMonthlyTrendDetailChart();
    this.renderYearlyComparisonChart();
  }

  // Load social data
  loadSocialData() {
    this.renderSocialInteractionChart();
    this.renderSharingStatsChart();
  }

  // Update key metrics
  updateKeyMetrics() {
    const data = this.analyticsData.overview || {};
    
    document.getElementById('totalTracks').textContent = data.totalTracks || 0;
    document.getElementById('totalListenTime').textContent = this.formatDuration(data.totalListenTime || 0);
    document.getElementById('averageRating').textContent = (data.averageRating || 0).toFixed(1);
    document.getElementById('totalLikes').textContent = data.totalLikes || 0;
  }

  // Render genre distribution chart
  renderGenreDistributionChart() {
    const ctx = document.getElementById('genreDistributionChart');
    if (!ctx) return;

    const data = this.analyticsData.genreDistribution || [];
    
    if (this.charts.genreDistribution) {
      this.charts.genreDistribution.destroy();
    }

    this.charts.genreDistribution = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(item => item.genre),
        datasets: [{
          data: data.map(item => item.count),
          backgroundColor: this.generateColors(data.length),
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

  // Render monthly trend chart
  renderMonthlyTrendChart() {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx) return;

    const data = this.analyticsData.monthlyTrend || [];
    
    if (this.charts.monthlyTrend) {
      this.charts.monthlyTrend.destroy();
    }

    this.charts.monthlyTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(item => item.month),
        datasets: [{
          label: 'Dinleme Sayısı',
          data: data.map(item => item.count),
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
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

  // Render top artists
  renderTopArtists() {
    const container = document.getElementById('topArtistsList');
    if (!container) return;

    const artists = this.analyticsData.topArtists || [];
    
    container.innerHTML = artists.map((artist, index) => `
      <div class="top-item">
        <div class="row align-items-center">
          <div class="col-auto">
            <div class="rank">${index + 1}</div>
          </div>
          <div class="col-auto">
            <img src="${artist.image || '/images/default-artist.png'}" 
                 alt="${artist.name}" 
                 class="artist-image">
          </div>
          <div class="col">
            <h6 class="artist-name">${artist.name}</h6>
            <p class="artist-stats">${artist.listenCount} dinleme</p>
          </div>
          <div class="col-auto">
            <span class="badge bg-primary">${artist.genre}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render top tracks
  renderTopTracks() {
    const container = document.getElementById('topTracksList');
    if (!container) return;

    const tracks = this.analyticsData.topTracks || [];
    
    container.innerHTML = tracks.map((track, index) => `
      <div class="top-item">
        <div class="row align-items-center">
          <div class="col-auto">
            <div class="rank">${index + 1}</div>
          </div>
          <div class="col-auto">
            <img src="${track.image || '/images/default-music.png'}" 
                 alt="${track.title}" 
                 class="track-image">
          </div>
          <div class="col">
            <h6 class="track-title">${track.title}</h6>
            <p class="track-artist">${track.artist}</p>
          </div>
          <div class="col-auto">
            <span class="track-rating">${track.rating}/10</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render daily listening chart
  renderDailyListeningChart() {
    const ctx = document.getElementById('dailyListeningChart');
    if (!ctx) return;

    const data = this.analyticsData.dailyListening || [];
    
    if (this.charts.dailyListening) {
      this.charts.dailyListening.destroy();
    }

    this.charts.dailyListening = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(item => item.hour + ':00'),
        datasets: [{
          label: 'Dinleme Süresi (dakika)',
          data: data.map(item => item.duration),
          backgroundColor: '#FF6384',
          borderColor: '#FF6384',
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

  // Render weekly listening chart
  renderWeeklyListeningChart() {
    const ctx = document.getElementById('weeklyListeningChart');
    if (!ctx) return;

    const data = this.analyticsData.weeklyListening || [];
    
    if (this.charts.weeklyListening) {
      this.charts.weeklyListening.destroy();
    }

    this.charts.weeklyListening = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(item => item.day),
        datasets: [{
          label: 'Dinleme Süresi (saat)',
          data: data.map(item => item.duration),
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

  // Update listening habits details
  updateListeningHabitsDetails() {
    const data = this.analyticsData.listeningHabits || {};
    
    document.getElementById('mostActiveDay').textContent = data.mostActiveDay || '-';
    document.getElementById('mostActiveHour').textContent = data.mostActiveHour || '-';
    document.getElementById('avgSessionDuration').textContent = this.formatDuration(data.avgSessionDuration || 0);
  }

  // Render genre analysis chart
  renderGenreAnalysisChart() {
    const ctx = document.getElementById('genreAnalysisChart');
    if (!ctx) return;

    const data = this.analyticsData.genreAnalysis || [];
    
    if (this.charts.genreAnalysis) {
      this.charts.genreAnalysis.destroy();
    }

    this.charts.genreAnalysis = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(item => item.genre),
        datasets: [{
          label: 'Dinleme Süresi (saat)',
          data: data.map(item => item.duration),
          backgroundColor: '#FFCE56',
          borderColor: '#FFCE56',
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
  renderGenreDetails() {
    const container = document.getElementById('genreDetailsList');
    if (!container) return;

    const genres = this.analyticsData.genreDetails || [];
    
    container.innerHTML = genres.map(genre => `
      <div class="genre-detail-item">
        <div class="d-flex justify-content-between align-items-center">
          <span class="genre-name">${genre.genre}</span>
          <span class="badge bg-primary">${genre.percentage}%</span>
        </div>
        <div class="progress mt-1" style="height: 4px;">
          <div class="progress-bar" style="width: ${genre.percentage}%"></div>
        </div>
        <small class="text-muted">${genre.count} şarkı, ${this.formatDuration(genre.duration)} dinleme</small>
      </div>
    `).join('');
  }

  // Render artist distribution chart
  renderArtistDistributionChart() {
    const ctx = document.getElementById('artistDistributionChart');
    if (!ctx) return;

    const data = this.analyticsData.artistDistribution || [];
    
    if (this.charts.artistDistribution) {
      this.charts.artistDistribution.destroy();
    }

    this.charts.artistDistribution = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: data.map(item => item.artist),
        datasets: [{
          data: data.map(item => item.count),
          backgroundColor: this.generateColors(data.length),
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

  // Render artist trend chart
  renderArtistTrendChart() {
    const ctx = document.getElementById('artistTrendChart');
    if (!ctx) return;

    const data = this.analyticsData.artistTrend || [];
    
    if (this.charts.artistTrend) {
      this.charts.artistTrend.destroy();
    }

    this.charts.artistTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(item => item.month),
        datasets: data.map((artist, index) => ({
          label: artist.artist,
          data: artist.data,
          borderColor: this.generateColors(data.length)[index],
          backgroundColor: this.generateColors(data.length)[index] + '20',
          tension: 0.1
        }))
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

  // Render monthly trend detail chart
  renderMonthlyTrendDetailChart() {
    const ctx = document.getElementById('monthlyTrendDetailChart');
    if (!ctx) return;

    const data = this.analyticsData.monthlyTrendDetail || [];
    
    if (this.charts.monthlyTrendDetail) {
      this.charts.monthlyTrendDetail.destroy();
    }

    this.charts.monthlyTrendDetail = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(item => item.month),
        datasets: [{
          label: 'Dinleme Süresi',
          data: data.map(item => item.duration),
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

  // Render yearly comparison chart
  renderYearlyComparisonChart() {
    const ctx = document.getElementById('yearlyComparisonChart');
    if (!ctx) return;

    const data = this.analyticsData.yearlyComparison || [];
    
    if (this.charts.yearlyComparison) {
      this.charts.yearlyComparison.destroy();
    }

    this.charts.yearlyComparison = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(item => item.year),
        datasets: [{
          label: 'Dinleme Süresi (saat)',
          data: data.map(item => item.duration),
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

  // Render social interaction chart
  renderSocialInteractionChart() {
    const ctx = document.getElementById('socialInteractionChart');
    if (!ctx) return;

    const data = this.analyticsData.socialInteraction || [];
    
    if (this.charts.socialInteraction) {
      this.charts.socialInteraction.destroy();
    }

    this.charts.socialInteraction = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(item => item.type),
        datasets: [{
          data: data.map(item => item.count),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
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

  // Render sharing stats chart
  renderSharingStatsChart() {
    const ctx = document.getElementById('sharingStatsChart');
    if (!ctx) return;

    const data = this.analyticsData.sharingStats || [];
    
    if (this.charts.sharingStats) {
      this.charts.sharingStats.destroy();
    }

    this.charts.sharingStats = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(item => item.month),
        datasets: [{
          label: 'Paylaşım Sayısı',
          data: data.map(item => item.count),
          backgroundColor: '#4BC0C0',
          borderColor: '#4BC0C0',
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

  // Export data
  exportData() {
    const data = {
      overview: this.analyticsData.overview,
      genreDistribution: this.analyticsData.genreDistribution,
      monthlyTrend: this.analyticsData.monthlyTrend,
      topArtists: this.analyticsData.topArtists,
      topTracks: this.analyticsData.topTracks,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muzik-analitikleri-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Refresh analytics
  refreshAnalytics() {
    this.loadAnalyticsData();
  }

  // Helper functions
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} dk`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} sa ${remainingMinutes} dk`;
  }

  generateColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 360) / count;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
  }
}

// Initialize analytics manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.analyticsManager = new AnalyticsManager();
});

// Export for global access
window.AnalyticsManager = AnalyticsManager;
