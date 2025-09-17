// Translation Service
class TranslationService {
  constructor() {
    this.currentLang = localStorage.getItem('lang') || 'tr';
    this.translations = window.translations || {};
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadTranslations();
  }

  setupEventListeners() {
    // Language toggle
    const languageToggle = document.getElementById('language-toggle');
    if (languageToggle) {
      languageToggle.addEventListener('change', (e) => {
        this.changeLanguage(e.target.value);
      });
    }
  }

  loadTranslations() {
    // Load translations from window.translations
    if (window.translations) {
      this.translations = window.translations;
    }
  }

  async changeLanguage(lang) {
    if (lang === this.currentLang) return;

    this.currentLang = lang;
    localStorage.setItem('lang', lang);

    if (lang === 'tr') {
      // Reset to original Turkish content
      location.reload();
    } else {
      // Translate to English
      await this.translatePage(lang);
    }
  }

  async translatePage(targetLang) {
    try {
      // Get all translatable elements
      const elements = document.querySelectorAll('[data-translate]');
      const texts = Array.from(elements).map(el => el.textContent.trim());
      
      if (texts.length === 0) return;

      // Translate texts
      const translatedTexts = await this.translateTexts(texts, targetLang);
      
      // Apply translations
      elements.forEach((el, index) => {
        if (translatedTexts[index]) {
          el.textContent = translatedTexts[index];
        }
      });

      // Update page title
      if (targetLang === 'en') {
        document.title = 'Nara Music - Music Community';
      }

    } catch (error) {
      console.error('Translation error:', error);
    }
  }

  async translateTexts(texts, targetLang) {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          texts: texts,
          target: targetLang
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.translations || texts;
      } else {
        // Fallback to local translations
        return this.getLocalTranslations(texts, targetLang);
      }
    } catch (error) {
      console.error('Translation API error:', error);
      return this.getLocalTranslations(texts, targetLang);
    }
  }

  getLocalTranslations(texts, targetLang) {
    const localTranslations = {
      'tr': {
        'Ana Sayfa': 'Home',
        'Hakkında': 'About',
        'İletişim': 'Contact',
        'Giriş': 'Login',
        'Kayıt': 'Register',
        'Yeni Gönderi': 'New Post',
        'Ara...': 'Search...',
        'Bildirimler': 'Notifications',
        'Kaydedilenler': 'Saved',
        'Mod': 'Mod',
        'En Popüler': 'Most Popular',
        'En Son Eklenenler': 'Latest',
        'Popüler': 'Popular',
        'Son Yorumlar': 'Recent Comments',
        'Kategoriler': 'Categories',
        'Topluluk': 'Community',
        'Üye Ol': 'Sign Up',
        'Giriş Yap': 'Login',
        'Kayıt Ol': 'Register',
        'Yeni Gönderi Oluştur': 'Create New Post',
        'Başlık': 'Title',
        'İçerik': 'Content',
        'Kategori': 'Category',
        'Paylaş': 'Share',
        'Daha Fazla': 'Load More',
        'Yükleniyor...': 'Loading...',
        'Hata': 'Error',
        'Başarılı': 'Success',
        'İptal': 'Cancel',
        'Kaydet': 'Save',
        'Kapat': 'Close',
        'Gönder': 'Send',
        'Adınız': 'Your Name',
        'Email': 'Email',
        'Parola': 'Password',
        'Kullanıcı Adı': 'Username',
        'Mesajınız': 'Your Message',
        'Yorum yaz...': 'Write a comment...',
        'Henüz gönderi yok': 'No posts yet',
        'Henüz yorum yok': 'No comments yet',
        'Tüm hakları saklıdır': 'All rights reserved',
        'Nara Müzik — Müzik tartışma topluluğu': 'Nara Music — Music discussion community',
        'Nara Müzik, topluluk odaklı bir müzik platformudur. Üyeler yeni parçaları, röportajları ve etkinlikleri paylaşır; biz de keşfi kolaylaştıran sade bir arayüz sunarız.': 'Nara Music is a community-focused music platform. Members share new tracks, interviews and events; we provide a simple interface that makes discovery easy.'
      }
    };

    return texts.map(text => {
      const translation = localTranslations[targetLang]?.[text];
      return translation || text;
    });
  }

  translate(key, fallback = '') {
    return this.translations[key] || fallback;
  }

  getCurrentLanguage() {
    return this.currentLang;
  }
}

// Initialize translation service
document.addEventListener('DOMContentLoaded', () => {
  window.translationService = new TranslationService();
});

// Export for global access
window.TranslationService = TranslationService;