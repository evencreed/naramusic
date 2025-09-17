// Event Management System
class EventManager {
  constructor() {
    this.currentUser = null;
    this.events = [];
    this.filters = {
      type: '',
      location: '',
      date: '',
      price: ''
    };
    this.init();
  }

  // Initialize event manager
  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadEvents();
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
    // Create event button
    document.getElementById('createEventBtn')?.addEventListener('click', () => {
      this.openCreateEventModal();
    });

    // Save event button
    document.getElementById('saveEventBtn')?.addEventListener('click', () => {
      this.createEvent();
    });

    // Filter buttons
    document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
      this.applyFilters();
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
      this.clearFilters();
    });

    // Tab change events
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
      tab.addEventListener('shown.bs.tab', (e) => {
        const target = e.target.getAttribute('data-bs-target');
        this.loadTabContent(target);
      });
    });

    // Join event button
    document.getElementById('joinEventBtn')?.addEventListener('click', () => {
      this.joinEvent();
    });
  }

  // Load events based on current tab
  async loadEvents() {
    const activeTab = document.querySelector('.nav-link.active');
    if (!activeTab) return;

    const target = activeTab.getAttribute('data-bs-target');
    this.loadTabContent(target);
  }

  // Load tab content
  async loadTabContent(tabId) {
    switch (tabId) {
      case '#upcoming':
        await this.loadUpcomingEvents();
        break;
      case '#today':
        await this.loadTodayEvents();
        break;
      case '#thisWeek':
        await this.loadThisWeekEvents();
        break;
      case '#myEvents':
        await this.loadMyEvents();
        break;
    }
  }

  // Load upcoming events
  async loadUpcomingEvents() {
    const container = document.getElementById('upcomingEventsList');
    const loading = document.getElementById('upcomingEventsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const params = new URLSearchParams({
        status: 'upcoming',
        ...this.filters
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/events?${params}`);

      if (response.ok) {
        this.events = await response.json();
        this.renderEvents(container, this.events);
      } else {
        this.showError(container, 'Etkinlikler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading upcoming events:', error);
      this.showError(container, 'Etkinlikler yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load today's events
  async loadTodayEvents() {
    const container = document.getElementById('todayEventsList');
    const loading = document.getElementById('todayEventsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        date: today,
        ...this.filters
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/events?${params}`);

      if (response.ok) {
        const events = await response.json();
        this.renderEvents(container, events);
      } else {
        this.showError(container, 'Bugünkü etkinlikler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading today events:', error);
      this.showError(container, 'Bugünkü etkinlikler yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load this week's events
  async loadThisWeekEvents() {
    const container = document.getElementById('thisWeekEventsList');
    const loading = document.getElementById('thisWeekEventsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const params = new URLSearchParams({
        period: 'thisWeek',
        ...this.filters
      });
      
      const response = await fetch(`${BACKEND_BASE}/api/events?${params}`);

      if (response.ok) {
        const events = await response.json();
        this.renderEvents(container, events);
      } else {
        this.showError(container, 'Bu haftaki etkinlikler yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading this week events:', error);
      this.showError(container, 'Bu haftaki etkinlikler yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Load my events
  async loadMyEvents() {
    const container = document.getElementById('myEventsList');
    const loading = document.getElementById('myEventsLoading');
    
    if (!container || !loading) return;

    loading.classList.remove('d-none');
    container.innerHTML = '';

    if (!this.currentUser) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-user fa-3x text-muted mb-3"></i>
            <h5>Giriş yapın</h5>
            <p class="text-muted">Etkinliklerinizi görmek için giriş yapın.</p>
          </div>
        </div>
      `;
      loading.classList.add('d-none');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/events/my`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const events = await response.json();
        this.renderEvents(container, events, true);
      } else {
        this.showError(container, 'Etkinlikleriniz yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading my events:', error);
      this.showError(container, 'Etkinlikleriniz yüklenirken hata oluştu.');
    } finally {
      loading.classList.add('d-none');
    }
  }

  // Render events
  renderEvents(container, events, isMyEvents = false) {
    if (events.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-calendar fa-3x text-muted mb-3"></i>
            <h5>Etkinlik bulunamadı</h5>
            <p class="text-muted">${isMyEvents ? 'Henüz etkinlik oluşturmamışsınız.' : 'Aradığınız kriterlere uygun etkinlik bulunamadı.'}</p>
            ${isMyEvents ? '<button class="btn btn-primary" onclick="eventManager.openCreateEventModal()">İlk Etkinliğinizi Oluşturun</button>' : ''}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = events.map(event => this.createEventCard(event, isMyEvents)).join('');
  }

  // Create event card HTML
  createEventCard(event, isMyEvents = false) {
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const priceText = event.price === 0 ? 'Ücretsiz' : `${event.price} TL`;
    const typeText = this.getEventTypeText(event.type);
    const locationText = this.getLocationText(event.location);
    
    return `
      <div class="col-lg-4 col-md-6 mb-3">
        <div class="card event-card h-100">
          <div class="event-image-container">
            <img src="${event.image || '/images/default-event.jpg'}" 
                 alt="${event.title}" 
                 class="event-image">
            <div class="event-overlay">
              <div class="event-badges">
                <span class="badge bg-primary">${typeText}</span>
                <span class="badge bg-success">${priceText}</span>
              </div>
            </div>
          </div>
          <div class="card-body">
            <h6 class="event-title">${event.title}</h6>
            <div class="event-meta">
              <div class="event-date">
                <i class="fas fa-calendar"></i>
                <span>${formattedDate}</span>
              </div>
              <div class="event-time">
                <i class="fas fa-clock"></i>
                <span>${formattedTime}</span>
              </div>
              <div class="event-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${event.venue}, ${locationText}</span>
              </div>
            </div>
            <p class="event-description">${event.description || 'Açıklama yok'}</p>
            <div class="event-stats">
              <small class="text-muted">
                <i class="fas fa-users"></i> ${event.attendees || 0} katılımcı
                ${event.capacity ? `<i class="fas fa-ticket-alt ms-2"></i> ${event.capacity} kapasite` : ''}
              </small>
            </div>
            <div class="event-actions mt-3">
              <button class="btn btn-sm btn-outline-primary" onclick="eventManager.viewEvent('${event.id}')">
                <i class="fas fa-eye"></i> Detay
              </button>
              ${!isMyEvents ? `
                <button class="btn btn-sm btn-outline-success" onclick="eventManager.joinEvent('${event.id}')">
                  <i class="fas fa-calendar-plus"></i> Katıl
                </button>
              ` : `
                <button class="btn btn-sm btn-outline-warning" onclick="eventManager.editEvent('${event.id}')">
                  <i class="fas fa-edit"></i> Düzenle
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eventManager.deleteEvent('${event.id}')">
                  <i class="fas fa-trash"></i> Sil
                </button>
              `}
              ${event.website ? `
                <a href="${event.website}" target="_blank" class="btn btn-sm btn-outline-info">
                  <i class="fas fa-external-link-alt"></i> Web Sitesi
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Get event type text
  getEventTypeText(type) {
    const types = {
      'concert': 'Konser',
      'festival': 'Festival',
      'club': 'Kulüp',
      'acoustic': 'Akustik',
      'classical': 'Klasik Müzik'
    };
    return types[type] || type;
  }

  // Get location text
  getLocationText(location) {
    const locations = {
      'istanbul': 'İstanbul',
      'ankara': 'Ankara',
      'izmir': 'İzmir',
      'antalya': 'Antalya',
      'bursa': 'Bursa'
    };
    return locations[location] || location;
  }

  // Open create event modal
  openCreateEventModal() {
    if (!this.currentUser) {
      alert('Lütfen giriş yapın.');
      return;
    }

    const modal = new bootstrap.Modal(document.getElementById('createEventModal'));
    modal.show();
  }

  // Create new event
  async createEvent() {
    const formData = {
      title: document.getElementById('eventTitle').value,
      description: document.getElementById('eventDescription').value,
      type: document.getElementById('eventType').value,
      date: document.getElementById('eventDate').value,
      time: document.getElementById('eventTime').value,
      venue: document.getElementById('eventVenue').value,
      location: document.getElementById('eventLocation').value,
      price: parseInt(document.getElementById('eventPrice').value) || 0,
      capacity: parseInt(document.getElementById('eventCapacity').value) || null,
      image: document.getElementById('eventImage').value,
      website: document.getElementById('eventWebsite').value
    };

    if (!formData.title.trim()) {
      alert('Lütfen etkinlik adı girin.');
      return;
    }

    if (!formData.type) {
      alert('Lütfen etkinlik türü seçin.');
      return;
    }

    if (!formData.date) {
      alert('Lütfen tarih seçin.');
      return;
    }

    if (!formData.time) {
      alert('Lütfen saat girin.');
      return;
    }

    if (!formData.venue.trim()) {
      alert('Lütfen mekan adı girin.');
      return;
    }

    if (!formData.location) {
      alert('Lütfen şehir seçin.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const event = await response.json();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createEventModal'));
        modal.hide();
        
        // Reset form
        document.getElementById('createEventForm').reset();
        
        // Reload events
        this.loadEvents();
        
        alert('Etkinlik oluşturuldu!');
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Etkinlik oluşturulurken hata oluştu.');
    }
  }

  // View event details
  async viewEvent(eventId) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/events/${eventId}`);
      
      if (response.ok) {
        const event = await response.json();
        this.showEventDetail(event);
      } else {
        alert('Etkinlik detayları alınamadı.');
      }
    } catch (error) {
      console.error('Error loading event details:', error);
      alert('Etkinlik detayları yüklenirken hata oluştu.');
    }
  }

  // Show event detail modal
  showEventDetail(event) {
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    document.getElementById('eventDetailTitle').textContent = event.title;
    document.getElementById('eventDetailBody').innerHTML = `
      <div class="row">
        <div class="col-md-4">
          <img src="${event.image || '/images/default-event.jpg'}" 
               alt="${event.title}" 
               class="img-fluid rounded">
        </div>
        <div class="col-md-8">
          <h6>Etkinlik Bilgileri</h6>
          <div class="event-detail-meta">
            <div class="mb-2">
              <i class="fas fa-calendar text-primary"></i>
              <strong>Tarih:</strong> ${formattedDate}
            </div>
            <div class="mb-2">
              <i class="fas fa-clock text-primary"></i>
              <strong>Saat:</strong> ${formattedTime}
            </div>
            <div class="mb-2">
              <i class="fas fa-map-marker-alt text-primary"></i>
              <strong>Mekan:</strong> ${event.venue}
            </div>
            <div class="mb-2">
              <i class="fas fa-city text-primary"></i>
              <strong>Şehir:</strong> ${this.getLocationText(event.location)}
            </div>
            <div class="mb-2">
              <i class="fas fa-tag text-primary"></i>
              <strong>Tür:</strong> ${this.getEventTypeText(event.type)}
            </div>
            <div class="mb-2">
              <i class="fas fa-ticket-alt text-primary"></i>
              <strong>Fiyat:</strong> ${event.price === 0 ? 'Ücretsiz' : `${event.price} TL`}
            </div>
            ${event.capacity ? `
              <div class="mb-2">
                <i class="fas fa-users text-primary"></i>
                <strong>Kapasite:</strong> ${event.capacity} kişi
              </div>
            ` : ''}
          </div>
          <div class="mt-3">
            <h6>Açıklama</h6>
            <p>${event.description || 'Açıklama yok'}</p>
          </div>
        </div>
      </div>
    `;
    
    // Store current event ID for join action
    document.getElementById('joinEventBtn').setAttribute('data-event-id', event.id);
    
    const modal = new bootstrap.Modal(document.getElementById('eventDetailModal'));
    modal.show();
  }

  // Join event
  async joinEvent(eventId = null) {
    const targetEventId = eventId || document.getElementById('joinEventBtn').getAttribute('data-event-id');
    
    if (!this.currentUser) {
      alert('Lütfen giriş yapın.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE}/api/events/${targetEventId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        alert('Etkinliğe katılımınız kaydedildi!');
        // Close modal if open
        const modal = bootstrap.Modal.getInstance(document.getElementById('eventDetailModal'));
        if (modal) modal.hide();
      } else {
        const error = await response.json();
        alert('Hata: ' + error.error);
      }
    } catch (error) {
      console.error('Error joining event:', error);
      alert('Etkinliğe katılım sırasında hata oluştu.');
    }
  }

  // Apply filters
  applyFilters() {
    this.filters = {
      type: document.getElementById('eventTypeFilter').value,
      location: document.getElementById('eventLocationFilter').value,
      date: document.getElementById('eventDateFilter').value,
      price: document.getElementById('eventPriceFilter').value
    };
    
    this.loadEvents();
  }

  // Clear filters
  clearFilters() {
    document.getElementById('eventTypeFilter').value = '';
    document.getElementById('eventLocationFilter').value = '';
    document.getElementById('eventDateFilter').value = '';
    document.getElementById('eventPriceFilter').value = '';
    
    this.filters = {
      type: '',
      location: '',
      date: '',
      price: ''
    };
    
    this.loadEvents();
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

// Initialize event manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.eventManager = new EventManager();
});

// Export for global access
window.EventManager = EventManager;
