// Backend base URL (lokal veya prod)
const BACKEND_BASE = window.location.hostname.includes("vercel.app")
  ? "https://naramusic.onrender.com"
  : "http://localhost:4000";

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
    loadLatestPosts();
  }
  if (document.getElementById("categoryPosts")) {
    const category = document.body.getAttribute("data-category"); 
    loadCategoryPosts(category);
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
      container.innerHTML = posts.map(p => `
        <div class="col-md-4 mb-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,100)}...</p>
              <span class="badge bg-primary">${p.category}</span>
            </div>
          </div>
        </div>
      `).join("");
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
      container.innerHTML = posts.map(p => `
        <div class="col-md-6 mb-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,150)}...</p>
              <span class="badge bg-secondary">${p.category}</span>
            </div>
          </div>
        </div>
      `).join("");
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
      container.innerHTML = posts.map(p => `
        <div class="col-md-6 mb-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,150)}...</p>
              <small class="text-muted">Paylaşan: ${p.authorName || "Anonim"}</small>
            </div>
          </div>
        </div>
      `).join("");
    })
    .catch(err => console.error("Kategori postlarını yüklerken hata:", err));
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

    const authorId = CURRENT_USER.id;
    const authorName = CURRENT_USER.username;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ title, content, category })
      });
      const data = await res.json();

      if (data.error) {
        alert("Post eklenemedi: " + data.error);
      } else {
        alert("Post başarıyla eklendi!");
        form.reset();
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
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
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
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
      }catch(err){ console.error(err); alert('Giriş hatası'); }
    });
  }
});