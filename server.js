require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const sanitizeHtml = require("sanitize-html");
const { marked } = require("marked");
const sgMail = require('@sendgrid/mail');

//
// 1) Firebase Service Account setup
//
let firebaseCred = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Accept raw JSON or base64 encoded JSON
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");

    firebaseCred = JSON.parse(json);

    // private_key newline fix
    if (firebaseCred.private_key) {
      firebaseCred.private_key = firebaseCred.private_key.replace(/\\n/g, "\n");
    }
  } else {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env variable not set!");
  }
} catch (e) {
  console.error("Firebase service account yüklenemedi:", e.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(firebaseCred),
});

const db = admin.firestore();

// SendGrid setup
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Seed super admin (idempotent)
(async function ensureSuperAdmin(){
  try{
    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "merttopacoglu@gmail.com";
    const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || "evencreed";
    if (!SUPER_ADMIN_EMAIL && !SUPER_ADMIN_USERNAME) return;
    const usersCol = db.collection("users");
    let snaps = [];
    if (SUPER_ADMIN_EMAIL){
      const s1 = await usersCol.where("email", "==", SUPER_ADMIN_EMAIL.toLowerCase()).limit(5).get();
      snaps = snaps.concat(s1.docs);
    }
    if (SUPER_ADMIN_USERNAME){
      const s2 = await usersCol.where("username", "==", SUPER_ADMIN_USERNAME).limit(5).get();
      snaps = snaps.concat(s2.docs);
    }
    // de-dup
    const seen = new Set();
    const targets = snaps.filter(d=>{ if (seen.has(d.id)) return false; seen.add(d.id); return true; });
    for (const d of targets){
      try{
        const role = d.data().role || "user";
        if (role !== "superadmin"){
          await usersCol.doc(d.id).update({ role: "superadmin" });
          console.log("[roles] promoted to superadmin:", d.id, d.data().username || d.data().email);
        }
      }catch(err){ console.warn("[roles] promote failed", d.id, err.message); }
    }
  }catch(e){ console.warn("[roles] ensureSuperAdmin warn:", e.message); }
})();

//
// 2) Express setup
//
const app = express();
app.use(cors());
app.use(bodyParser.json());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const writeLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 60 });

// Roles & permissions
const ROLES_ORDER = ["user", "moderator", "admin", "superadmin"];
function roleRank(role){
  const r = String(role||"user").toLowerCase();
  const i = ROLES_ORDER.indexOf(r);
  return i === -1 ? 0 : i;
}
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role || "user";
    if (role === "superadmin") return next();
    if (!roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
function requireMinRole(minRole){
  return (req, res, next) => {
    const cur = req.user?.role || "user";
    if (cur === "superadmin" || roleRank(cur) >= roleRank(minRole)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}
function requireSuperAdmin(req, res, next){
  const role = req.user?.role || "user";
  if (role === "superadmin") return next();
  return res.status(403).json({ error: "Super admin required" });
}

// Content helpers
function makeSlug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
function cleanInputHtml(str) {
  return sanitizeHtml(String(str || ""), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "h4", "h5", "h6"]),
    allowedAttributes: { a: ["href", "name", "target", "rel"], img: ["src", "alt"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
function renderMarkdown(md) {
  const html = marked.parse(String(md || ""));
  return cleanInputHtml(html);
}

//
// 3) JWT helpers
//
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://naramusic.vercel.app";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

//
// 4) Health check
//
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Utility: send verification email
async function sendVerificationEmail(toEmail, link){
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[verify] SENDGRID_API_KEY not set, falling back to console log");
    console.log("[verify] send to:", toEmail, "link:", link);
    return;
  }
  // Debugging logs for email verification
  console.log("[debug] sendVerificationEmail function called");
  console.log("[debug] toEmail:", toEmail);
  console.log("[debug] link:", link);
  try {
    const msg = {
      to: toEmail,
      from: 'noreply@naramuzik.com',
      subject: 'Email Doğrulama - Nara Müzik',
      text: `Merhaba,\n\nHesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:\n${link}\n\nBu bağlantı 7 gün geçerlidir.\n\nNara Müzik`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Merhaba,</p>
        <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
        <p><a href="${link}" style="background:#111;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block">Doğrulama Bağlantısı</a></p>
        <p>Bağlantı çalışmıyorsa bu URL’yi tarayıcınıza yapıştırın:</p>
        <p><a href="${link}">${link}</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
        <p style="color:#666">Bu bağlantı 7 gün geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.</p>
        <p style="color:#666">— Nara Müzik</p>
      </div>`,
    };
    await sgMail.send(msg);
    console.log("[verify] email sent to:", toEmail);
  } catch (error) {
    // Graceful handling: log and continue without throwing to avoid breaking flows
    const msg = (error && (error.message || error.toString())) || "unknown error";
    console.error("[verify] send error:", msg);
  }
}

function generateEmailToken(){
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

//
// 5) Translate Proxy (Google Translate API) with LibreTranslate fallback
//
app.post("/api/translate", async (req, res) => {
  try {
    const { text, texts, target, source } = req.body || {};
    const hasSingle = typeof text === "string" && text.length > 0;
    const hasMany = Array.isArray(texts) && texts.length > 0;
    if ((!hasSingle && !hasMany) || !target) {
      return res.status(400).json({ error: "Missing text(s) or target" });
    }

    const googleKey = process.env.GOOGLE_API_KEY;
    const libreUrl = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com/translate";
    const libreKey = process.env.LIBRETRANSLATE_API_KEY || null;

    async function tryGoogle(){
      if (!googleKey) return null;
      const url = "https://translation.googleapis.com/language/translate/v2";
      const params = new URLSearchParams({ target, format: "text" });
      if (hasSingle) params.append("q", text);
      if (hasMany) { for (const t of texts) { params.append("q", t); } }
      if (source) params.append("source", source);
      params.append("key", googleKey);
      const fetch = (await import("node-fetch")).default;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error?.message || "google translate failed");
      const arr = (data.data?.translations || []).map((x)=> x.translatedText);
      return hasSingle && !hasMany ? { translated: arr[0] || "" } : { translations: arr };
    }

    async function tryLibre(){
      if (!libreUrl) return null;
      const payload = hasSingle && !hasMany
        ? { q: text, source: source || "auto", target }
        : { q: texts, source: source || "auto", target }; // supports array in some instances
      const fetch = (await import("node-fetch")).default;
      const headers = { "Content-Type": "application/json" };
      if (libreKey) headers["Authorization"] = `Bearer ${libreKey}`;
      const r = await fetch(libreUrl, { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.message || "libre translate failed");
      if (Array.isArray(data)) {
        const arr = data.map(x=> x.translatedText || x.translated || "");
        return hasSingle && !hasMany ? { translated: arr[0] || "" } : { translations: arr };
      }
      // single response shape: { translatedText: "..." }
      const single = data.translatedText || data.translated || "";
      return hasSingle && !hasMany ? { translated: single } : { translations: Array.isArray(payload.q) ? (data.translations || []) : [single] };
    }

    // Strategy: Google first if key exists, fallback to Libre; if both missing, passthrough
    try{
      const g = await tryGoogle();
      if (g) return res.json(g);
    }catch(_){ /* fall back */ }
    try{
      const l = await tryLibre();
      if (l) return res.json(l);
    }catch(_){ /* fall back */ }

    // Passthrough fallback
    if (hasSingle && !hasMany) return res.json({ translated: text });
    return res.json({ translations: texts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 5.1) Spotify Client Credentials + Playlist fetch
//
let cachedSpotifyToken = null;
let cachedSpotifyTokenExpiresAt = 0;

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID/SECRET envs");
  }
  const now = Date.now();
  if (cachedSpotifyToken && now < cachedSpotifyTokenExpiresAt - 5000) {
    return cachedSpotifyToken;
  }
  const fetch = (await import("node-fetch")).default;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(data.error_description || "spotify token failed");
  }
  cachedSpotifyToken = data.access_token;
  cachedSpotifyTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedSpotifyToken;
}

app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const input = req.query.playlistId || req.query.playlist; // support both id and full url
    if (!input) return res.status(400).json({ error: "Missing playlistId or playlist" });
    // Extract ID from full URL if needed
    let playlistId = String(input).trim();
    const m = playlistId.match(/playlist\/(.*?)($|\?|#)/);
    if (m && m[1]) playlistId = m[1];
    const token = await getSpotifyAccessToken();
    const fetch = (await import("node-fetch")).default;
    const r = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error?.message || data.message || "spotify error", status: r.status, details: data });
    }
    // minimize payload: map essential fields
    const simplified = {
      id: data.id,
      name: data.name,
      description: data.description,
      images: data.images,
      external_urls: data.external_urls,
      tracks: (data.tracks?.items || []).map((it) => {
        const t = it.track || {};
        return {
          id: t.id,
          name: t.name,
          preview_url: t.preview_url,
          external_urls: t.external_urls,
          duration_ms: t.duration_ms,
          artists: (t.artists || []).map((a) => ({ id: a.id, name: a.name, external_urls: a.external_urls })),
          album: t.album
            ? {
                id: t.album.id,
                name: t.album.name,
                images: t.album.images,
                release_date: t.album.release_date,
              }
            : null,
        };
      }),
    };
    res.json(simplified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 5.2) Spotify Artist and Album detail endpoints
app.get("/api/spotify/artist", async (req, res) => {
  try {
    const input = req.query.id || req.query.artist; // support id or full url
    if (!input) return res.status(400).json({ error: "Missing id or artist" });

    // Extract ID from full URL or spotify: uri if needed
    let artistId = String(input).trim();
    const m1 = artistId.match(/artist\/(.*?)(?:$|[/?#])/);
    const m2 = artistId.match(/spotify:artist:([a-zA-Z0-9]+)/);
    if (m1 && m1[1]) artistId = m1[1];
    else if (m2 && m2[1]) artistId = m2[1];

    const token = await getSpotifyAccessToken();
    const fetch = (await import("node-fetch")).default;
    const baseHeaders = { Authorization: `Bearer ${token}` };

    // Artist profile
    const rArtist = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`, {
      headers: baseHeaders,
    });
    const artist = await rArtist.json();
    if (!rArtist.ok) {
      return res
        .status(rArtist.status)
        .json({ error: artist.error?.message || artist.message || "spotify error", status: rArtist.status, details: artist });
    }

    // Top tracks — try TR first, fallback to US if TR fails
    let rTop = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/top-tracks?market=TR`, {
      headers: baseHeaders,
    });
    if (!rTop.ok) {
      rTop = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/top-tracks?market=US`, {
        headers: baseHeaders,
      });
    }
    const top = await rTop.json();
    if (!rTop.ok) {
      return res
        .status(rTop.status)
        .json({ error: top.error?.message || top.message || "spotify error", status: rTop.status, details: top });
    }

    // Albums (albums + singles)
    const rAlbums = await fetch(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/albums?include_groups=album,single&limit=20`,
      { headers: baseHeaders }
    );
    const albumsData = await rAlbums.json();
    if (!rAlbums.ok) {
      return res
        .status(rAlbums.status)
        .json({ error: albumsData.error?.message || albumsData.message || "spotify error", status: rAlbums.status, details: albumsData });
    }

    // Minimized JSON payload
    const simplified = {
      id: artist.id,
      name: artist.name,
      images: artist.images,
      followers: artist.followers?.total,
      genres: artist.genres,
      external_urls: artist.external_urls,
      topTracks: Array.isArray(top.tracks)
        ? top.tracks.map((t) => ({
            id: t.id,
            name: t.name,
            preview_url: t.preview_url,
            external_urls: t.external_urls,
            duration_ms: t.duration_ms,
            album: t.album
              ? {
                  id: t.album.id,
                  name: t.album.name,
                  images: t.album.images,
                  release_date: t.album.release_date,
                }
              : null,
          }))
        : [],
      albums: Array.isArray(albumsData.items)
        ? albumsData.items.map((a) => ({
            id: a.id,
            name: a.name,
            images: a.images,
            release_date: a.release_date,
            total_tracks: a.total_tracks,
            external_urls: a.external_urls,
          }))
        : [],
    };

    res.json(simplified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/spotify/album", async (req, res) => {
  try {
    const input = req.query.id || req.query.album; // support id or full url
    if (!input) return res.status(400).json({ error: "Missing id or album" });

    // Extract ID from full URL or spotify: uri if needed
    let albumId = String(input).trim();
    const m1 = albumId.match(/album\/(.*?)(?:$|[/?#])/);
    const m2 = albumId.match(/spotify:album:([a-zA-Z0-9]+)/);
    if (m1 && m1[1]) albumId = m1[1];
    else if (m2 && m2[1]) albumId = m2[1];

    const token = await getSpotifyAccessToken();
    const fetch = (await import("node-fetch")).default;
    const r = await fetch(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: data.error?.message || data.message || "spotify error", status: r.status, details: data });
    }

    const simplified = {
      id: data.id,
      name: data.name,
      images: data.images,
      release_date: data.release_date,
      total_tracks: data.total_tracks,
      external_urls: data.external_urls,
      artists: (data.artists || []).map((a) => ({
        id: a.id,
        name: a.name,
        external_urls: a.external_urls,
      })),
      tracks: (data.tracks?.items || []).map((t) => ({
        id: t.id,
        name: t.name,
        preview_url: t.preview_url,
        duration_ms: t.duration_ms,
        external_urls: t.external_urls,
        track_number: t.track_number,
      })),
    };

    res.json(simplified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 6) Auth endpoints
//
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Eksik alanlar" });
    }

    // Şifre uzunluğu kontrolü
    if (password.length < 6) {
      return res.status(400).json({ error: "Şifre en az 6 karakter olmalıdır" });
    }

    // Kullanıcı adı benzersizliği kontrolü
    const usersCol = db.collection("users");
    const usernameCheck = await usersCol.where("username", "==", username).limit(1).get();
    if (!usernameCheck.empty) {
      return res.status(400).json({ error: "Kullanıcı adı zaten alınmış" });
    }

    const rawEmail = String(email).trim();
    const normEmail = rawEmail.toLowerCase();

    // check duplicates by both original and normalized email (backward compatibility)
    let existing = await usersCol.where("email", "==", rawEmail).limit(1).get();
    if (existing.empty) {
      existing = await usersCol.where("email", "==", normEmail).limit(1).get();
    }
    if (!existing.empty)
      return res.status(400).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const verifyToken = generateEmailToken();
    const userDoc = await usersCol.add({
      username,
      email: normEmail,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      avatarUrl: null,
      role: "user",
      verified: false,
      verifyToken,
    });

    const user = { id: userDoc.id, username, email: normEmail, avatarUrl: null, role: "user", verified: false };
    const token = signToken(user);

    // send verification email (stub)
    const link = `${APP_BASE_URL}/pages/verify.html?uid=${encodeURIComponent(userDoc.id)}&token=${encodeURIComponent(verifyToken)}`;
    await sendVerificationEmail(normEmail, link);

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Giriş sırasında kullanıcı doğrulama
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Eksik alanlar" });
    }

    // Kullanıcı bulunamazsa hata mesajı
    const usersCol = db.collection("users");
    const snapshot = await usersCol.where("email", "==", email.toLowerCase()).limit(1).get();
    if (snapshot.empty) {
      return res.status(400).json({ error: "Geçersiz giriş bilgileri" });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const ok = await bcrypt.compare(password, data.passwordHash || "");
    if (!ok) return res.status(400).json({ error: "Geçersiz giriş bilgileri" });

    const user = { id: doc.id, username: data.username, email: data.email, avatarUrl: data.avatarUrl || null, role: data.role || "user", verified: !!data.verified };
    const token = signToken(user);

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request email verification link
app.post("/api/auth/send-verification", authMiddleware, async (req, res) => {
  try{
    const uref = db.collection("users").doc(req.user.id);
    const u = await uref.get();
    if (!u.exists) return res.status(404).json({ error: "User not found"});
    const data = u.data();
    if (data.verified) return res.json({ ok:true, already:true });
    const token = generateEmailToken();
    await uref.update({ verifyToken: token });
    const link = `${APP_BASE_URL}/pages/verify.html?uid=${encodeURIComponent(uref.id)}&token=${encodeURIComponent(token)}`;
    await sendVerificationEmail(data.email, link);
    res.json({ ok:true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Verify endpoint (called by verify page)
app.post("/api/auth/verify", async (req, res) => {
  try{
    const { uid, token } = req.body || {};
    if (!uid || !token) return res.status(400).json({ error: "Missing fields" });
    const uref = db.collection("users").doc(uid);
    const u = await uref.get();
    if (!u.exists) return res.status(404).json({ error: "User not found"});
    const data = u.data();
    if (data.verified) return res.json({ ok:true, already:true });
    if (!data.verifyToken || data.verifyToken !== token) return res.status(400).json({ error: "Invalid token" });
    await uref.update({ verified: true, verifyToken: admin.firestore.FieldValue.delete() });
    res.json({ ok:true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Password reset: set a new password by email (no email send; simple flow)
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body || {};
    if (!email || !newPassword) return res.status(400).json({ error: "Missing fields" });

    const usersCol = db.collection("users");
    const rawEmail = String(email).trim();
    const normEmail = rawEmail.toLowerCase();
    let snapshot = await usersCol.where("email", "==", rawEmail).limit(1).get();
    if (snapshot.empty) {
      snapshot = await usersCol.where("email", "==", normEmail).limit(1).get();
    }
    if (snapshot.empty) return res.status(404).json({ error: "User not found" });

    const doc = snapshot.docs[0];
    const hash = await bcrypt.hash(newPassword, 10);
    await usersCol.doc(doc.id).update({ passwordHash: hash });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 7) Contact form -> routes to "evencreed"
//
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const inbox = db.collection("messages");
    const payload = {
      toUsername: "evencreed",
      fromName: name,
      fromEmail: email,
      message,
      createdAt: new Date().toISOString(),
    };
    await inbox.add(payload);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/messages/inbox", authMiddleware, async (req, res) => {
  try {
    const { username } = req.user;
    const q = await db
      .collection("messages")
      .where("toUsername", "==", username)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const items = q.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 8) Posts
//
app.post("/api/posts", authMiddleware, writeLimiter, async (req, res) => {
  try {
    const { title, content, category, mediaUrl, linkUrl, tags } = req.body;
    const { id: authorId, username: authorName, avatarUrl: authorAvatar } = req.user;

    const safeContent = String(content || "");
    const slug = makeSlug(title) + "-" + Math.random().toString(36).slice(2, 7);

    // Türkçe ve İngilizce çeviriler
    const content_tr = await translateText(safeContent, "tr");
    const content_en = await translateText(safeContent, "en");

    const newPost = {
      title,
      slug,
      content: safeContent,
      content_tr,
      content_en,
      category,
      authorId,
      authorName,
      authorAvatar: authorAvatar || null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      likes: 0,
      likedBy: [],
      views: 0,
      comments: 0,
      mediaUrl: mediaUrl || null,
      linkUrl: linkUrl || null,
      tags: Array.isArray(tags) ? tags.slice(0, 10).map((t) => String(t).toLowerCase()) : [],
      pinned: false,
      locked: false,
      reports: 0,
    };

    const docRef = await db.collection("posts").add(newPost);
    res.json({ id: docRef.id, ...newPost });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/posts/popular", async (req, res) => {
  try {
    const snapshot = await db
      .collection("posts")
      .orderBy("views", "desc")
      .limit(5)
      .get();
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/posts/latest", async (req, res) => {
  try {
    const snapshot = await db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single post by id
app.get("/api/posts/:id", async (req, res) => {
  try {
    const doc = await db.collection("posts").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Post not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Poll-only fetch
app.get("/api/posts/:id/poll", async (req, res) => {
  try {
    const ref = db.collection("posts").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "post not found" });
    const data = doc.data();
    if (!data || !data.poll) return res.status(404).json({ error: "poll not found" });
    return res.json(data.poll);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Voted status helper
app.get("/api/polls/voted", authMiddleware, async (req, res) => {
  try {
    const postId = String(req.query.postId || "").trim();
    if (!postId) return res.status(400).json({ error: "missing postId" });
    const voteRef = db.collection("posts").doc(postId).collection("pollVotes").doc(req.user.id);
    const voteDoc = await voteRef.get();
    if (!voteDoc.exists) return res.json({ voted: false });
    const vd = voteDoc.data() || {};
    return res.json({ voted: true, optionId: vd.optionId || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Vote endpoint
app.post("/api/polls/vote", authMiddleware, writeLimiter, async (req, res) => {
  try {
    const { postId, optionId } = req.body || {};
    if (!postId || !optionId) {
      return res.status(400).json({ error: "missing postId/optionId" });
    }
    const ref = db.collection("posts").doc(String(postId));
    const baseDoc = await ref.get();
    if (!baseDoc.exists) return res.status(404).json({ error: "post not found" });
    const baseData = baseDoc.data();
    if (!baseData || !baseData.poll) return res.status(404).json({ error: "poll not found" });

    // poll closed?
    const poll0 = baseData.poll;
    if (poll0 && poll0.closesAt) {
      const d = new Date(poll0.closesAt);
      if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) {
        return res.status(410).json({ error: "poll closed" });
      }
    }

    // option exists?
    const validOpt = Array.isArray(poll0.options) ? poll0.options.find((o) => String(o.id) === String(optionId)) : null;
    if (!validOpt) return res.status(400).json({ error: "invalid optionId" });

    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error("NOT_FOUND");
        const data = doc.data() || {};
        const poll = data.poll;
        if (!poll) throw new Error("NO_POLL");

        // closed re-check inside tx
        if (poll.closesAt) {
          const d = new Date(poll.closesAt);
          if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) {
            throw new Error("POLL_CLOSED");
          }
        }

        const voteRef = ref.collection("pollVotes").doc(req.user.id);
        const voteDoc = await tx.get(voteRef);
        if (voteDoc.exists) throw new Error("ALREADY_VOTED");

        // increment chosen option + total
        const opts = Array.isArray(poll.options) ? poll.options.slice() : [];
        const idx = opts.findIndex((o) => String(o.id) === String(optionId));
        if (idx === -1) throw new Error("INVALID_OPTION");
        const updatedOpt = { ...opts[idx], votes: Number(opts[idx].votes || 0) + 1 };
        opts[idx] = updatedOpt;
        const updatedPoll = {
          ...poll,
          options: opts,
          totalVotes: Number(poll.totalVotes || 0) + 1,
        };

        tx.update(ref, { poll: updatedPoll });
        tx.set(voteRef, { userId: req.user.id, optionId: String(optionId), createdAt: new Date().toISOString() });
      });
    } catch (e) {
      const msg = (e && e.message) || "";
      if (msg === "ALREADY_VOTED") return res.status(400).json({ error: "already voted" });
      if (msg === "POLL_CLOSED") return res.status(410).json({ error: "poll closed" });
      if (msg === "INVALID_OPTION") return res.status(400).json({ error: "invalid optionId" });
      if (msg === "NO_POLL" || msg === "NOT_FOUND") return res.status(404).json({ error: "post/poll not found" });
      return res.status(500).json({ error: "internal error" });
    }

    // Return updated poll
    const after = await ref.get();
    const out = after.data();
    return res.json(out.poll || null);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Increment view count
app.post("/api/posts/:id/view", async (req, res) => {
  try {
    const id = req.params.id;
    const ref = db.collection("posts").doc(id);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error("Post not found");
      const views = Number(doc.data().views || 0) + 1;
      tx.update(ref, { views });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit post (owner or moderator/admin)
app.put("/api/posts/:id", authMiddleware, writeLimiter, async (req, res) => {
  try {
    const ref = db.collection("posts").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Post not found" });
    const p = snap.data();
    const role = req.user.role || "user";
    const isOwner = p.authorId === req.user.id;
    if (!(isOwner || role === "admin" || role === "moderator")) return res.status(403).json({ error: "Forbidden" });

    const { title, content, category, mediaUrl, linkUrl, tags } = req.body || {};
    const update = {};
    if (typeof title === "string" && title.trim()) {
      update.title = title.trim();
      if (p.slug) update.slug = makeSlug(title) + "-" + p.slug.split("-").pop();
    }
    if (typeof content === "string") {
      update.content = content;
      update.contentHtml = renderMarkdown(content);
    }
    if (typeof category === "string") update.category = category;
    if (typeof mediaUrl !== "undefined") update.mediaUrl = mediaUrl || null;
    if (typeof linkUrl !== "undefined") update.linkUrl = linkUrl || null;
    if (Array.isArray(tags)) update.tags = tags.slice(0, 10).map((t) => String(t).toLowerCase());
    update.updatedAt = new Date().toISOString();

    await ref.update(update);
    const nd = (await ref.get()).data();
    res.json({ id: ref.id, ...nd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete post (owner or moderator/admin)
app.delete("/api/posts/:id", authMiddleware, async (req, res) => {
  try {
    const ref = db.collection("posts").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Post not found" });
    const p = snap.data();
    const role = req.user.role || "user";
    const isOwner = p.authorId === req.user.id;
    if (!(isOwner || role === "admin" || role === "moderator")) return res.status(403).json({ error: "Forbidden" });

    const comms = await ref.collection("comments").get();
    const batch = db.batch();
    comms.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post like toggle
app.post("/api/posts/:id/like", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const ref = db.collection("posts").doc(req.params.id);
    await db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) throw new Error("Post not found");
      const likedBy = new Set(d.data().likedBy || []);
      if (likedBy.has(userId)) likedBy.delete(userId);
      else likedBy.add(userId);
      tx.update(ref, { likedBy: Array.from(likedBy), likes: Array.from(likedBy).length });
    });
    const out = await ref.get();
    res.json({ likes: out.data().likes, liked: (out.data().likedBy || []).includes(userId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pin/lock (admin/moderator)
app.post("/api/posts/:id/pin", authMiddleware, requireRole("admin", "moderator"), async (req, res) => {
  await db.collection("posts").doc(req.params.id).update({ pinned: !!req.body.pinned });
  res.json({ ok: true });
});
app.post("/api/posts/:id/lock", authMiddleware, requireRole("admin", "moderator"), async (req, res) => {
  await db.collection("posts").doc(req.params.id).update({ locked: !!req.body.locked });
  res.json({ ok: true });
});

// Get by slug
app.get("/api/posts/by-slug/:slug", async (req, res) => {
  const q = await db.collection("posts").where("slug", "==", req.params.slug).limit(1).get();
  if (q.empty) return res.status(404).json({ error: "Not found" });
  const d = q.docs[0];
  res.json({ id: d.id, ...d.data() });
});

// Search
app.get("/api/search", async (req, res) => {
  try {
    const qRaw = String(req.query.q || "");
    const q = qRaw.toLowerCase().trim();

    const category = typeof req.query.category === "string" ? String(req.query.category).trim().toLowerCase() : "";
    const tagsParam = typeof req.query.tags === "string"
      ? String(req.query.tags)
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const fromRaw = req.query.from ? String(req.query.from).trim() : "";
    const toRaw = req.query.to ? String(req.query.to).trim() : "";

    const sort = req.query.sort === "views" ? "views" : "created";
    const order = req.query.order === "asc" ? "asc" : "desc";

    let limit = parseInt(req.query.limit || "50", 10);
    if (isNaN(limit) || limit <= 0) limit = 50;
    if (limit > 100) limit = 100;

    // Validate dates
    let fromDate = null;
    let toDate = null;
    if (fromRaw) {
      const d = new Date(fromRaw);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'from' date" });
      fromDate = d;
    }
    if (toRaw) {
      const d = new Date(toRaw);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'to' date" });
      toDate = d;
    }

    // Backward-compat: if absolutely no filters provided (including q), return empty array
    const noFilters =
      !q &&
      !category &&
      (!tagsParam || tagsParam.length === 0) &&
      !fromDate &&
      !toDate;

    if (noFilters) {
      return res.json([]);
    }

    // Keep Firestore simple: fetch recent posts and filter in memory
    const snap = await db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(400)
      .get();
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Apply filters
    items = items.filter((p) => {
      // Category
      if (category && String(p.category || "").toLowerCase() !== category) return false;

      // Tags (AND match, case-insensitive)
      if (tagsParam.length) {
        const postTags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
        for (const t of tagsParam) {
          if (!postTags.includes(t)) return false;
        }
      }

      // Date range inclusive (based on createdAt)
      if (fromDate || toDate) {
        const ts = new Date(p.createdAt || 0).getTime();
        if (fromDate && ts < fromDate.getTime()) return false;
        if (toDate && ts > toDate.getTime()) return false;
      }

      // Text query (title/content/tags substring, case-insensitive)
      if (q) {
        const title = String(p.title || "").toLowerCase();
        const content = String(p.content || "").toLowerCase();
        const tagsLc = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
        const hit = title.includes(q) || content.includes(q) || tagsLc.some((t) => t.includes(q));
        if (!hit) return false;
      }

      return true;
    });

    // Sort with pinned-first preference
    items.sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap; // pinned first globally

      let av, bv;
      if (sort === "views") {
        av = Number(a.views || 0);
        bv = Number(b.views || 0);
      } else {
        av = new Date(a.createdAt || 0).getTime();
        bv = new Date(b.createdAt || 0).getTime();
      }

      if (av === bv) {
        // stable tiebreaker by createdAt desc
        const at = new Date(a.createdAt || 0).getTime();
        const bt = new Date(b.createdAt || 0).getTime();
        return bt - at;
      }
      return order === "asc" ? av - bv : bv - av;
    });

    // Apply limit
    res.json(items.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pagination
app.get("/api/posts", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "10", 10), 30);
  const after = req.query.after; // ISO date
  let query = db.collection("posts").orderBy("createdAt", "desc").limit(limit);
  if (after) query = query.startAfter(after);
  const snap = await query.get();
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  res.json({ items: posts, nextAfter: posts.length ? posts[posts.length - 1].createdAt : null });
});

// Comments
app.get("/api/posts/:id/comments", async (req, res) => {
  try {
    const snapshot = await db
      .collection("posts")
      .doc(req.params.id)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .limit(200)
      .get();
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/posts/:id/comments", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || String(text).trim().length === 0) {
      return res.status(400).json({ error: "Missing text" });
    }
    const postRef = db.collection("posts").doc(req.params.id);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return res.status(404).json({ error: "Post not found" });
    if (postSnap.data().locked) return res.status(403).json({ error: "Post locked" });
    const { id: userId, username } = req.user;
    const payload = {
      userId,
      username,
      text: String(text).trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
    };
    const ref = await postRef.collection("comments").add(payload);
    await postRef.update({ comments: admin.firestore.FieldValue.increment(1) });

    // Mentions notifications
    const mentions = Array.from(new Set(String(text).match(/@([a-zA-Z0-9_]+)/g) || [])).map((m) => m.slice(1));
    for (const m of mentions) {
      const uq = await db.collection("users").where("username", "==", m).limit(1).get();
      if (!uq.empty) {
        await db.collection("notifications").add({
          toUserId: uq.docs[0].id,
          type: "mention",
          postId: postRef.id,
          commentId: ref.id,
          fromUser: username,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }
    res.json({ id: ref.id, ...payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit comment
app.put("/api/posts/:postId/comments/:cid", authMiddleware, async (req, res) => {
  try {
    const ref = db.collection("posts").doc(req.params.postId).collection("comments").doc(req.params.cid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });
    const c = snap.data();
    const role = req.user.role || "user";
    const isOwner = c.userId === req.user.id;
    if (!(isOwner || role === "admin" || role === "moderator")) return res.status(403).json({ error: "Forbidden" });
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });
    await ref.update({ text, updatedAt: new Date().toISOString() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete comment
app.delete("/api/posts/:postId/comments/:cid", authMiddleware, async (req, res) => {
  try {
    const postRef = db.collection("posts").doc(req.params.postId);
    const ref = postRef.collection("comments").doc(req.params.cid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });
    const c = snap.data();
    const role = req.user.role || "user";
    const isOwner = c.userId === req.user.id;
    if (!(isOwner || role === "admin" || role === "moderator")) return res.status(403).json({ error: "Forbidden" });
    await ref.delete();
    await postRef.update({ comments: admin.firestore.FieldValue.increment(-1) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Like comment
app.post("/api/posts/:postId/comments/:cid/like", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const ref = db.collection("posts").doc(req.params.postId).collection("comments").doc(req.params.cid);
    await db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) throw new Error("Not found");
      const likedBy = new Set(d.data().likedBy || []);
      if (likedBy.has(userId)) likedBy.delete(userId);
      else likedBy.add(userId);
      tx.update(ref, { likedBy: Array.from(likedBy), likes: Array.from(likedBy).length });
    });
    const out = await ref.get();
    res.json({ likes: out.data().likes, liked: (out.data().likedBy || []).includes(userId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report content
app.post("/api/report", authMiddleware, async (req, res) => {
  const { type, postId, commentId, reason } = req.body || {};
  if (!["post", "comment"].includes(type)) return res.status(400).json({ error: "Invalid type" });
  await db.collection("reports").add({
    type,
    postId: postId || null,
    commentId: commentId || null,
    reason: String(reason || "").slice(0, 200),
    createdAt: new Date().toISOString(),
    reporterId: req.user.id,
    seen: false,
    status: "open",
  });
  if (type === "post" && postId) {
    await db.collection("posts").doc(postId).update({ reports: admin.firestore.FieldValue.increment(1) });
  }
  res.json({ ok: true });
});

// Moderation: list reports
app.get("/api/mod/reports", authMiddleware, requireRole("admin", "moderator"), async (req, res) => {
  const snap = await db.collection("reports").orderBy("createdAt", "desc").limit(200).get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

// Moderation: update report state
app.post("/api/mod/reports/:id/seen", authMiddleware, requireRole("admin", "moderator"), async (req, res) => {
  await db.collection("reports").doc(req.params.id).update({ seen: true });
  res.json({ ok: true });
});
app.post("/api/mod/reports/:id/resolve", authMiddleware, requireRole("admin", "moderator"), async (req, res) => {
  try {
    const reportId = req.params.id;
    const reportRef = db.collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
      return res.status(404).json({ error: "Rapor bulunamadı" });
    }
    await reportRef.update({
      status: "resolved",
      resolvedAt: new Date().toISOString(),
      resolvedBy: req.user.id,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications
app.get("/api/notifications", authMiddleware, async (req, res) => {
  const q = await db
    .collection("notifications")
    .where("toUserId", "==", req.user.id)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  res.json(q.docs.map((d) => ({ id: d.id, ...d.data() })));
});
app.post("/api/notifications/:id/read", authMiddleware, async (req, res) => {
  await db.collection("notifications").doc(req.params.id).update({ read: true });
  res.json({ ok: true });
});

// Bildirimler için okundu olarak işaretleme uç noktası
app.post("/api/notifications/mark-all-read", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const snapshot = await db
      .collection("notifications")
      .where("toUserId", "==", userId)
      .where("read", "==", false)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: user listing and role management (superadmin only)
app.get("/api/admin/users", authMiddleware, requireSuperAdmin, async (req, res) => {
  try{
    const q = String(req.query.q || "").trim().toLowerCase();
    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(300).get();
    let items = snap.docs.map(d=>({ id:d.id, username:d.data().username, email:d.data().email, role:d.data().role||"user", createdAt:d.data().createdAt, verified:!!d.data().verified }));
    if (q){ items = items.filter(u=> (u.username||"").toLowerCase().includes(q) || (u.email||"").toLowerCase().includes(q)); }
    res.json(items);
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post("/api/admin/users/:id/role", authMiddleware, requireSuperAdmin, async (req, res) => {
  try{
    const targetId = req.params.id;
    const nextRole = String((req.body||{}).role || '').toLowerCase();
    if (!ROLES_ORDER.includes(nextRole)) return res.status(400).json({ error: "Invalid role" });
    if (nextRole !== 'superadmin'){
      const qs = await db.collection('users').where('role','==','superadmin').limit(2).get();
      if (qs.empty) return res.status(400).json({ error: 'No superadmin exists' });
      if (qs.size === 1 && qs.docs[0].id === targetId) return res.status(400).json({ error: 'Cannot demote the last superadmin' });
    }
    await db.collection('users').doc(targetId).update({ role: nextRole });
    res.json({ ok:true, id: targetId, role: nextRole });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Bookmarks: toggle and list
app.post("/api/posts/:id/bookmark", authMiddleware, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.user.id);
    await db.runTransaction(async (tx) => {
      const u = await tx.get(userRef);
      if (!u.exists) throw new Error("User not found");
      const cur = new Set(u.data().bookmarks || []);
      if (cur.has(req.params.id)) cur.delete(req.params.id); else cur.add(req.params.id);
      tx.update(userRef, { bookmarks: Array.from(cur) });
    });
    const u2 = await userRef.get();
    res.json({ bookmarks: u2.data().bookmarks || [], bookmarked: (u2.data().bookmarks || []).includes(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/me/bookmarks", authMiddleware, async (req, res) => {
  try {
    const u = await db.collection("users").doc(req.user.id).get();
    const ids = u.exists ? (u.data().bookmarks || []) : [];
    if (!ids.length) return res.json([]);
    // Firestore doesn't support IN with too many items; cap to 30 for safety
    const chunk = ids.slice(0, 30);
    const snaps = await Promise.all(chunk.map((id) => db.collection("posts").doc(id).get()));
    const items = snaps.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/posts/category/:cat", async (req, res) => {
  try {
    const snapshot = await db.collection("posts").where("category", "==", req.params.cat).get();
    let posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    posts.sort((a,b)=>{
      const ap = a.pinned?1:0, bp = b.pinned?1:0;
      if (ap!==bp) return bp-ap; // pinned first
      const at = new Date(a.createdAt||0).getTime();
      const bt = new Date(b.createdAt||0).getTime();
      return bt-at; // then newest
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/:authorId/posts", async (req, res) => {
  try {
    const snapshot = await db
      .collection("posts")
      .where("authorId", "==", req.params.authorId)
      .orderBy("createdAt", "desc")
      .get();
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Basic user fetch
app.get("/api/users/:id", async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found" });
    const d = doc.data();
    res.json({ id: doc.id, username: d.username, email: d.email, avatarUrl: d.avatarUrl || null, createdAt: d.createdAt, role: d.role || "user" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update own profile (avatarUrl, username optional)
app.put("/api/users/me", authMiddleware, async (req, res) => {
  try {
    const { avatarUrl, username } = req.body || {};
    const update = {};
    if (typeof avatarUrl !== "undefined") update.avatarUrl = avatarUrl || null;
    if (typeof username === "string" && username.trim()) update.username = username.trim();
    if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to update" });
    await db.collection("users").doc(req.user.id).update(update);
    const doc = await db.collection("users").doc(req.user.id).get();
    const d = doc.data();
    const user = { id: doc.id, username: d.username, email: d.email, avatarUrl: d.avatarUrl || null };
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı profili için yeni alanlar ekleniyor
app.put("/api/users/me/profile", authMiddleware, async (req, res) => {
  try {
    const { bio, favoriteGenres, playlists } = req.body || {};
    const update = {};
    if (typeof bio === "string") update.bio = bio.trim();
    if (Array.isArray(favoriteGenres)) update.favoriteGenres = favoriteGenres.slice(0, 5);
    if (Array.isArray(playlists)) update.playlists = playlists.slice(0, 5);
    if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to update" });
    await db.collection("users").doc(req.user.id).update(update);
    const doc = await db.collection("users").doc(req.user.id).get();
    res.json({ profile: doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple avatar upload (base64 to Firebase Storage emulation via Firestore hosting is out of scope)
// We store as data URL in user doc for simplicity; consider real object storage in production
app.post("/api/users/me/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Missing file" });
    const mime = req.file.mimetype || "image/jpeg";
    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;
    await db.collection("users").doc(req.user.id).update({ avatarUrl: dataUrl });
    res.json({ avatarUrl: dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Admin Analytics
 * GET /api/admin/analytics
 * Guards: admin or superadmin (requireMinRole("admin"))
 * Query params:
 *  - rangeDays: integer, default 7, min 1, max 60
 *  - topLimit: integer, default 10, max 30
 *
 * Implementation strategy:
 *  - Fetch recent documents with orderBy("createdAt","desc") and limit(500)
 *  - Derive stats in memory (consistent with /api/search)
 *  - Parse createdAt as ISO date; skip invalid
 */
app.get("/api/admin/analytics", authMiddleware, requireMinRole("admin"), async (req, res) => {
  try {
    let rangeDays = parseInt(String(req.query.rangeDays || "7"), 10);
    let topLimit = parseInt(String(req.query.topLimit || "10"), 10);
    if (isNaN(rangeDays)) rangeDays = 7;
    if (isNaN(topLimit)) topLimit = 10;
    if (rangeDays < 1 || rangeDays > 60 || topLimit < 1 || topLimit > 30) {
      return res.status(400).json({ error: "Invalid parameter" });
    }

    const MAX_SCAN = 500;

    // Build YYYY-MM-DD keys for the last N days (inclusive of today)
    const dayKeys = [];
    const daySet = new Set();
    const today = new Date();
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      daySet.add(key);
    }

    const totals = { users: 0, posts: 0, comments: 0, reportsOpen: 0, reportsResolved: 0 };
    const perCategory = {};

    // Posts: recent slice for derived stats
    const postsSnap = await db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(MAX_SCAN)
      .get();

    totals.posts = postsSnap.size;
    const posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // comments sum + per-category counts
    for (const p of posts) {
      totals.comments += Number(p.comments || 0);
      const cat = String(p.category || "other");
      perCategory[cat] = (perCategory[cat] || 0) + 1;
    }

    // Top posts by views (from the scanned window)
    const topPostsByViews = posts
      .slice()
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, topLimit)
      .map((p) => ({
        id: p.id,
        title: p.title || "",
        views: Number(p.views || 0),
        likes: Number(p.likes || 0),
        createdAt: p.createdAt || null,
        category: p.category || null,
      }));

    // Recent posts (already ordered by createdAt desc)
    const recentPosts = posts.slice(0, topLimit).map((p) => ({
      id: p.id,
      title: p.title || "",
      views: Number(p.views || 0),
      likes: Number(p.likes || 0),
      createdAt: p.createdAt || null,
      category: p.category || null,
    }));

    // Time series: posts per day
    const postsPerDayMap = {};
    dayKeys.forEach((k) => (postsPerDayMap[k] = 0));
    for (const p of posts) {
      const t = new Date(p.createdAt || 0);
      if (isNaN(t.getTime())) continue;
      const key = t.toISOString().slice(0, 10);
      if (daySet.has(key)) postsPerDayMap[key] += 1;
    }
    const postsPerDay = dayKeys.map((k) => ({ date: k, count: postsPerDayMap[k] || 0 }));

    // Users: recent slice for totals and time series
    const usersSnap = await db
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(MAX_SCAN)
      .get();

    totals.users = usersSnap.size;
    const users = usersSnap.docs.map((d) => d.data());

    const usersPerDayMap = {};
    dayKeys.forEach((k) => (usersPerDayMap[k] = 0));
    for (const u of users) {
      const t = new Date(u.createdAt || 0);
      if (isNaN(t.getTime())) continue;
      const key = t.toISOString().slice(0, 10);
      if (daySet.has(key)) usersPerDayMap[key] += 1;
    }
    const usersPerDay = dayKeys.map((k) => ({ date: k, count: usersPerDayMap[k] || 0 }));

    // Reports: count open/resolved from a recent window
    const reportsSnap = await db
      .collection("reports")
      .orderBy("createdAt", "desc")
      .limit(MAX_SCAN)
      .get();
    for (const d of reportsSnap.docs) {
      const s = String(d.data().status || "").toLowerCase();
      if (s === "open") totals.reportsOpen += 1;
      else if (s === "resolved") totals.reportsResolved += 1;
    }

    res.json({
      totals,
      perCategory,
      topPostsByViews,
      recentPosts,
      timeSeries: { postsPerDay, usersPerDay },
      rangeDays,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[analytics] error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});

/**
 * 8.1) Private Messaging (User-to-User)
 * Firestore collection: "messages"
 * Document fields:
 *  - threadKey: string `${minUserId}:${maxUserId}`
 *  - fromUserId, fromUsername
 *  - toUserId, toUsername
 *  - text: plain sanitized string
 *  - createdAt: ISO string
 *  - read: boolean
 */
function sanitizeMessageText(input){
  let s = String(input || "");
  // Strip all HTML, keep plain text only
  s = sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} });
  // Remove control chars
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 2000) s = s.slice(0, 2000);
  return s;
}

// Poll sanitization: strip HTML/control, collapse whitespace, trim
function sanitizePollText(input){
  let s = String(input || "");
  s = sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} });
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  // Hard cap to reasonable size; validations will enforce exact limits
  if (s.length > 300) s = s.slice(0, 300);
  return s;
}

// Normalize closesAt: return ISO string or null. Invalid/past -> null
function normalizePollClosesAt(input){
  if (!input) return null;
  try{
    const d = new Date(String(input));
    if (isNaN(d.getTime())) return null;
    if (d.getTime() <= Date.now()) return null;
    return d.toISOString();
  }catch(_){ return null; }
}
function threadKeyFor(a, b){
  return [String(a), String(b)].sort().join(":");
}
async function resolveUser(by){
  const usersCol = db.collection("users");
  if (by.toUserId){
    const doc = await usersCol.doc(String(by.toUserId)).get();
    if (doc.exists) return { id: doc.id, ...doc.data() };
    return null;
  }
  if (by.toUsername){
    const snap = await usersCol.where("username","==", String(by.toUsername)).limit(1).get();
    if (!snap.empty){
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    }
    return null;
  }
  return null;
}

// 8.1.1) Send a message
app.post("/api/messages/send", authMiddleware, writeLimiter, async (req, res) => {
  try{
    const { toUserId, toUsername, text } = req.body || {};
    const me = req.user;
    if (!me?.id) return res.status(401).json({ error: "Unauthorized" });

    // Validate recipient
    if (!(toUserId || toUsername)) return res.status(400).json({ error: "Missing recipient" });

    // Validate text
    const cleaned = sanitizeMessageText(text);
    if (!cleaned || cleaned.length < 1) return res.status(400).json({ error: "Text required" });
    if (cleaned.length > 2000) return res.status(400).json({ error: "Text too long" });

    // Resolve recipient
    const recip = await resolveUser({ toUserId, toUsername });
    if (!recip) return res.status(404).json({ error: "Recipient not found" });

    if (String(recip.id) === String(me.id)) return res.status(400).json({ error: "Cannot send to self" });

    const tk = threadKeyFor(me.id, recip.id);
    const now = new Date().toISOString();

    const payload = {
      threadKey: tk,
      fromUserId: me.id,
           fromUsername: me.username || null,
      toUserId: recip.id,
      toUsername: recip.username || null,
      text: cleaned,
      createdAt: now,
      read: false,
    };



    const ref = await db.collection("messages").add(payload);

    // Optional: notification
    try{
      await db.collection("notifications").add({
        toUserId: recip.id,
        type: "message",
        fromUser: me.username || null,
        threadKey: tk,
        createdAt: now,
        read: false,
      });
    }catch(_){ /* non-fatal */ }

    return res.json({ id: ref.id, ...payload });
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

// 8.1.2) List threads with last message + unread counts
app.get("/api/messages/threads", authMiddleware, async (req, res) => {
  try{
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ error: "Unauthorized" });

    // Firestore doesn't support OR in a single query; merge two recents
    const [outSnap, inSnap] = await Promise.all([
      db.collection("messages").where("fromUserId","==", meId).orderBy("createdAt","desc").limit(200).get(),
      db.collection("messages").where("toUserId","==", meId).orderBy("createdAt","desc").limit(200).get()
    ]);

    const docs = [...outSnap.docs, ...inSnap.docs].map(d=>({ id: d.id, ...d.data() }));
    // Sort combined by createdAt desc
    docs.sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0));

    const byThread = new Map();
    const unreadByThread = new Map();

    for (const m of docs){
      const key = m.threadKey;
      if (!byThread.has(key)) {
        byThread.set(key, m); // first seen is the latest due to sorting
      }
      if (String(m.toUserId) === String(meId) && !m.read){
        unreadByThread.set(key, (unreadByThread.get(key) || 0) + 1);
      }
    }

    const result = [];
    for (const [key, last] of byThread.entries()){
      const otherUserId = String(last.fromUserId) === String(meId) ? last.toUserId : last.fromUserId;
      const otherUsername = String(last.fromUserId) === String(meId) ? (last.toUsername || null) : (last.fromUsername || null);
      result.push({
        threadKey: key,
        otherUserId,
        otherUsername,
        lastText: last.text || "",
        lastAt: last.createdAt || null,
        unreadCount: unreadByThread.get(key) || 0,
      });
    }
    // Already latest-first
    res.json(result);
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

// 8.1.3) Fetch a thread by other user (userId or username)
app.get("/api/messages/thread", authMiddleware, async (req, res) => {
  try{
    const me = req.user;
    const userIdParam = req.query.userId ? String(req.query.userId).trim() : "";
    const usernameParam = req.query.username ? String(req.query.username).trim() : "";

    if (!userIdParam && !usernameParam) return res.status(400).json({ error: "Missing userId or username" });

    let other = null;
    if (userIdParam){
      other = await db.collection("users").doc(userIdParam).get();
      if (!other.exists) return res.status(404).json({ error: "User not found" });
      other = { id: other.id, ...other.data() };
    } else {
      const qs = await db.collection("users").where("username","==", usernameParam).limit(1).get();
      if (qs.empty) return res.status(404).json({ error: "User not found" });
      const d = qs.docs[0];
      other = { id: d.id, ...d.data() };
    }

    if (String(other.id) === String(me.id)) return res.status(403).json({ error: "Cannot open thread with self" });

    const tk = threadKeyFor(me.id, other.id);

    const snap = await db
      .collection("messages")
      .where("threadKey","==", tk)
      .orderBy("createdAt","asc")
      .limit(200)
      .get();

    const items = snap.docs.map(d=>({
      id: d.id,
      fromUserId: d.data().fromUserId,
      toUserId: d.data().toUserId,
      text: d.data().text,
      createdAt: d.data().createdAt,
      read: !!d.data().read,
    }));

    return res.json(items);
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

// 8.1.4) Mark thread as read (messages addressed to me)
app.post("/api/messages/thread/:otherId/read", authMiddleware, async (req, res) => {
  try{
    const me = req.user;
    const otherId = String(req.params.otherId || "").trim();
    if (!otherId) return res.status(400).json({ error: "Missing otherId" });
    if (String(otherId) === String(me.id)) return res.status(403).json({ error: "Invalid otherId" });

    const tk = threadKeyFor(me.id, otherId);

    // Fetch recent messages in this thread, then filter addressed to me and unread
    const snap = await db
      .collection("messages")
      .where("threadKey","==", tk)
      .orderBy("createdAt","desc")
      .limit(200)
      .get();

    const toMark = snap.docs.filter(d=>{
      const data = d.data();
      return String(data.toUserId) === String(me.id) && !data.read;
    });

    if (!toMark.length) return res.json({ ok: true, updated: 0 });

    const batch = db.batch();
    toMark.forEach(d=> batch.update(d.ref, { read: true }));
    await batch.commit();

    return res.json({ ok: true, updated: toMark.length });
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

// 8.1.5) Total unread count for current user (recent window)
app.get("/api/messages/unread-count", authMiddleware, async (req, res) => {
  try{
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ error: "Unauthorized" });

    // Avoid composite index requirements: scan recent messages to me and count read==false in memory
    const snap = await db
      .collection("messages")
      .where("toUserId","==", meId)
      .orderBy("createdAt","desc")
      .limit(500)
      .get();

    let unread = 0;
    snap.docs.forEach(d=>{ if (!d.data().read) unread += 1; });
    res.json({ unread });
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

// Etkinlik paylaşımı için yeni uç nokta
app.post("/api/events", authMiddleware, async (req, res) => {
  try {
    const { title, description, date, location, tags } = req.body || {};
    if (!title || !description || !date || !location) {
      return res.status(400).json({ error: "Eksik alanlar" });
    }
    const newEvent = {
      title,
      description,
      date: new Date(date).toISOString(),
      location,
      tags: Array.isArray(tags) ? tags.slice(0, 10).map((t) => String(t).toLowerCase()) : [],
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
    };
    const docRef = await db.collection("events").add(newEvent);
    res.json({ id: docRef.id, ...newEvent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Anket oluşturma için yeni uç nokta
app.post("/api/polls", authMiddleware, async (req, res) => {
  try {
    const { question, options, multiple, closesAt } = req.body || {};
    if (!question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "Eksik veya geçersiz alanlar" });
    }
    const sanitizedOptions = options.map((opt) => sanitizePollText(opt)).filter((opt) => opt);
    if (sanitizedOptions.length < 2) {
      return res.status(400).json({ error: "Geçerli en az iki seçenek gerekli" });
    }
    const poll = {
      question: sanitizePollText(question),
      options: sanitizedOptions.map((text) => ({ id: Math.random().toString(36).slice(2, 8), text, votes: 0 })),
      multiple: !!multiple,
      closesAt: normalizePollClosesAt(closesAt),
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
    };
    const docRef = await db.collection("polls").add(poll);
    res.json({ id: docRef.id, ...poll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gelişmiş arama için yeni uç nokta
app.get("/api/advanced-search", async (req, res) => {
  try {
    const { query, category, tags, dateFrom, dateTo, sortBy, order } = req.query || {};
    const filters = [];

    if (query) {
      filters.push((doc) => {
        const text = `${doc.title || ""} ${doc.content || ""}`.toLowerCase();
        return text.includes(query.toLowerCase());
      });
    }

    if (category) {
      filters.push((doc) => doc.category === category);
    }

    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim().toLowerCase());
      filters.push((doc) => tagList.every((tag) => (doc.tags || []).includes(tag)));
    }

    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : null;
      const to = dateTo ? new Date(dateTo).getTime() : null;
      filters.push((doc) => {
        const createdAt = new Date(doc.createdAt).getTime();
        return (!from || createdAt >= from) && (!to || createdAt <= to);
      });
    }

    const snapshot = await db.collection("posts").get();
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    filters.forEach((filter) => {
      results = results.filter(filter);
    });

    if (sortBy) {
      results.sort((a, b) => {
        const valA = a[sortBy] || 0;
        const valB = b[sortBy] || 0;
        return order === "asc" ? valA - valB : valB - valA;
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 9) Start server
//
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("✅ Backend çalışıyor:", PORT));