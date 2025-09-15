const languageSwitcher = document.getElementById("language-toggle") || document.getElementById("languageSwitcher");

function setLanguage(lang){
  localStorage.setItem('lang', lang);
  try{ document.documentElement.lang = lang; }catch(_){ }
  // Uygulama metinleri için ileride UI çevirisi eklenebilir.
  // Şimdilik dinamik post içerikleri seçili dile göre yeniden yüklenecek.
  if (document.getElementById("popularPosts")) {
    // yeniden yükle
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
  languageSwitcher.addEventListener('change', (e)=>{
    const lang = e.target.value;
    if (typeof window !== 'undefined') {
      if (typeof CURRENT_LANG !== 'undefined') {
        CURRENT_LANG = lang;
      } else {
        window.CURRENT_LANG = lang;
      }
    }
    setLanguage(lang);
  });
}

// ilk yükleme
setLanguage(localStorage.getItem('lang') || 'tr');