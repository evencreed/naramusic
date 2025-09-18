# Nara Müzik (naramusic)

Müzik odaklı topluluk ve içerik platformu:
- Frontend: statik HTML/CSS/JS (Bootstrap 5), şablon bazlı navbar/footer, gelişmiş arama, profil ve etkinlik ekranları
- Backend: Node.js/Express (Firestore/Firebase tarzı veri modeli), Auth, Post/Comment/Like/Bookmark, Playlist/Recommendations, Lyrics, Events, News, Search

## Dizim

```
frontend/           # Statik istemci (Bootstrap, JS modülleri)
  js/
  css/
  pages/
  templates/        # navbar.html, footer.html, modals.html
backend/
  server.js         # Express uygulaması ve tüm API uçları
vercel.json         # Frontend deploy + /api proxy Render’a
```

## Ortam Değişkenleri

Backend’in ihtiyaç duyduğu başlıca env değişkenleri:
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET
- (Opsiyonel) diğer e‑posta/3P servis anahtarları

## Geliştirme (Lokal)

1) Bağımlılıklar
```
npm run install-backend
```

2) Backend’i çalıştır
```
npm run dev
# varsayılan: http://localhost:4000
```

3) Frontend’i aç
- `frontend/index.html`’i tarayıcıda aç
- Frontend, lokal ortamda otomatik `http://localhost:4000` API tabanını kullanır

## Üretim (Vercel + Render)

- Frontend: Vercel Static (frontend dizini)
- Backend: Render (https://naramusic.onrender.com)
- Vercel `/api/*` istekleri render’a proxy edilir (vercel.json routes):
  - `/api/(.*)` → `https://naramusic.onrender.com/api/$1`
- Frontend `app.js` Render tabanını zorunlu kullanır

## Öne Çıkan Özellikler
- Post akışları: sayfalama, popüler, kategori
- Beğeni, kaydetme (bookmark), yorum, paylaşım
- Gelişmiş arama: Spotify/itunes fallback ile parça arama, önizleme
- Profil ve müzik tercihleri: genre/mood, favoriler
- Etkinlikler: filtreler, katılma, oluşturma modali
- Haberler, playlistler, lyrics, öneriler (recommendations) uçları

## Teknik Notlar
- Navbar/footer/modallar `templates/*` ve `app.js` ile tüm sayfalara enjekte edilir; tek kaynak, tutarlı UI
- `app.js` isteklerde timeout/retry ve Render tabanlı base URL kullanır
- Backend CORS: vercel.app ve onrender.com kökenleri açık
- Health endpoint: `GET /api/health` (canlılık, ping)

## Komutlar
```
# Backend
npm run dev          # backend lokal başlat
npm run install-backend

# Frontend
# statik, build gerekmez; vercel deploy alır
```

## Dağıtım Alternatifleri
- Render Free (mevcut): cold start olabilir
- Cloud Run (önerilen): min-instances=1 ile cold start yok; düşük maliyet
- Fly.io (ucuz): küçük VM/container 7/24
- Oracle Always Free (VM): tamamen kalıcı; kurulum operasyonel

## Şu Anki Bilinen Sorunlar / İyileştirme Notları

1) Render Free üzerinde HTTP/2/connection reset dalgalanmaları
- Belirti: `ERR_HTTP2_PROTOCOL_ERROR`, `ERR_CONNECTION_RESET/CLOSED`
- Durum: Backend `/api/health` ok; ancak Free planda soğuk başlatma ve ağ kesintileri görülüyor
- Geçici çözüm: Vercel → Render proxy, frontend’de timeout/retry; UptimeRobot ping’leri kısmen yardımcı olabilir
- Kalıcı çözüm: Render Starter (min instances=1) veya Cloud Run/Fly.io

2) Spotify erişimi olmayan ortamlarda arama sonuçları
- Çözüm: Backend `/api/spotify/search` içinde iTunes fallback eklendi; gerçek sonuç döner

3) Bazı sayfalarda önceki inline navbar/footer kalıntıları
- Çözüm: Şablonlaştırıldı; `app.js` eski nav/footer’ı temizleyip şablonu enjekte ediyor

4) Tema (dark/light) anahtarı
- Çözüm: `app.js` `initThemeToggle()` ile localStorage bazlı geri getirildi

5) Vercel same-origin `/api` çağrıları
- Çözüm: vercel.json ile doğrudan Render proxy; `cache-control: no-store`

## Katkı
- PR’lar hoş geldiniz. Lütfen açıklayıcı commit mesajları ve küçük, odaklı PR’lar gönderin.

## Lisans
- ISC (package.json)
