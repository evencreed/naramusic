// Backend base URL (lokal veya prod)
const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
const BACKEND_BASE = isLocalHost
  ? "http://localhost:4000"
  : "https://naramusic.onrender.com";

const API_URL = `${BACKEND_BASE}/api/posts`;

// Dil durumu
let CURRENT_LANG = localStorage.getItem("lang") || "tr";
let CURRENT_USER = JSON.parse(localStorage.getItem("user") || "null");
let AUTH_TOKEN = localStorage.getItem('token') || null;

function updateAuthUI(){
  const authButtons = document.getElementById('authButtons');
  const newPostBtn = document.querySelector('[data-bs-target="#createPostModal"]');
  if (!authButtons) return;
  if (CURRENT_USER){
    authButtons.innerHTML = `
      <a class="btn btn-outline-light btn-sm" href="${location.pathname.includes('/pages/') ? '../pages/profil.html' : 'pages/profil.html'}">Profil</a>
      <button id="logoutBtn" class="btn btn-outline-light btn-sm">Çıkış</button>
    `;
    if(newPostBtn){ newPostBtn.classList.remove('disabled'); newPostBtn.removeAttribute('disabled'); newPostBtn.title=''; }
    const lb = document.getElementById('logoutBtn');
    if(lb){ lb.addEventListener('click', ()=>{ localStorage.removeItem('user'); CURRENT_USER=null; location.reload(); }); }
  } else {
    authButtons.innerHTML = `
      <button class="btn btn-outline-light btn-sm" data-bs-toggle="modal" data-bs-target="#loginModal">Giriş</button>
      <button class="btn btn-outline-light btn-sm" data-bs-toggle="modal" data-bs-target="#registerModal">Kayıt</button>
    `;
    if(newPostBtn){ newPostBtn.classList.add('disabled'); newPostBtn.setAttribute('disabled','disabled'); newPostBtn.title='Gönderi oluşturmak için giriş yapın'; }
  }
}

async function translateMany(textArray, target){
  if (target === "tr") return textArray; // Türkçe ise çeviri yok
  try {
    const res = await fetch(`${BACKEND_BASE}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: textArray, target })
    });
    const data = await res.json();
    if (data.translations) return data.translations;
  } catch (e) {
    console.error("translateMany error", e);
  }
  return textArray;
}

// Ana sayfa (index.html) için: Popüler + En Son Postlar
document.addEventListener("DOMContentLoaded", () => {
  updateAuthUI();
  enforceAuthForCreatePost();
  if (document.getElementById("popularPosts")) {
    loadPopularPosts();
  }
  if (document.getElementById("latestPosts")) {
    loadLatestPostsPaginated(true);
    const moreBtn = document.getElementById('loadMoreLatest');
    if (moreBtn){ moreBtn.addEventListener('click', ()=> loadLatestPostsPaginated(false)); }
  }
  if (document.getElementById("categoryPosts")) {
    const category = document.body.getAttribute("data-category"); 
    loadCategoryPosts(category);
  }
  if (document.getElementById('spotifyPlaylist')){
    loadSpotifyPlaylist();
  }
  if (document.getElementById("newPostForm")) {
    setupNewPostForm();
  }
});

// "Yeni Gönderi" butonu için giriş zorunluluğu
function enforceAuthForCreatePost(){
  const buttons = document.querySelectorAll('[data-bs-target="#createPostModal"]');
  if(!buttons || !buttons.length) return;
  buttons.forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      if (CURRENT_USER) return; // girişliyse izin ver
      e.preventDefault();
      e.stopPropagation();
      const loginModalEl = document.getElementById('loginModal');
      if(loginModalEl){
        const body = loginModalEl.querySelector('.modal-body');
        if(body && !body.querySelector('.auth-required-msg')){
          const div = document.createElement('div');
          div.className = 'alert alert-warning auth-required-msg';
          div.innerHTML = 'Yeni gönderi oluşturmak için önce giriş yapmanız gerekmektedir. Kayıt olmadıysanız <a href="#" id="goToRegister">buradan kayıt olabilirsiniz</a>.';
          body.prepend(div);
          const link = div.querySelector('#goToRegister');
          if(link){
            link.addEventListener('click', (ev)=>{
              ev.preventDefault();
              const lm = bootstrap.Modal.getOrCreateInstance(loginModalEl);
              lm.hide();
              const rmEl = document.getElementById('registerModal');
              if(rmEl){ bootstrap.Modal.getOrCreateInstance(rmEl).show(); }
            });
          }
        }
        bootstrap.Modal.getOrCreateInstance(loginModalEl).show();
      } else {
        alert('Yeni gönderi oluşturmak için önce giriş yapmanız gerekmektedir.');
      }
    }, true);
  });
}

// Spotify Playlist yerleştirme (oEmbed/iframe) — backend gerekmez
function loadSpotifyPlaylist(){
  const container = document.getElementById('spotifyPlaylist');
  if (!container) return;
  const playlistId = container.getAttribute('data-playlist-id') || '37i9dQZF1DX2TRYkJECvfC';
  const playlistUrl = container.getAttribute('data-playlist-url') || `https://open.spotify.com/playlist/${playlistId}`;
  container.innerHTML = '<div class="text-muted">Spotify çalma listesi yükleniyor...</div>';
  fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(playlistUrl)}`)
    .then(r=>r.ok?r.json():Promise.reject(new Error('oembed failed')))
    .then(data=>{
      if (data && data.html){
        container.innerHTML = data.html;
      } else {
        throw new Error('no html');
      }
    })
    .catch(()=>{
      const iframe = document.createElement('iframe');
      iframe.src = `https://open.spotify.com/embed/playlist/${playlistId}`;
      iframe.width = '100%';
      iframe.height = '380';
      iframe.frameBorder = '0';
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      iframe.loading = 'lazy';
      container.innerHTML = '';
      container.appendChild(iframe);
    });
}

// Popüler Postlar
function loadPopularPosts() {
  fetch(`${API_URL}/popular`)
    .then(res => res.json())
    .then(async posts => {
      if (CURRENT_LANG === 'en' && posts.length){
        const toTranslate = [];
        posts.forEach(p => {
          toTranslate.push(p.title);
          toTranslate.push(p.content.substring(0, 160));
        });
        const translated = await translateMany(toTranslate, 'en');
        for (let i=0; i<posts.length; i++){
          posts[i].title = translated[i*2] || posts[i].title;
          posts[i].content = translated[i*2+1] || posts[i].content;
        }
      }
      const container = document.getElementById("popularPosts");
      if (!posts.length) {
        container.innerHTML = "<p>Henüz popüler post yok.</p>";
        return;
      }
      container.innerHTML = posts.map(p => {
        const thumb = p.mediaUrl ? `<img src="${p.mediaUrl}" alt="" class="post-thumb mb-2">` : '';
        const linkBtn = p.linkUrl ? `<a href="${p.linkUrl}" target="_blank" class="btn btn-sm btn-outline-secondary">Bağlantı</a>` : '';
        return `
        <div class="col-md-4 mb-3">
          <div class="card h-100 shadow-sm" data-post-id="${p.id}">
            <div class="card-body">
              ${thumb}
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,100)}...</p>
              <span class="badge bg-primary">${p.category}</span>
              ${linkBtn ? `<div class=\"mt-2\">${linkBtn}</div>` : ''}
            </div>
          </div>
        </div>
      `;}).join("");
      attachPostCardHandlers(container);
    })
    .catch(err => console.error("Popüler postları yüklerken hata:", err));
}

// En Son Postlar
function loadLatestPosts() {
  fetch(`${API_URL}/latest`)
    .then(res => res.json())
    .then(async posts => {
      if (CURRENT_LANG === 'en' && posts.length){
        const toTranslate = [];
        posts.forEach(p => {
          toTranslate.push(p.title);
          toTranslate.push(p.content.substring(0, 200));
        });
        const translated = await translateMany(toTranslate, 'en');
        for (let i=0; i<posts.length; i++){
          posts[i].title = translated[i*2] || posts[i].title;
          posts[i].content = translated[i*2+1] || posts[i].content;
        }
      }
      const container = document.getElementById("latestPosts");
      if (!posts.length) {
        container.innerHTML = "<p>Henüz post eklenmedi.</p>";
        return;
      }
      container.innerHTML = posts.map(p => {
        const thumb = p.mediaUrl ? `<img src="${p.mediaUrl}" alt="" class="post-thumb mb-2">` : '';
        const linkBtn = p.linkUrl ? `<a href="${p.linkUrl}" target="_blank" class="btn btn-sm btn-outline-secondary">Bağlantı</a>` : '';
        return `
        <div class="col-md-6 mb-3">
          <div class="card h-100 shadow-sm" data-post-id="${p.id}">
            <div class="card-body">
              ${thumb}
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,150)}...</p>
              <span class="badge bg-secondary">${p.category}</span>
              ${linkBtn ? `<div class=\"mt-2\">${linkBtn}</div>` : ''}
            </div>
          </div>
        </div>
      `;}).join("");
      attachPostCardHandlers(container);
    })
    .catch(err => console.error("Son postları yüklerken hata:", err));
}

// Kategoriye Göre Postlar (ör. yenimuzik.html)
function loadCategoryPosts(category) {
  fetch(`${API_URL}/category/${category}`)
    .then(res => res.json())
    .then(async posts => {
      if (CURRENT_LANG === 'en' && posts.length){
        const toTranslate = [];
        posts.forEach(p => {
          toTranslate.push(p.title);
          toTranslate.push(p.content.substring(0, 200));
        });
        const translated = await translateMany(toTranslate, 'en');
        for (let i=0; i<posts.length; i++){
          posts[i].title = translated[i*2] || posts[i].title;
          posts[i].content = translated[i*2+1] || posts[i].content;
        }
      }
      const container = document.getElementById("categoryPosts");
      if (!posts.length) {
        container.innerHTML = "<p>Bu kategoride henüz post yok.</p>";
        return;
      }
      container.innerHTML = posts.map(p => {
        const thumb = p.mediaUrl ? `<img src="${p.mediaUrl}" alt="" class="post-thumb mb-2">` : '';
        const linkBtn = p.linkUrl ? `<a href="${p.linkUrl}" target="_blank" class="btn btn-sm btn-outline-secondary">Bağlantı</a>` : '';
        const author = p.authorName ? `<a class="link-light text-decoration-none" href="${location.pathname.includes('/pages/')?'':'pages/'}user.html?uid=${p.authorId}&name=${encodeURIComponent(p.authorName)}">${p.authorName}</a>` : 'Anonim';
        return `
        <div class="col-md-6 mb-3">
          <div class="card h-100 shadow-sm" data-post-id="${p.id}">
            <div class="card-body">
              ${thumb}
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,150)}...</p>
              <small class="text-muted">Paylaşan: ${author}</small>
              ${linkBtn ? `<div class=\"mt-2\">${linkBtn}</div>` : ''}
            </div>
          </div>
        </div>
      `;}).join("");
      attachPostCardHandlers(container);
    })
    .catch(err => console.error("Kategori postlarını yüklerken hata:", err));
}

// Kartlar: detay modalı ve görüntülenme arttırma
function attachPostCardHandlers(scope){
  const root = scope || document;
  const cards = root.querySelectorAll('.card[data-post-id]');
  cards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', async (ev)=>{
      if (ev.target.closest('.btn, .bookmark-btn, .like-btn, a')) return;
      const id = card.getAttribute('data-post-id');
      const base = location.pathname.includes('/pages/') ? '' : 'pages/';
      location.href = `${base}post.html?id=${encodeURIComponent(id)}`;
    });
  });
}

function showPostDetailModal(p){
  const mEl = document.getElementById('postDetailModal');
  if(!mEl){ return; }
  const titleEl = mEl.querySelector('#postDetailTitle');
  const metaEl = mEl.querySelector('#postDetailMeta');
  const contentEl = mEl.querySelector('#postDetailContent');
  if (titleEl) titleEl.textContent = p.title || 'Gönderi';
  if (metaEl) metaEl.textContent = `${p.authorName || 'Anonim'} • ${new Date(p.createdAt).toLocaleString()} • ${p.category || ''}`;
  let html = '';
  if (p.mediaUrl){ html += `<img src="${p.mediaUrl}" alt="" class="img-fluid rounded mb-3">`; }
  html += `<div>${(p.content||'').replace(/\n/g,'<br>')}</div>`;
  if (p.linkUrl){ html += `<div class="mt-3"><a class="btn btn-sm btn-outline-secondary" href="${p.linkUrl}" target="_blank">Bağlantıyı Aç</a></div>`; }
  if (contentEl) contentEl.innerHTML = html;
  bootstrap.Modal.getOrCreateInstance(mEl).show();
}

// Yeni Post Ekleme Sayfası (newpost.html)
function setupNewPostForm() {
  const form = document.getElementById("newPostForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!CURRENT_USER){
      alert('Gönderi oluşturmak için giriş yapın.');
      return;
    }

    const title = document.getElementById("postTitle").value;
    const content = document.getElementById("postContent").value;
    const category = document.getElementById("postCategory").value;
    const mediaUrl = (document.getElementById("postMediaUrl")?.value || '').trim();
    const linkUrl = (document.getElementById("postLinkUrl")?.value || '').trim();
    const tags = (document.getElementById("postTags")?.value || '')
      .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);

    const authorId = CURRENT_USER.id;
    const authorName = CURRENT_USER.username;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ title, content, category, mediaUrl, linkUrl, tags })
      });
      const data = await res.json();

      if (data.error) {
        alert("Post eklenemedi: " + data.error);
      } else {
        alert("Post başarıyla eklendi!");
        form.reset();
        // Kategori sayfasına yönlendir
        const categoryTo = (category || '').toLowerCase();
        const base = location.pathname.includes('/pages/') ? '' : 'pages/';
        if (categoryTo === 'yenimuzik') {
          location.href = `${base}yenimuzik.html`;
        } else if (categoryTo === 'endustri') {
          location.href = `${base}endustri.html`;
        } else if (categoryTo === 'degerlendirme') {
          location.href = `${base}degerlendirme.html`;
        } else if (categoryTo === 'album') {
          location.href = `${base}album.html`;
        } else if (categoryTo === 'roportaj') {
          location.href = `${base}roportaj.html`;
        } else if (categoryTo === 'etkinlik') {
          location.href = `${base}etkinlik.html`;
        } else if (categoryTo === 'dizifilm') {
          location.href = `${base}dizifilm.html`;
        }
      }
    } catch (err) {
      console.error("Post ekleme hatası:", err);
    }
  });
}

// Basit sahte kimlik doğrulama kancaları (yerine Firebase gelecek)
window.addEventListener('load', ()=>{
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  // Helper: fully close any open modals and remove stray backdrops
  function closeAllModals(){
    try{
      document.querySelectorAll('.modal.show').forEach(m=>{
        try{ bootstrap.Modal.getOrCreateInstance(m).hide(); }catch(_){ }
      });
      document.querySelectorAll('.modal-backdrop').forEach(b=>b.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('padding-right');
    }catch(e){ console.warn('closeAllModals warn', e); }
  }
  // Login modalına "Şifremi unuttum?" akışını ekle
  const loginModal = document.getElementById('loginModal');
  if (loginModal){
    const body = loginModal.querySelector('.modal-body');
    if (body && !body.querySelector('#forgotPasswordLink')){
      const forgotWrapper = document.createElement('div');
      forgotWrapper.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mt-2">
          <small class="text-muted">Parolanızı mı unuttunuz?</small>
          <a href="#" id="forgotPasswordLink" class="small">Şifremi unuttum</a>
        </div>
        <form id="resetPasswordForm" class="mt-2 d-none">
          <input name="email" type="email" class="form-control mb-2" placeholder="Kayıtlı email" required>
          <input name="newPassword" type="password" class="form-control mb-2" placeholder="Yeni parola" required>
          <button type="submit" class="btn btn-outline-secondary w-100">Parolayı Sıfırla</button>
        </form>
      `;
      body.appendChild(forgotWrapper);
      const forgotLink = body.querySelector('#forgotPasswordLink');
      const resetForm = body.querySelector('#resetPasswordForm');
      const loginEmailInput = body.querySelector('input[name="email"]');
      if (forgotLink && resetForm){
        forgotLink.addEventListener('click', (e)=>{
          e.preventDefault();
          // email alanını reset formuna taşı
          const resetEmail = resetForm.querySelector('input[name="email"]');
          if (loginEmailInput && resetEmail && !resetEmail.value){
            resetEmail.value = loginEmailInput.value;
          }
          resetForm.classList.toggle('d-none');
        });
        resetForm.addEventListener('submit', async (e)=>{
          e.preventDefault();
          const fd = new FormData(resetForm);
          const payload = { email: fd.get('email'), newPassword: fd.get('newPassword') };
          try{
            const r = await fetch(`${BACKEND_BASE}/api/auth/reset-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            const data = await r.json();
            if(data.error){ alert(data.error); return; }
            alert('Parola sıfırlandı. Yeni parolanızla giriş yapabilirsiniz.');
            resetForm.classList.add('d-none');
            // yeni parola ile girişe odaklan
            if (loginEmailInput){ loginEmailInput.value = payload.email; }
            const loginPwd = body.querySelector('input[name="password"]');
            if (loginPwd){ loginPwd.value = fd.get('newPassword'); }
          }catch(err){ console.error(err); alert('Parola sıfırlama hatası'); }
        });
      }
    }
  }
  if (registerForm){
    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(registerForm);
      const payload = { username: fd.get('username'), email: fd.get('email'), password: fd.get('password') };
      try{
        const r = await fetch(`${BACKEND_BASE}/api/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await r.json();
        if(data.error){ alert(data.error); return; }
        localStorage.setItem('user', JSON.stringify(data.user)); localStorage.setItem('token', data.token);
        CURRENT_USER = data.user; AUTH_TOKEN = data.token; updateAuthUI();
        const reg = document.getElementById('registerModal');
        if (reg){ bootstrap.Modal.getOrCreateInstance(reg).hide(); }
        closeAllModals();
      }catch(err){ console.error(err); alert('Kayıt hatası'); }
    });
  }
  if (loginForm){
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(loginForm);
      const payload = { email: fd.get('email'), password: fd.get('password') };
      try{
        const r = await fetch(`${BACKEND_BASE}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await r.json();
        if(data.error){ alert(data.error); return; }
        localStorage.setItem('user', JSON.stringify(data.user)); localStorage.setItem('token', data.token);
        CURRENT_USER = data.user; AUTH_TOKEN = data.token; updateAuthUI();
        const logm = document.getElementById('loginModal');
        if (logm){ bootstrap.Modal.getOrCreateInstance(logm).hide(); }
        closeAllModals();
      }catch(err){ console.error(err); alert('Giriş hatası'); }
    });
  }
});

// Arama, sayfalandırma, like, tag desteği:

// Search
const searchInput = document.getElementById('globalSearch') || document.querySelector('input[placeholder="Ara..."]');
if (searchInput){
  searchInput.id = 'globalSearch';
  let t;
  searchInput.addEventListener('input', ()=>{
    clearTimeout(t);
    const q = searchInput.value.trim();
    t = setTimeout(async ()=>{
      if (!q) return;
      const r = await fetch(`${BACKEND_BASE}/api/search?q=${encodeURIComponent(q)}`);
      const items = await r.json();
      // basit render: latestPosts alanına yaz
      const container = document.getElementById("latestPosts");
      if (container){
        container.innerHTML = items.map(p=>`
          <div class="col-md-6 mb-3">
            <div class="card h-100 shadow-sm" data-post-id="${p.id}">
              <div class="card-body">
                ${p.mediaUrl?`<img src="${p.mediaUrl}" class="post-thumb mb-2">`:''}
                <h5 class="card-title">${p.title}</h5>
                <div class="mb-2"><span class="badge bg-secondary">${p.category||''}</span> ${Array.isArray(p.tags)?p.tags.map(t=>`<span class="badge bg-dark ms-1">#${t}</span>`).join(''):''}</div>
                <p class="card-text">${(p.content||'').substring(0,150)}...</p>
              </div>
            </div>
          </div>
        `).join('');
        attachPostCardHandlers(container);
      }
    }, 300);
  });
}

// "En son" için sayfalandırma (Load More)
let latestCursor = null;
async function loadLatestPostsPaginated(reset=false){
  const container = document.getElementById("latestPosts");
  if (!container) return;
  if (reset){ latestCursor = null; container.innerHTML = ''; }
  const url = new URL(`${BACKEND_BASE}/api/posts`);
  if (latestCursor) url.searchParams.set('after', latestCursor);
  const r = await fetch(url.toString());
  const data = await r.json();
  const items = data.items || [];
  container.insertAdjacentHTML('beforeend', items.map(p=>`
    <div class="col-md-6 mb-3">
      <div class="card h-100 shadow-sm" data-post-id="${p.id}">
        <div class="card-body">
          ${p.mediaUrl?`<img src="${p.mediaUrl}" class="post-thumb mb-2">`:''}
          <h5 class="card-title">${p.title}</h5>
          <div class="mb-2"><span class="badge bg-secondary">${p.category||''}</span> ${Array.isArray(p.tags)?p.tags.map(t=>`<span class="badge bg-dark ms-1">#${t}</span>`).join(''):''}</div>
          <p class="card-text">${(p.content||'').substring(0,150)}...</p>
        </div>
      </div>
    </div>
  `).join(''));
  attachPostCardHandlers(container);
  latestCursor = data.nextAfter;
  const moreBtn = document.getElementById('loadMoreLatest');
  if (moreBtn){ moreBtn.disabled = !latestCursor; moreBtn.classList.toggle('d-none', !latestCursor); }
}

// Post like butonları (kart üstünde gösterim basit):
function renderLikeButton(p){
  return `<button class="btn btn-sm btn-outline-light like-btn" data-id="${p.id}">👍 ${p.likes||0}</button>`;
}
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('.like-btn');
  if (!btn) return;
  if (!CURRENT_USER){ alert('Beğenmek için giriş yapın'); return; }
  const id = btn.getAttribute('data-id');
  const r = await fetch(`${BACKEND_BASE}/api/posts/${id}/like`, { method:'POST', headers:{ 'Authorization': `Bearer ${AUTH_TOKEN}` }});
  const data = await r.json();
  if (!data.error){ btn.innerHTML = `👍 ${data.likes}`; }
});

// Bookmarks toggle
document.addEventListener('click', async (e)=>{
  const b = e.target.closest('.bookmark-btn');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (!CURRENT_USER){ alert('Kaydetmek için giriş yapın'); return; }
  const id = b.getAttribute('data-id');
  try{
    const r = await fetch(`${BACKEND_BASE}/api/posts/${id}/bookmark`, { method:'POST', headers:{ 'Authorization': `Bearer ${AUTH_TOKEN}` }});
    const data = await r.json();
    if (!data.error){ b.innerHTML = data.bookmarked ? '🔖 Kaydedildi' : '🔖 Kaydet'; }
  }catch(err){ console.error(err); }
});