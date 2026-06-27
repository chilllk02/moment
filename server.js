// server.js — 网站的后端服务
// 功能：注册 / 登录、发动态、点赞、评论
// 数据存储：本地 JSON 文件（见 db.js），无需额外数据库

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- 密码哈希（使用 Node 内置 crypto，不需要额外依赖） ----------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

// ---------- 鉴权中间件 ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "请先登录" });

  const tokens = db.read("tokens");
  const userId = tokens[token];
  if (!userId) return res.status(401).json({ error: "登录已失效，请重新登录" });

  const users = db.read("users");
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(401).json({ error: "用户不存在" });

  req.user = { id: user.id, name: user.name };
  req.token = token;
  next();
}

// ---------- 注册 ----------
app.post("/api/register", async (req, res) => {
  const { name, password } = req.body || {};
  const trimmedName = (name || "").trim();

  if (!trimmedName || trimmedName.length > 20) {
    return res.status(400).json({ error: "名字不能为空，且不超过20个字" });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "密码至少需要4位" });
  }

  const users = db.read("users");
  if (users.some((u) => u.name === trimmedName)) {
    return res.status(409).json({ error: "这个名字已经被注册了，换一个试试" });
  }

  const salt = makeSalt();
  const passwordHash = hashPassword(password, salt);
  const newUser = {
    id: `u-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    name: trimmedName,
    salt,
    passwordHash,
    createdAt: Date.now(),
  };

  await db.update("users", (list) => [...list, newUser]);

  const token = makeToken();
  await db.update("tokens", (map) => ({ ...map, [token]: newUser.id }));

  res.json({ token, name: newUser.name });
});

// ---------- 登录 ----------
app.post("/api/login", async (req, res) => {
  const { name, password } = req.body || {};
  const trimmedName = (name || "").trim();

  const users = db.read("users");
  const user = users.find((u) => u.name === trimmedName);
  if (!user) return res.status(401).json({ error: "用户不存在或密码错误" });

  const hash = hashPassword(password || "", user.salt);
  if (hash !== user.passwordHash) {
    return res.status(401).json({ error: "用户不存在或密码错误" });
  }

  const token = makeToken();
  await db.update("tokens", (map) => ({ ...map, [token]: user.id }));

  res.json({ token, name: user.name });
});

// ---------- 退出登录 ----------
app.post("/api/logout", requireAuth, async (req, res) => {
  await db.update("tokens", (map) => {
    const next = { ...map };
    delete next[req.token];
    return next;
  });
  res.json({ ok: true });
});

// ---------- 当前登录用户 ----------
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ name: req.user.name });
});

// 把存储里的 userId 数组转换成可显示的名字，附加在返回结果里
function withLikeNames(post, users) {
  const likeNames = post.likes
    .map((uid) => users.find((u) => u.id === uid)?.name)
    .filter(Boolean);
  return { ...post, likeNames };
}

// ---------- 获取所有动态 ----------
app.get("/api/posts", requireAuth, (req, res) => {
  const posts = db.read("posts");
  const users = db.read("users");
  // 按时间倒序，最新的在最前面
  const sorted = [...posts].sort((a, b) => b.ts - a.ts).map((p) => withLikeNames(p, users));
  res.json(sorted);
});

// ---------- 发布新动态 ----------
app.post("/api/posts", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "内容不能为空" });
  if (text.length > 500) return res.status(400).json({ error: "内容太长了" });

  const newPost = {
    id: `p-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    authorId: req.user.id,
    authorName: req.user.name,
    text,
    ts: Date.now(),
    likes: [], // 存用户 id
    comments: [],
  };

  await db.update("posts", (list) => [...list, newPost]);
  res.json({ ...newPost, likeNames: [] });
});

// ---------- 点赞 / 取消点赞 ----------
app.post("/api/posts/:id/like", requireAuth, async (req, res) => {
  const { id } = req.params;
  let updatedPost = null;

  await db.update("posts", (list) =>
    list.map((p) => {
      if (p.id !== id) return p;
      const liked = p.likes.includes(req.user.id);
      updatedPost = {
        ...p,
        likes: liked
          ? p.likes.filter((uid) => uid !== req.user.id)
          : [...p.likes, req.user.id],
      };
      return updatedPost;
    })
  );

  if (!updatedPost) return res.status(404).json({ error: "动态不存在" });
  const users = db.read("users");
  res.json(withLikeNames(updatedPost, users));
});

// ---------- 添加评论 ----------
app.post("/api/posts/:id/comments", requireAuth, async (req, res) => {
  const { id } = req.params;
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "评论不能为空" });
  if (text.length > 200) return res.status(400).json({ error: "评论太长了" });

  let updatedPost = null;
  await db.update("posts", (list) =>
    list.map((p) => {
      if (p.id !== id) return p;
      const newComment = {
        id: `c-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
        authorId: req.user.id,
        authorName: req.user.name,
        text,
        ts: Date.now(),
      };
      updatedPost = { ...p, comments: [...p.comments, newComment] };
      return updatedPost;
    })
  );

  if (!updatedPost) return res.status(404).json({ error: "动态不存在" });
  const users = db.read("users");
  res.json(withLikeNames(updatedPost, users));
});

// 所有未匹配到的路由，返回前端页面（方便直接访问根路径）
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`服务已启动：http://localhost:${PORT}`);
});
