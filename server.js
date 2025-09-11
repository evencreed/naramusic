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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const writeLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 60 });

// Roles helper
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role || "user";
    if (!roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
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

//
// 6) Auth endpoints
//
app.post("/api/auth/register", authLimiter, async (req, res) => {
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
      avatarUrl: null,
      role: "user",
    });

    const user = { id: userDoc.id, username, email: normEmail, avatarUrl: null, role: "user" };
    const token = signToken(user);

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
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

    const user = { id: doc.id, username: data.username, email: data.email, avatarUrl: data.avatarUrl || null, role: data.role || "user" };
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
app.post("/api/posts", authMiddleware, writeLimiter, async (req, res) => {
  try {
    const { title, content, category, mediaUrl, linkUrl, tags } = req.body;
    const { id: authorId, username: authorName, avatarUrl: authorAvatar } = req.user;

    const safeContent = String(content || "");
    const slug = makeSlug(title) + "-" + Math.random().toString(36).slice(2, 7);

    const newPost = {
      title,
      slug,
      content: safeContent,
      contentHtml: renderMarkdown(safeContent),
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
  const q = String(req.query.q || "").toLowerCase().trim();
  if (!q) return res.json([]);
  const snap = await db.collection("posts").orderBy("createdAt", "desc").limit(400).get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const results = items
    .filter((p) => {
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.content || "").toLowerCase().includes(q) ||
        (Array.isArray(p.tags) && p.tags.some((t) => String(t).includes(q)))
      );
    })
    .slice(0, 50);
  res.json(results);
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

// Basic user fetch
app.get("/api/users/:id", async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found" });
    const d = doc.data();
    res.json({ id: doc.id, username: d.username, email: d.email, avatarUrl: d.avatarUrl || null, createdAt: d.createdAt });
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

//
// 9) Start server
//
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("✅ Backend çalışıyor:", PORT));