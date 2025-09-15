const languageSwitcher = document.getElementById("language-toggle") || document.getElementById("languageSwitcher");
let translations = {};

// Dil dosyalarını yükle
async function loadTranslations(lang) {
  try {
    const response = await fetch(`lang/${lang}.json`);
    if (response.ok) {
      translations = await response.json();
      return true;
    }
  } catch (error) {
    console.error('Error loading translations:', error);
  }
  return false;
}

// UI elementlerini çevir
function translateUI() {
  // data-lang attribute'u olan elementleri bul ve çevir
  const elements = document.querySelectorAll('[data-lang]');
  elements.forEach(element => {
    const key = element.getAttribute('data-lang');
    if (translations[key]) {
      element.textContent = translations[key];
    }
  });

  // placeholder'ları çevir
  const placeholders = document.querySelectorAll('[data-placeholder-lang]');
  placeholders.forEach(element => {
    const key = element.getAttribute('data-placeholder-lang');
    if (translations[key]) {
      element.placeholder = translations[key];
    }
  });

  // title attribute'larını çevir
  const titles = document.querySelectorAll('[data-title-lang]');
  titles.forEach(element => {
    const key = element.getAttribute('data-title-lang');
    if (translations[key]) {
      element.title = translations[key];
    }
  });
}

async function setLanguage(lang){
  localStorage.setItem('lang', lang);
  try{ document.documentElement.lang = lang; }catch(_){ }
  
  // Dil dosyalarını yükle
  await loadTranslations(lang);
  
  // UI elementlerini çevir
  translateUI();
  
  // Global dil değişkenini güncelle
  if (typeof window !== 'undefined') {
    if (typeof CURRENT_LANG !== 'undefined') {
      CURRENT_LANG = lang;
    } else {
      window.CURRENT_LANG = lang;
    }
  }
  
  // Dinamik post içerikleri seçili dile göre yeniden yüklenecek
  if (document.getElementById("popularPosts")) {
    if (typeof loadPopularPosts === 'function') loadPopularPosts();
  }
  if (document.getElementById("latestPosts")) {
    if (typeof loadLatestPosts === 'function') loadLatestPosts();
  }
  if (document.getElementById("categoryPosts")) {
    const category = document.body.getAttribute("data-category");
    if (typeof loadCategoryPosts === 'function') loadCategoryPosts(category);
  }
}

if (languageSwitcher){
  const saved = localStorage.getItem('lang') || 'tr';
  languageSwitcher.value = saved;
  languageSwitcher.addEventListener('change', async (e)=>{
    const lang = e.target.value;
    await setLanguage(lang);
  });
}

// İlk yükleme
document.addEventListener('DOMContentLoaded', async () => {
  await setLanguage(localStorage.getItem('lang') || 'tr');
});