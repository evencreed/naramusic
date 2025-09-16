# Fix Turkish character encoding issues
$files = @(
    "frontend/index.html",
    "frontend/pages/yenimuzik.html",
    "frontend/pages/album.html"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8
        
        # Fix common Turkish character encoding issues
        $content = $content -replace "MÃ¼zik", "Müzik"
        $content = $content -replace "Nara MÃ¼zik", "Nara Müzik"
        $content = $content -replace "Yeni MÃ¼zik", "Yeni Müzik"
        $content = $content -replace "EndÃ¼stri", "Endüstri"
        $content = $content -replace "DeÄŸerlendirme", "Değerlendirme"
        $content = $content -replace "RÃ¶portaj", "Röportaj"
        $content = $content -replace "Etkinlik", "Etkinlik"
        $content = $content -replace "PopÃ¼ler", "Popüler"
        $content = $content -replace "Son Yorumlar", "Son Yorumlar"
        $content = $content -replace "Kategoriler", "Kategoriler"
        $content = $content -replace "Topluluk", "Topluluk"
        $content = $content -replace "Ãœyeler", "Üyeler"
        $content = $content -replace "katÄ±lÄ±p", "katılıp"
        $content = $content -replace "gÃ¶nderi", "gönderi"
        $content = $content -replace "paylaÅŸabilir", "paylaşabilir"
        $content = $content -replace "GiriÅŸ", "Giriş"
        $content = $content -replace "KayÄ±t", "Kayıt"
        $content = $content -replace "baÅŸlayÄ±n", "başlayın"
        $content = $content -replace "TÃ¼m haklarÄ±", "Tüm hakları"
        $content = $content -replace "saklÄ±dÄ±r", "saklıdır"
        $content = $content -replace "HakkÄ±nda", "Hakkında"
        $content = $content -replace "topluluk odaklÄ±", "topluluk odaklı"
        $content = $content -replace "mÃ¼zik platformudur", "müzik platformudur"
        $content = $content -replace "yeni parÃ§alarÄ±", "yeni parçaları"
        $content = $content -replace "rÃ¶portajlarÄ±", "röportajları"
        $content = $content -replace "etkinlikleri", "etkinlikleri"
        $content = $content -replace "paylaÅŸÄ±r", "paylaşır"
        $content = $content -replace "keÅŸfi", "keşfi"
        $content = $content -replace "kolaylaÅŸtÄ±ran", "kolaylaştıran"
        $content = $content -replace "sade bir arayÃ¼z", "sade bir arayüz"
        $content = $content -replace "sunarÄ±z", "sunarız"
        $content = $content -replace "tartÄ±ÅŸma", "tartışma"
        $content = $content -replace "topluluÄŸu", "topluluğu"
        $content = $content -replace "â€"", "—"
        $content = $content -replace "Â©", "©"
        
        Set-Content $file -Value $content -Encoding UTF8
        Write-Host "Fixed encoding in: $file"
    }
}

Write-Host "Encoding fix completed!"
