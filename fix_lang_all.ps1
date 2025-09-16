# PowerShell script to fix all HTML files with lang.js

$translationsScript = @'
  <!-- Language files -->
  <script>
    // Load Turkish translations directly
    window.translations = {
      "home": "Ana Sayfa",
      "about": "Hakkında",
      "contact": "İletişim",
      "welcome": "Bloguma Hoşgeldin",
      "subtitle": "Müzik, sanat ve kültür üzerine",
      "login": "Giriş",
      "register": "Kayıt",
      "logout": "Çıkış",
      "profile": "Profil",
      "newPost": "Yeni Gönderi",
      "search": "Ara...",
      "notifications": "Bildirimler",
      "saved": "Kaydedilenler",
      "mod": "Mod",
      "submit": "Gönder",
      "title": "Başlık",
      "content": "İçerik",
      "category": "Kategori",
      "mediaUrl": "Fotoğraf/GIF URL (opsiyonel)",
      "linkUrl": "Harici Link (opsiyonel)",
      "share": "Paylaş",
      "popular": "En Popüler",
      "latest": "En Son Eklenenler",
      "comments": "Yorumlar",
      "like": "Beğen",
      "bookmark": "Kaydet",
      "report": "Raporla",
      "edit": "Düzenle",
      "delete": "Sil",
      "pin": "Sabitle",
      "lock": "Kilitle",
      "newMusic": "Yeni Müzik",
      "industry": "Endüstri Haberleri",
      "review": "Değerlendirme",
      "album": "Albüm İnceleme",
      "interview": "Röportajlar",
      "event": "Etkinlikler",
      "series": "Dizi & Filmler",
      "loading": "Yükleniyor...",
      "error": "Hata",
      "success": "Başarılı",
      "cancel": "İptal",
      "save": "Kaydet",
      "close": "Kapat",
      "send": "Gönder",
      "name": "Adınız",
      "email": "Email",
      "password": "Parola",
      "username": "Kullanıcı Adı",
      "message": "Mesajınız",
      "writeComment": "Yorum yaz...",
      "noPosts": "Henüz gönderi yok",
      "noComments": "Henüz yorum yok",
      "loadMore": "Daha Fazla",
      "allRightsReserved": "Tüm hakları saklıdır",
      "avatarUrl": "Avatar URL",
      "avatarUrlPlaceholder": "https://... (fotoğraf/gif)",
      "avatarUrlHelp": "URL boş kaydedilirse avatar kaldırılır.",
      "uploadFile": "Veya dosya yükle",
      "upload": "Yükle",
      "myPosts": "Gönderilerim",
      "noPostsYet": "Henüz gönderi yok",
      "createFirstPost": "İlk gönderinizi oluşturun",
      "welcomeMessage": "Nara Müzik'e hoş geldiniz!",
      "profileSettings": "Profil Ayarları",
      "accountInfo": "Hesap Bilgileri",
      "contactMessage": "Bize mesaj bırakın; evencreed hesabının gelen kutusuna düşecek.",
      "popularAlbums": "Popüler Albümler",
      "popularAlbumsDesc": "En çok dinlenen ve tartışılan albümleri keşfedin",
      "addComment": "Ekle",
      "albumSearch": "Albüm Ara",
      "searchAlbum": "Albüm adı yazın...",
      "searchResults": "Arama Sonuçları",
      "myFavorites": "Favori Albümlerim",
      "loadingFavorites": "Favori albümleriniz yükleniyor...",
      "noFavorites": "Henüz favori albümünüz yok.",
      "addFavorites": "Albüm inceleme sayfasından favori albümlerinizi ekleyebilirsiniz."
    };
  </script>
'@

# Get all HTML files
$htmlFiles = Get-ChildItem -Path "frontend" -Recurse -Include "*.html" | Where-Object { $_.Name -notlike "*backup*" }

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Check if file contains lang.js
    if ($content -match 'lang\.js') {
        Write-Host "Fixing $($file.FullName)"
        
        # Different patterns for different file locations
        if ($file.Directory.Name -eq "pages") {
            # Pages directory - uses ../js/lang.js
            $content = $content -replace '<script src="../js/lang.js"[^>]*></script>', "$translationsScript`n  <script src=`"../js/lang.js`"></script>"
        } else {
            # Root directory - uses js/lang.js
            $content = $content -replace '<script src="js/lang.js"[^>]*></script>', "$translationsScript`n  <script src=`"js/lang.js`"></script>"
        }
        
        # Write back the modified content
        $content | Out-File -FilePath $file.FullName -Encoding UTF8
    }
}

Write-Host "All files have been fixed!"
