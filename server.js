const express = require("express");
const http = require("http");
const cors = require("cors");
const multer = require("multer");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const path = require("path");

/* ===========================
   🔑 FIREBASE INIT (RENDER SAFE)
=========================== */
const firebaseKeyPath = path.join(process.cwd(), "firebaseKey.json");

admin.initializeApp({
  credential: admin.credential.cert(require(firebaseKeyPath)),
  storageBucket: "photo-video-20596.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

/* ===========================
   🚀 EXPRESS + SOCKET.IO
=========================== */
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* ===========================
   📦 MULTER (MEMORY STORAGE)
=========================== */
const upload = multer({
  storage: multer.memoryStorage()
});

/* ===========================
   💬 SOCKET.IO CHAT
=========================== */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("send_message", async (data) => {
    /*
      data = {
        type: "text" | "image" | "video",
        message: "",
        fileUrl: "",
        sender: "username"
      }
    */

    const msg = {
      ...data,
      createdAt: Date.now()
    };

    await db.collection("messages").add(msg);
    io.emit("receive_message", msg);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

/* ===========================
   📸 IMAGE UPLOAD (MAX 5MB)
=========================== */
app.post("/upload/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No image selected" });

    if (req.file.size > 5 * 1024 * 1024)
      return res.status(400).json({ error: "Image max 5MB" });

    const fileName = `images/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype }
    });

    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    res.json({ success: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

/* ===========================
   🎥 VIDEO UPLOAD (MAX 30MB)
=========================== */
app.post("/upload/video", upload.single("video"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No video selected" });

    if (req.file.size > 30 * 1024 * 1024)
      return res.status(400).json({ error: "Video max 30MB" });

    const fileName = `videos/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype }
    });

    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    res.json({ success: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Video upload failed" });
  }
});

/* ===========================
   📜 GET OLD MESSAGES
=========================== */
app.get("/messages", async (req, res) => {
  const snapshot = await db
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limit(100)
    .get();

  const messages = snapshot.docs.map(doc => doc.data());
  res.json(messages);
});

/* ===========================
   ❤️ HEALTH CHECK (RENDER)
=========================== */
app.get("/", (req, res) => {
  res.send("Chat backend is running 🚀");
});

/* ===========================
   🌍 START SERVER (RENDER)
=========================== */
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
