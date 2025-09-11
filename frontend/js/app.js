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
  const savedLink = document.getElementById('savedLink');
  const modLink = document.getElementById('modLink');
  if (!authButtons) return;
  if (CURRENT_USER){
    authButtons.innerHTML = `
      <a class="btn btn-outline-light btn-sm" href="${location.pathname.includes('/pages/') ? '../pages/profil.html' : 'pages/profil.html'}">Profil</a>
      <button id="logoutBtn" class="btn btn-outline-light btn-sm">Çıkış</button>
    `;
    if(newPostBtn){ newPostBtn.classList.remove('disabled'); newPostBtn.removeAttribute('disabled'); newPostBtn.title=''; }
    const lb = document.getElementById('logoutBtn');
    if(lb){ lb.addEventListener('click', ()=>{ localStorage.removeItem('user'); CURRENT_USER=null; location.reload(); }); }
    if (savedLink){ savedLink.classList.remove('d-none'); }
    if (modLink){ modLink.classList.toggle('d-none', !(CURRENT_USER.role==='admin' || CURRENT_USER.role==='moderator')); }
  } else {
    authButtons.innerHTML = `
      <button class="btn btn-outline-light btn-sm" data-bs-toggle="modal" data-bs-target="#loginModal">Giriş</button>
      <button class="btn btn-outline-light btn-sm" data-bs-toggle="modal" data-bs-target="#registerModal">Kayıt</button>
    `;
    if(newPostBtn){ newPostBtn.classList.add('disabled'); newPostBtn.setAttribute('disabled','disabled'); newPostBtn.title='Gönderi oluşturmak için giriş yapın'; }
    if (savedLink){ savedLink.classList.add('d-none'); }
    if (modLink){ modLink.classList.add('d-none'); }
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
  setupLiveMarkdownPreview();
  setupMarkdownToolbar();
  setupUrlPopoverForEditor();
  setupDraftAutosave();
  setupMentionAutocomplete();
  setupEmojiPicker();
  setupNotificationsDropdown();
  if (document.getElementById("popularPosts")) {
    loadPopularPosts();
  }
  if (document.getElementById("latestPosts")) {
    loadLatestPostsPaginated(true);
    const moreBtn = document.getElementById('loadMoreLatest');
    if (moreBtn){ moreBtn.addEventListener('click', ()=> loadLatestPostsPaginated(false)); }
  }
  // Hero pinned highlight
  const heroSlide = document.getElementById('heroPinnedSlide');
  if (heroSlide){
    (async ()=>{
      try{
        // Try to find a pinned post among latest 50
        const r = await fetch(`${BACKEND_BASE}/api/posts?limit=30`);
        const data = await r.json();
        const items = Array.isArray(data.items)? data.items : [];
        const pinned = items.find(p=>p.pinned) || items[0];
        if (!pinned) return;
        const tEl = document.getElementById('heroPinnedTitle');
        const xEl = document.getElementById('heroPinnedExcerpt');
        const lEl = document.getElementById('heroPinnedLink');
        const iEl = document.getElementById('heroPinnedImg');
        if (tEl) tEl.textContent = pinned.title || 'Öne Çıkan';
        if (xEl) xEl.textContent = (pinned.content||'').substring(0,140);
        if (lEl){ const base = location.pathname.includes('/pages/') ? '' : 'pages/'; lEl.href = `${base}post.html?id=${encodeURIComponent(pinned.id)}`; }
        if (iEl && pinned.mediaUrl){ iEl.src = pinned.mediaUrl; }
      }catch(_){ }
    })();
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
      // pinned-first then views desc (already popular by views, we just ensure pinned bubble up)
      posts.sort((a,b)=>{
        const ap = a.pinned?1:0, bp = b.pinned?1:0; if (ap!==bp) return bp-ap; return (b.views||0)-(a.views||0);
      });
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
              ${(p.pinned?'<span class="badge bg-warning text-dark me-1">📌 Sabit</span>':'')+(p.locked?'<span class="badge bg-secondary me-1">🔒 Kilitli</span>':'')}
              ${thumb}
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,100)}...</p>
              <span class="badge bg-primary">${p.category}</span>
              ${linkBtn ? `<div class=\"mt-2\">${linkBtn}</div>` : ''}
              <div class="mt-2 d-flex gap-2">
                <button class="btn btn-sm btn-outline-light like-btn" data-id="${p.id}">👍 ${p.likes||0}</button>
                <button class="btn btn-sm btn-outline-light bookmark-btn" data-id="${p.id}">🔖 Kaydet</button>
              </div>
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
      posts.sort((a,b)=>{
        const ap = a.pinned?1:0, bp = b.pinned?1:0; if (ap!==bp) return bp-ap; return new Date(b.createdAt||0)-new Date(a.createdAt||0);
      });
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
              ${(p.pinned?'<span class="badge bg-warning text-dark me-1">📌 Sabit</span>':'')+(p.locked?'<span class="badge bg-secondary me-1">🔒 Kilitli</span>':'')}
              ${thumb}
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,150)}...</p>
              <span class="badge bg-secondary">${p.category}</span>
              ${linkBtn ? `<div class=\"mt-2\">${linkBtn}</div>` : ''}
              <div class="mt-2 d-flex gap-2">
                <button class="btn btn-sm btn-outline-light like-btn" data-id="${p.id}">👍 ${p.likes||0}</button>
                <button class="btn btn-sm btn-outline-light bookmark-btn" data-id="${p.id}">🔖 Kaydet</button>
              </div>
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
              ${(p.pinned?'<span class="badge bg-warning text-dark me-1">📌 Sabit</span>':'')+(p.locked?'<span class="badge bg-secondary me-1">🔒 Kilitli</span>':'')}
              ${thumb}
              <h5 class="card-title">${p.title}</h5>
              <p class="card-text">${p.content.substring(0,150)}...</p>
              <small class="text-muted">Paylaşan: ${author}</small>
              ${linkBtn ? `<div class=\"mt-2\">${linkBtn}</div>` : ''}
              <div class="mt-2 d-flex gap-2">
                <button class="btn btn-sm btn-outline-light like-btn" data-id="${p.id}">👍 ${p.likes||0}</button>
                <button class="btn btn-sm btn-outline-light bookmark-btn" data-id="${p.id}">🔖 Kaydet</button>
              </div>
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

// Elevate admin/mod controls on post detail if present
document.addEventListener('DOMContentLoaded', ()=>{
  const postActions = document.getElementById('postActions');
  if (!postActions) return;
  // Add pin/lock buttons for admin/mod
  const user = JSON.parse(localStorage.getItem('user')||'null');
  if (!user || !(['admin','moderator','superadmin'].includes(user.role))) return;
  // create buttons
  const pinBtn = document.createElement('button'); pinBtn.className='btn btn-sm btn-outline-info'; pinBtn.id='pinPostBtn'; pinBtn.textContent='📌 Sabitle';
  const lockBtn = document.createElement('button'); lockBtn.className='btn btn-sm btn-outline-secondary'; lockBtn.id='lockPostBtn'; lockBtn.textContent='🔒 Kilitle';
  postActions.appendChild(pinBtn); postActions.appendChild(lockBtn);
  const token = localStorage.getItem('token');
  const idMatch = location.search.match(/id=([^&]+)/); const postId = idMatch? decodeURIComponent(idMatch[1]) : null;
  const base = location.hostname.includes('localhost')? 'http://localhost:4000':'https://naramusic.onrender.com';
  if (pinBtn && postId){ pinBtn.addEventListener('click', async ()=>{ try{ await fetch(`${base}/api/posts/${postId}/pin`, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${token}` }, body: JSON.stringify({ pinned: true }) }); alert('Sabitleme gönderildi'); }catch(_){ alert('Sabitleme hata'); } }); }
  if (lockBtn && postId){ lockBtn.addEventListener('click', async ()=>{ try{ await fetch(`${base}/api/posts/${postId}/lock`, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${token}` }, body: JSON.stringify({ locked: true }) }); alert('Kilitleme gönderildi'); }catch(_){ alert('Kilitleme hata'); } }); }
});

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

// Create Post modal: live markdown preview
function setupLiveMarkdownPreview(){
  const textarea = document.getElementById('postContent');
  const preview = document.getElementById('postPreview');
  if (!textarea || !preview) return;
  const render = (value)=>{
    const raw = String(value||'');
    try{
      if (window.marked && typeof window.marked.parse === 'function'){
        preview.innerHTML = window.marked.parse(raw);
      } else {
        preview.innerHTML = raw
          .replace(/\n\n/g,'</p><p>')
          .replace(/\n/g,'<br>');
      }
    }catch(_){ preview.textContent = raw; }
  };
  render(textarea.value);
  ['input','change','keyup'].forEach(evt=> textarea.addEventListener(evt, ()=> render(textarea.value)));
}

// Notifications dropdown
function setupNotificationsDropdown(){
  const btn = document.getElementById('notifDropdownBtn');
  const menu = document.getElementById('notifMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', async ()=>{
    if (!CURRENT_USER){
      menu.innerHTML = '<li class="px-3 py-2 text-muted small">Bildirime erişmek için giriş yapın.</li>';
      return;
    }
    try{
      const r = await fetch(`${BACKEND_BASE}/api/notifications`, { headers:{ 'Authorization': `Bearer ${AUTH_TOKEN}` }});
      const items = await r.json();
      if (!Array.isArray(items) || !items.length){
        menu.innerHTML = '<li class="px-3 py-2 text-muted small">Bildiriminiz yok.</li>';
        return;
      }
      menu.innerHTML = items.map(n=>`
        <li>
          <a href="#" class="dropdown-item d-flex justify-content-between align-items-center notif-item" data-id="${n.id}">
            <span>${n.type==='mention' ? 'Bahsetme' : 'Bildirim'} • ${n.fromUser ? ('@'+n.fromUser) : ''}</span>
            ${n.read? '' : '<span class="badge bg-primary">Yeni</span>'}
          </a>
        </li>
      `).join('') + '<li><hr class="dropdown-divider"></li><li><button id="markAllRead" class="dropdown-item text-center">Tümünü okundu işaretle</button></li>';
    }catch(err){
      console.error(err);
      menu.innerHTML = '<li class="px-3 py-2 text-danger small">Bildiriler yüklenemedi</li>';
    }
  });
  menu.addEventListener('click', async (e)=>{
    const item = e.target.closest('.notif-item');
    if (item){
      e.preventDefault();
      const id = item.getAttribute('data-id');
      try{ await fetch(`${BACKEND_BASE}/api/notifications/${id}/read`, { method:'POST', headers:{ 'Authorization': `Bearer ${AUTH_TOKEN}` }}); item.querySelector('.badge')?.remove(); }
      catch(err){ console.error(err); }
    }
    if (e.target && e.target.id === 'markAllRead'){
      e.preventDefault();
      // naive: iterate current items
      menu.querySelectorAll('.notif-item').forEach(async a=>{
        const id = a.getAttribute('data-id');
        try{ await fetch(`${BACKEND_BASE}/api/notifications/${id}/read`, { method:'POST', headers:{ 'Authorization': `Bearer ${AUTH_TOKEN}` }}); a.querySelector('.badge')?.remove(); }catch(_){ }
      });
    }
  });
}

// Markdown toolbar logic
function setupMarkdownToolbar(){
  const textarea = document.getElementById('postContent');
  if (!textarea) return;
  const toolbar = document.querySelector('[aria-label="Editor toolbar"]');
  if (!toolbar) return;

  function surroundSelection(prefix, suffix){
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const value = textarea.value;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    textarea.value = before + prefix + selected + (suffix ?? '') + after;
    const cursorPos = before.length + prefix.length + selected.length + (suffix ? suffix.length : 0);
    textarea.focus();
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.dispatchEvent(new Event('input'));
  }

  function insertLinePrefix(prefix){
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const value = textarea.value;
    const pre = value.slice(0, start);
    const sel = value.slice(start, end);
    const post = value.slice(end);
    // expand to full lines
    const lineStart = pre.lastIndexOf('\n') + 1;
    const lineEnd = end + (post.indexOf('\n')===-1 ? 0 : post.indexOf('\n'));
    const block = value.slice(lineStart, lineEnd || end);
    const lines = block.split('\n').map(l=> prefix + (l.trim().length? l : ''));
    const newBlock = lines.join('\n');
    textarea.value = value.slice(0, lineStart) + newBlock + value.slice(lineStart + block.length);
    const newCursor = lineStart + newBlock.length;
    textarea.focus();
    textarea.setSelectionRange(newCursor, newCursor);
    textarea.dispatchEvent(new Event('input'));
  }

  toolbar.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-md-btn]');
    if (!btn) return;
    e.preventDefault();
    const type = btn.getAttribute('data-md-btn');
    if (type === 'bold') return surroundSelection('**','**');
    if (type === 'italic') return surroundSelection('*','*');
    if (type === 'strike') return surroundSelection('~~','~~');
    if (type === 'h2') return insertLinePrefix('## ');
    if (type === 'h3') return insertLinePrefix('### ');
    if (type === 'quote') return insertLinePrefix('> ');
    if (type === 'ul') return insertLinePrefix('- ');
    if (type === 'ol') return insertLinePrefix('1. ');
    if (type === 'task') return insertLinePrefix('- [ ] ');
    if (type === 'link') return openUrlPopover('link');
    if (type === 'image') return openUrlPopover('image');
    if (type === 'code') return surroundSelection('`','`');
    if (type === 'codeblock') return surroundSelection('\n```\n','\n```\n');
    if (type === 'table'){
      const tpl = '\n| Başlık 1 | Başlık 2 | Başlık 3 |\n| --- | --- | --- |\n| Hücre | Hücre | Hücre |\n| Hücre | Hücre | Hücre |\n';
      return surroundSelection('\n'+tpl,'');
    }
    if (type === 'hr'){
      return surroundSelection('\n\n---\n\n','');
    }
    if (type === 'emoji'){
      if (typeof window.openEmojiPicker === 'function') window.openEmojiPicker();
      return;
    }
  });

  // Keyboard shortcuts
  textarea.addEventListener('keydown', (e)=>{
    if (e.ctrlKey || e.metaKey){
      if (e.key.toLowerCase()==='b'){ e.preventDefault(); surroundSelection('**','**'); }
      if (e.key.toLowerCase()==='i'){ e.preventDefault(); surroundSelection('*','*'); }
      if (e.key.toLowerCase()==='k'){ e.preventDefault(); const url = prompt('Bağlantı URL'); if (url) surroundSelection('[',`](${url})`); }
    }
  });
}

// Popover for link/image URL
function setupUrlPopoverForEditor(){
  const pop = document.getElementById('urlPopover');
  const popInput = document.getElementById('urlPopoverInput');
  const popOk = document.getElementById('urlPopoverOk');
  const popCancel = document.getElementById('urlPopoverCancel');
  const popTitle = document.getElementById('urlPopoverTitle');
  const textarea = document.getElementById('postContent');
  if (!pop || !textarea) return;
  let mode = 'link';
  function placeNearToolbar(){
    const toolbar = document.querySelector('[aria-label="Editor toolbar"]');
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    pop.style.left = Math.max(16, rect.left + window.scrollX) + 'px';
    pop.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  }
  function open(type){ mode = type; pop.style.display='block'; placeNearToolbar(); popInput.value=''; popInput.focus(); popTitle.textContent = type==='link' ? 'Bağlantı ekle' : 'Resim ekle'; }
  function close(){ pop.style.display='none'; }
  window.openUrlPopover = open;
  popOk.addEventListener('click', ()=>{
    const url = popInput.value.trim();
    if (!url) { close(); return; }
    if (mode==='link'){
      // surround with [text](url)
      const start = textarea.selectionStart || 0; const end = textarea.selectionEnd || 0;
      const sel = textarea.value.slice(start,end) || 'bağlantı';
      const before = textarea.value.slice(0,start), after = textarea.value.slice(end);
      textarea.value = before + '[' + sel + '](' + url + ')' + after;
    } else {
      const start = textarea.selectionStart || 0; const end = textarea.selectionEnd || 0;
      const sel = textarea.value.slice(start,end) || 'alt';
      const before = textarea.value.slice(0,start), after = textarea.value.slice(end);
      textarea.value = before + '![' + sel + '](' + url + ')' + after;
    }
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
    close();
  });
  popCancel.addEventListener('click', close);
  document.addEventListener('click', (e)=>{ if (!pop.contains(e.target) && !e.target.closest('[data-md-btn="link"], [data-md-btn="image"]')) close(); });
  window.addEventListener('resize', placeNearToolbar);
}

// Draft autosave
function setupDraftAutosave(){
  const form = document.getElementById('newPostForm');
  if (!form) return;
  const title = document.getElementById('postTitle');
  const content = document.getElementById('postContent');
  const category = document.getElementById('postCategory');
  const mediaUrl = document.getElementById('postMediaUrl');
  const linkUrl = document.getElementById('postLinkUrl');
  const KEY = 'draft_newpost_v1';
  // Restore
  try{
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved){
      if (saved.title && title) title.value = saved.title;
      if (saved.content && content) content.value = saved.content;
      if (saved.category && category) category.value = saved.category;
      if (saved.mediaUrl && mediaUrl) mediaUrl.value = saved.mediaUrl;
      if (saved.linkUrl && linkUrl) linkUrl.value = saved.linkUrl;
      content?.dispatchEvent(new Event('input'));
    }
  }catch(_){ }
  function persist(){
    const data = { title: title?.value||'', content: content?.value||'', category: category?.value||'', mediaUrl: mediaUrl?.value||'', linkUrl: linkUrl?.value||'' };
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  ['input','change','keyup'].forEach(evt=>{
    [title,content,category,mediaUrl,linkUrl].forEach(el=>{ if (el) el.addEventListener(evt, persist); });
  });
  form.addEventListener('submit', ()=>{ try{ localStorage.removeItem(KEY); }catch(_){ } });
}

// Mention autocomplete (very simple)
function setupMentionAutocomplete(){
  const textarea = document.getElementById('postContent');
  if (!textarea) return;
  const listEl = document.createElement('div');
  listEl.className = 'card shadow-sm';
  listEl.style.cssText = 'position:absolute; z-index:2000; display:none; width:220px;';
  document.body.appendChild(listEl);
  let candidates = [];
  async function ensureCandidates(){
    if (candidates.length) return;
    try{
      // Basit: son 400 post yazarlarını topla (backend search endpoint'ini kullanalım)
      const r = await fetch(`${BACKEND_BASE}/api/posts/latest`);
      const items = await r.json();
      const names = new Set(); items.forEach(p=>{ if (p.authorName) names.add(p.authorName); });
      candidates = Array.from(names);
    }catch(_){ candidates = []; }
  }
  function placeList(){
    const rect = textarea.getBoundingClientRect();
    listEl.style.left = (rect.left + window.scrollX + 8) + 'px';
    listEl.style.top = (rect.top + window.scrollY + rect.height - 8) + 'px';
  }
  function showList(items){
    if (!items.length){ hideList(); return; }
    listEl.innerHTML = '<div class="list-group list-group-flush">' + items.slice(0,8).map(n=>`<button type="button" class="list-group-item list-group-item-action py-1 px-2">@${n}</button>`).join('') + '</div>';
    placeList();
    listEl.style.display='block';
  }
  function hideList(){ listEl.style.display='none'; }
  textarea.addEventListener('input', async ()=>{
    const val = textarea.value;
    const m = val.slice(0, textarea.selectionStart||0).match(/@([a-zA-Z0-9_]{2,20})$/);
    if (!m){ hideList(); return; }
    await ensureCandidates();
    const q = m[1].toLowerCase();
    const matches = candidates.filter(n=> n.toLowerCase().startsWith(q));
    showList(matches);
  });
  listEl.addEventListener('click', (e)=>{
    const btn = e.target.closest('button.list-group-item');
    if (!btn) return;
    const handle = btn.textContent.replace('@','');
    const pos = textarea.selectionStart||0;
    const before = textarea.value.slice(0,pos).replace(/@([a-zA-Z0-9_]{2,20})$/, '@'+handle);
    const after = textarea.value.slice(pos);
    textarea.value = before + after;
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
    hideList();
  });
  document.addEventListener('click', (e)=>{ if (!listEl.contains(e.target)) hideList(); });
  window.addEventListener('resize', placeList);
}

// Emoji picker
function setupEmojiPicker(){
  const picker = document.getElementById('emojiPicker');
  const grid = document.getElementById('emojiGrid');
  const search = document.getElementById('emojiSearch');
  const textarea = document.getElementById('postContent');
  if (!picker || !grid || !search || !textarea) return;
  // Simple emoji set (can be expanded)
  const EMOJIS = '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😇 🤩 😍 😘 😗 😙 😚 😋 😛 😜 🤪 🤓 😎 🥳 🤠 😏 🤗 🤔 🤨 😐 😑 😶 🙄 😯 😪 😴 🤤 😮‍💨 😌 😍 🙌 👍 👎 👏 🙏 🔥 🎉 💯 ✨ 🎶 🎵 🎧 🥁 🎸 🎹 🎺 🎻 🎤 🎼'.split(' ');
  function render(list){
    grid.innerHTML = list.map(e=>`<button type="button" class="btn btn-sm btn-outline-secondary" data-emoji="${e}">${e}</button>`).join('');
  }
  function place(){
    const toolbar = document.querySelector('[aria-label="Editor toolbar"]');
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    picker.style.left = Math.max(16, rect.left + window.scrollX) + 'px';
    picker.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  }
  function open(){ picker.style.display='block'; place(); search.value=''; render(EMOJIS); search.focus(); }
  function close(){ picker.style.display='none'; }
  window.openEmojiPicker = open;
  grid.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-emoji]'); if (!btn) return;
    const emoji = btn.getAttribute('data-emoji');
    const start = textarea.selectionStart||0; const end = textarea.selectionEnd||0;
    const before = textarea.value.slice(0,start); const after = textarea.value.slice(end);
    textarea.value = before + emoji + after;
    const pos = before.length + emoji.length; textarea.focus(); textarea.setSelectionRange(pos,pos); textarea.dispatchEvent(new Event('input'));
    close();
  });
  search.addEventListener('input', ()=>{
    const q = search.value.trim();
    if (!q){ render(EMOJIS); return; }
    const res = EMOJIS.filter(e=> e.includes(q));
    render(res);
  });
  document.addEventListener('click', (e)=>{ if (!picker.contains(e.target) && !e.target.closest('[data-md-btn="emoji"]')) close(); });
  window.addEventListener('resize', place);
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
        alert('Kayıt başarılı. E-postanızı doğrulamanız için bağlantı gönderildi.');
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
        if (!data.user?.verified){
          // kullanıcıya doğrulama linki isteği opsiyonu sun
          if (confirm('E-postanız doğrulanmamış görünüyor. Doğrulama bağlantısı gönderilsin mi?')){
            try{ await fetch(`${BACKEND_BASE}/api/auth/send-verification`, { method:'POST', headers:{ 'Authorization': `Bearer ${AUTH_TOKEN}` } }); alert('Doğrulama e-postası gönderildi.'); }catch(_){ alert('Gönderilemedi.'); }
          }
        }
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