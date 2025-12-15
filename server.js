// server.js

const express = require("express");
const http = require("http");
const cors = require("cors");
const multer = require("multer");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

/* Firebase */
admin.initializeApp({
  credential: admin.credential.cert(require("/etc/secrets/firebaseKey.json")),
  storageBucket: "photo-video-20596.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

/* App */
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* Upload */
const upload = multer({ storage: multer.memoryStorage() });

/* Chat */
io.on("connection", (socket) => {
  socket.on("send_message", async (data) => {
    const msg = { ...data, createdAt: Date.now() };
    await db.collection("messages").add(msg);
    io.emit("receive_message", msg);
  });
});

/* Image (5MB) */
app.post("/upload/image", upload.single("image"), async (req, res) => {
  if (!req.file || req.file.size > 5 * 1024 * 1024)
    return res.status(400).json({ error: "Invalid image" });

  const name = `images/${Date.now()}_${req.file.originalname}`;
  await bucket.file(name).save(req.file.buffer, {
    metadata: { contentType: req.file.mimetype }
  });

  res.json({
    url: `https://storage.googleapis.com/${bucket.name}/${name}`
  });
});

/* Video (30MB) */
app.post("/upload/video", upload.single("video"), async (req, res) => {
  if (!req.file || req.file.size > 30 * 1024 * 1024)
    return res.status(400).json({ error: "Invalid video" });

  const name = `videos/${Date.now()}_${req.file.originalname}`;
  await bucket.file(name).save(req.file.buffer, {
    metadata: { contentType: req.file.mimetype }
  });

  res.json({
    url: `https://storage.googleapis.com/${bucket.name}/${name}`
  });
});

/* Messages */
app.get("/messages", async (req, res) => {
  const snap = await db.collection("messages").orderBy("createdAt").limit(100).get();
  res.json(snap.docs.map(d => d.data()));
});

/* Health */
app.get("/", (req, res) => res.send("OK"));

/* Start */
const PORT = process.env.PORT || 10000;
server.listen(PORT);
