require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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

//
// 2) Express setup
//
const app = express();
app.use(cors());
app.use(bodyParser.json());

//
// 3) JWT helpers
//
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

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

//
// 5) Translate Proxy (Google Translate API)
//
app.post("/api/translate", async (req, res) => {
  try {
    const { text, texts, target, source } = req.body || {};
    const hasSingle = typeof text === "string" && text.length > 0;
    const hasMany = Array.isArray(texts) && texts.length > 0;
    if ((!hasSingle && !hasMany) || !target) {
      return res.status(400).json({ error: "Missing text(s) or target" });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      // Passthrough (anahtar yoksa çeviri yapılmaz)
      if (hasSingle && !hasMany) {
        return res.json({ translated: text });
      }
      return res.json({ translations: texts });
    }

    const url = "https://translation.googleapis.com/language/translate/v2";
    const params = new URLSearchParams({ target, format: "text" });
    if (hasSingle) params.append("q", text);
    if (hasMany) {
      for (const t of texts) {
        params.append("q", t);
      }
    }
    if (source) params.append("source", source);
    params.append("key", apiKey);

    const fetch = (await import("node-fetch")).default;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await r.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || "translate failed" });
    }

    const translations = (data.data?.translations || []).map(
      (x) => x.translatedText
    );

    if (hasSingle && !hasMany) {
      return res.json({ translated: translations[0] || "" });
    }
    res.json({ translations });
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
    const r = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?market=TR`, {
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

//
// 6) Auth endpoints
//
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const usersCol = db.collection("users");
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
    const userDoc = await usersCol.add({
      username,
      email: normEmail,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    });

    const user = { id: userDoc.id, username, email };
    const token = signToken(user);

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });
    const usersCol = db.collection("users");
    const rawEmail = String(email).trim();
    const normEmail = rawEmail.toLowerCase();

    // Try with exact email first (for legacy mixed-case entries), then normalized
    let snapshot = await usersCol.where("email", "==", rawEmail).limit(1).get();
    if (snapshot.empty) {
      snapshot = await usersCol.where("email", "==", normEmail).limit(1).get();
    }
    if (snapshot.empty)
      return res.status(400).json({ error: "Invalid credentials" });

    const doc = snapshot.docs[0];
    const data = doc.data();
    const ok = await bcrypt.compare(password, data.passwordHash || "");
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const user = { id: doc.id, username: data.username, email: data.email };
    const token = signToken(user);

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
app.post("/api/posts", authMiddleware, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const { id: authorId, username: authorName } = req.user;

    const newPost = {
      title,
      content,
      category,
      authorId,
      authorName,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
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
      .orderBy("likes", "desc")
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

app.get("/api/posts/category/:cat", async (req, res) => {
  try {
    const snapshot = await db
      .collection("posts")
      .where("category", "==", req.params.cat)
      .orderBy("createdAt", "desc")
      .get();
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

//
// 9) Start server
//
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("✅ Backend çalışıyor:", PORT));