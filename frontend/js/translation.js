// Translation service using LibreTranslate API
class TranslationService {
  constructor() {
    this.apiBase = window.location.hostname.includes('localhost') 
      ? 'http://localhost:4000' 
      : 'https://naramusic.onrender.com';
    this.cache = new Map();
    this.isTranslating = false;
  }

  // Get supported languages
  async getLanguages() {
    try {
      const response = await fetch(`${this.apiBase}/api/translate/languages`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching languages:', error);
      return [];
    }
  }

  // Translate text
  async translate(text, source = 'en', target = 'tr') {
    if (!text || text.trim() === '') return text;
    
    // Check cache first
    const cacheKey = `${text}-${source}-${target}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.apiBase}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          source: source,
          target: target
        })
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, data.translatedText);
      
      return data.translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text if translation fails
    }
  }

  // Translate multiple texts
  async translateBatch(texts, source = 'en', target = 'tr') {
    const results = [];
    
    for (const text of texts) {
      const translated = await this.translate(text, source, target);
      results.push(translated);
    }
    
    return results;
  }

  // Translate page content
  async translatePage(targetLang = 'tr') {
    if (this.isTranslating) return;
    this.isTranslating = true;

    try {
      // Get all translatable elements
      const elements = document.querySelectorAll('[data-translate]');
      
      for (const element of elements) {
        const originalText = element.textContent.trim();
        if (originalText) {
          const translatedText = await this.translate(originalText, 'en', targetLang);
          element.textContent = translatedText;
        }
      }

      // Translate placeholders
      const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      for (const input of inputs) {
        const originalPlaceholder = input.getAttribute('placeholder');
        if (originalPlaceholder) {
          const translatedPlaceholder = await this.translate(originalPlaceholder, 'en', targetLang);
          input.setAttribute('placeholder', translatedPlaceholder);
        }
      }

      // Translate titles and alt texts
      const titles = document.querySelectorAll('[title]');
      for (const title of titles) {
        const originalTitle = title.getAttribute('title');
        if (originalTitle) {
          const translatedTitle = await this.translate(originalTitle, 'en', targetLang);
          title.setAttribute('title', translatedTitle);
        }
      }

    } catch (error) {
      console.error('Page translation error:', error);
    } finally {
      this.isTranslating = false;
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

// Create global instance
window.translationService = new TranslationService();

// Auto-translate on page load if language is not Turkish
document.addEventListener('DOMContentLoaded', () => {
  const currentLang = document.documentElement.lang || 'en';
  if (currentLang !== 'tr') {
    // Small delay to ensure page is fully loaded
    setTimeout(() => {
      window.translationService.translatePage('tr');
    }, 1000);
  }
});

