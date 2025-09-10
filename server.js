const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(bodyParser.json());
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req,res,next){
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Unauthorized' });
  try{
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data; next();
  }catch(err){ return res.status(401).json({ error: 'Invalid token' }); }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Google Translate API (proxy)
// Expect: { text: string, target: 'en'|'tr', source?: string }
// Set GOOGLE_API_KEY in environment for production
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
      // Passthrough: çeviri anahtarı yoksa gelen metni aynen döndür
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
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
    const data = await r.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message || "translate failed" });
    }
    const translations = (data.data?.translations || []).map(x => x.translatedText);
    if (hasSingle && !hasMany) {
      return res.json({ translated: translations[0] || "" });
    }
    res.json({ translations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth endpoints (simple Firestore-based auth storage)
app.post('/api/auth/register', async (req,res)=>{
  try{
    const { username, email, password } = req.body || {};
    if(!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const usersCol = admin.firestore().collection('users');
    const existing = await usersCol.where('email','==',email).limit(1).get();
    if(!existing.empty) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const userDoc = await usersCol.add({ username, email, passwordHash: hash, createdAt: new Date().toISOString() });
    const user = { id: userDoc.id, username, email };
    const token = signToken(user);
    res.json({ user, token });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req,res)=>{
  try{
    const { email, password } = req.body || {};
    if(!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const usersCol = admin.firestore().collection('users');
    const snapshot = await usersCol.where('email','==',email).limit(1).get();
    if(snapshot.empty) return res.status(400).json({ error: 'Invalid credentials' });
    const doc = snapshot.docs[0]; const data = doc.data();
    const ok = await bcrypt.compare(password, data.passwordHash || '');
    if(!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const user = { id: doc.id, username: data.username, email: data.email };
    const token = signToken(user);
    res.json({ user, token });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Contact message -> route internally to user "evencreed"
app.post('/api/contact', async (req,res)=>{
  try{
    const { name, email, message } = req.body || {};
    if(!name || !email || !message){
      return res.status(400).json({ error: 'Missing fields' });
    }
    const inbox = admin.firestore().collection('messages');
    const payload = {
      toUsername: 'evencreed',
      fromName: name,
      fromEmail: email,
      message,
      createdAt: new Date().toISOString(),
    };
    await inbox.add(payload);
    res.json({ ok: true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Inbox for authenticated user
app.get('/api/messages/inbox', authMiddleware, async (req,res)=>{
  try{
    const { username, id } = req.user;
    const q = await admin.firestore().collection('messages')
      .where('toUsername','==', username)
      .orderBy('createdAt','desc')
      .limit(50)
      .get();
    const items = q.docs.map(d=>({ id: d.id, ...d.data() }));
    res.json(items);
  }catch(err){ res.status(500).json({ error: err.message }); }
});
// 🔹 1. Yeni Post Ekle
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
      comments: []
    };
    const docRef = await db.collection("posts").add(newPost);
    res.json({ id: docRef.id, ...newPost });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 2. Popüler Postlar
app.get("/api/posts/popular", async (req, res) => {
  try {
    const snapshot = await db.collection("posts")
      .orderBy("likes", "desc")
      .limit(5)
      .get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 3. En Son Postlar
app.get("/api/posts/latest", async (req, res) => {
  try {
    const snapshot = await db.collection("posts")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 4. Kategoriye Göre Postlar
app.get("/api/posts/category/:cat", async (req, res) => {
  try {
    const snapshot = await db.collection("posts")
      .where("category", "==", req.params.cat)
      .orderBy("createdAt", "desc")
      .get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 5. Belirli kullanıcıya ait postlar
app.get("/api/users/:authorId/posts", async (req, res) => {
  try {
    const snapshot = await db.collection("posts")
      .where("authorId", "==", req.params.authorId)
      .orderBy("createdAt", "desc")
      .get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(4000, () => console.log("Backend çalışıyor: 4000"));