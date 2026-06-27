// public/app.js — 前端逻辑：登录注册、加载动态、点赞评论

const AVATAR_PALETTE = ["#C97B5A", "#7C8B6F", "#B08968", "#5C7A78", "#A6694A", "#8A7B6C"];

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- 状态 ----------
let token = localStorage.getItem("xiaoji_token") || null;
let myName = localStorage.getItem("xiaoji_name") || null;
let posts = [];
let currentCommentPostId = null;

// ---------- DOM ----------
const authScreen = document.getElementById("authScreen");
const appEl = document.getElementById("app");
const authForm = document.getElementById("authForm");
const authName = document.getElementById("authName");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const headerUser = document.getElementById("headerUser");
const logoutBtn = document.getElementById("logoutBtn");
const feed = document.getElementById("feed");
const loadingRow = document.getElementById("loadingRow");

const composeFab = document.getElementById("composeFab");
const composeOverlay = document.getElementById("composeOverlay");
const closeCompose = document.getElementById("closeCompose");
const composeText = document.getElementById("composeText");
const charCount = document.getElementById("charCount");
const publishBtn = document.getElementById("publishBtn");

const commentOverlay = document.getElementById("commentOverlay");
const closeComment = document.getElementById("closeComment");
const commentTitle = document.getElementById("commentTitle");
const commentList = document.getElementById("commentList");
const commentInput = document.getElementById("commentInput");
const sendComment = document.getElementById("sendComment");

const toast = document.getElementById("toast");

let mode = "login"; // or "register"

// ---------- 工具：API 请求 ----------
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "请求失败，请稍后重试");
  }
  return data;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 1800);
}

// ---------- 登录 / 注册 ----------
tabLogin.addEventListener("click", () => switchMode("login"));
tabRegister.addEventListener("click", () => switchMode("register"));

function switchMode(next) {
  mode = next;
  tabLogin.classList.toggle("active", mode === "login");
  tabRegister.classList.toggle("active", mode === "register");
  authSubmitBtn.textContent = mode === "login" ? "登录" : "注册";
  authPassword.autocomplete = mode === "login" ? "current-password" : "new-password";
  authError.hidden = true;
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.hidden = true;
  authSubmitBtn.disabled = true;

  const name = authName.value.trim();
  const password = authPassword.value;

  try {
    const endpoint = mode === "login" ? "/api/login" : "/api/register";
    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ name, password }),
    });
    token = data.token;
    myName = data.name;
    localStorage.setItem("xiaoji_token", token);
    localStorage.setItem("xiaoji_name", myName);
    enterApp();
  } catch (err) {
    authError.textContent = err.message;
    authError.hidden = false;
  } finally {
    authSubmitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); } catch (e) {}
  token = null;
  myName = null;
  localStorage.removeItem("xiaoji_token");
  localStorage.removeItem("xiaoji_name");
  appEl.hidden = true;
  authScreen.hidden = false;
  authName.value = "";
  authPassword.value = "";
});

// ---------- 进入主界面 ----------
async function enterApp() {
  authScreen.hidden = true;
  appEl.hidden = false;
  headerUser.textContent = myName ? `你好，${myName}` : "";
  await loadPosts();
}

async function loadPosts() {
  loadingRow.hidden = false;
  try {
    posts = await api("/api/posts");
    renderFeed();
  } catch (err) {
    if (err.message.includes("登录")) {
      return doLogoutSilently();
    }
    showToast(err.message);
  } finally {
    loadingRow.hidden = true;
  }
}

function doLogoutSilently() {
  token = null;
  myName = null;
  localStorage.removeItem("xiaoji_token");
  localStorage.removeItem("xiaoji_name");
  appEl.hidden = true;
  authScreen.hidden = false;
}

// ---------- 渲染动态列表 ----------
function renderFeed() {
  feed.innerHTML = "";
  feed.appendChild(loadingRow);
  loadingRow.hidden = true;

  if (posts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = `<p class="empty-title">还没有任何记录</p><p>点击右下角的笔，写下第一条。</p>`;
    feed.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    feed.appendChild(renderCard(post));
  });
}

function renderCard(post) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = post.id;

  const likedByMe = post.likeNames ? post.likeNames.includes(myName) : false;
  const color = hashColor(post.authorName);

  card.innerHTML = `
    <div class="card-head">
      <div class="avatar" style="background:${color}">${escapeHtml(post.authorName.slice(0, 1))}</div>
      <div class="card-head-text">
        <span class="author-name">${escapeHtml(post.authorName)}</span>
        <span class="timestamp">${timeAgo(post.ts)}</span>
      </div>
    </div>
    <p class="card-text">${escapeHtml(post.text)}</p>
    <div class="action-row">
      <button class="action-btn like-btn ${likedByMe ? "liked" : ""}" type="button">
        ${heartSvg(likedByMe)}<span>${post.likes.length > 0 ? post.likes.length : "赞"}</span>
      </button>
      <button class="action-btn comment-btn" type="button">
        ${commentSvg()}<span>${post.comments.length > 0 ? post.comments.length : "评论"}</span>
      </button>
    </div>
    ${renderBelowFold(post)}
  `;

  card.querySelector(".like-btn").addEventListener("click", () => toggleLike(post.id));
  card.querySelector(".comment-btn").addEventListener("click", () => openComments(post.id));

  return card;
}

function renderBelowFold(post) {
  if (post.likes.length === 0 && post.comments.length === 0) return "";

  let html = `<div class="below-fold">`;
  if (post.likes.length > 0) {
    const names = post.likeNames && post.likeNames.length ? post.likeNames.join("、") : `${post.likes.length} 人`;
    html += `<div class="like-line">${heartSvgSmall()}<span class="like-names">&nbsp;${escapeHtml(names)}</span></div>`;
  }
  if (post.comments.length > 0) {
    html += `<div class="comment-block">`;
    post.comments.slice(0, 3).forEach((c) => {
      html += `<div class="comment-line"><span class="comment-author">${escapeHtml(c.authorName)}</span>：${escapeHtml(c.text)}</div>`;
    });
    if (post.comments.length > 3) {
      html += `<button class="more-comments" data-id="${post.id}">查看全部 ${post.comments.length} 条评论</button>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function heartSvg(filled) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? "#C97B5A" : "none"}" stroke="${filled ? "#C97B5A" : "currentColor"}" stroke-width="1.8"><path d="M12 21s-7.5-4.6-10-9.3C0.3 8.4 2 4.8 5.6 4.1c2-0.4 3.9 0.5 5 2 1.1-1.5 3-2.4 5-2 3.6 0.7 5.3 4.3 3.6 7.6C19.5 16.4 12 21 12 21z"/></svg>`;
}
function heartSvgSmall() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="#C97B5A" stroke="none"><path d="M12 21s-7.5-4.6-10-9.3C0.3 8.4 2 4.8 5.6 4.1c2-0.4 3.9 0.5 5 2 1.1-1.5 3-2.4 5-2 3.6 0.7 5.3 4.3 3.6 7.6C19.5 16.4 12 21 12 21z"/></svg>`;
}
function commentSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
}

// 点击"查看全部评论"
feed.addEventListener("click", (e) => {
  const btn = e.target.closest(".more-comments");
  if (btn) openComments(btn.dataset.id);
});

// ---------- 发布动态 ----------
composeFab.addEventListener("click", () => {
  composeOverlay.hidden = false;
  composeText.value = "";
  charCount.textContent = "0/500";
  composeText.focus();
});
closeCompose.addEventListener("click", () => { composeOverlay.hidden = true; });
composeOverlay.addEventListener("click", (e) => { if (e.target === composeOverlay) composeOverlay.hidden = true; });

composeText.addEventListener("input", () => {
  charCount.textContent = `${composeText.value.length}/500`;
});

publishBtn.addEventListener("click", async () => {
  const text = composeText.value.trim();
  if (!text) return;
  publishBtn.disabled = true;
  try {
    await api("/api/posts", { method: "POST", body: JSON.stringify({ text }) });
    composeOverlay.hidden = true;
    showToast("已发布");
    await loadPosts();
  } catch (err) {
    showToast(err.message);
  } finally {
    publishBtn.disabled = false;
  }
});

// ---------- 点赞 ----------
async function toggleLike(postId) {
  try {
    const updated = await api(`/api/posts/${postId}/like`, { method: "POST" });
    applyUpdatedPost(updated);
  } catch (err) {
    showToast(err.message);
  }
}

function applyUpdatedPost(updated) {
  const idx = posts.findIndex((p) => p.id === updated.id);
  if (idx >= 0) posts[idx] = updated;
  renderFeed();
}

// ---------- 评论 ----------
function openComments(postId) {
  currentCommentPostId = postId;
  const post = posts.find((p) => p.id === postId);
  if (!post) return;

  commentTitle.textContent = `评论 · ${post.comments.length}`;
  renderCommentList(post);
  commentInput.value = "";
  commentOverlay.hidden = false;
  commentInput.focus();
}

function renderCommentList(post) {
  commentList.innerHTML = "";
  if (post.comments.length === 0) {
    commentList.innerHTML = `<p class="no-comments">还没有评论，说点什么吧。</p>`;
    return;
  }
  post.comments.forEach((c) => {
    const row = document.createElement("div");
    row.className = "comment-row";
    row.innerHTML = `
      <div class="avatar-sm" style="background:${hashColor(c.authorName)}">${escapeHtml(c.authorName.slice(0, 1))}</div>
      <div class="comment-row-body">
        <div class="comment-row-head">
          <span class="comment-author-full">${escapeHtml(c.authorName)}</span>
          <span class="comment-time">${timeAgo(c.ts)}</span>
        </div>
        <p class="comment-text">${escapeHtml(c.text)}</p>
      </div>
    `;
    commentList.appendChild(row);
  });
}

closeComment.addEventListener("click", () => { commentOverlay.hidden = true; });
commentOverlay.addEventListener("click", (e) => { if (e.target === commentOverlay) commentOverlay.hidden = true; });

async function submitComment() {
  const text = commentInput.value.trim();
  if (!text || !currentCommentPostId) return;
  try {
    const updated = await api(`/api/posts/${currentCommentPostId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    applyUpdatedPost(updated);
    commentTitle.textContent = `评论 · ${updated.comments.length}`;
    renderCommentList(updated);
    commentInput.value = "";
  } catch (err) {
    showToast(err.message);
  }
}

sendComment.addEventListener("click", submitComment);
commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitComment();
});

// ---------- 启动 ----------
(async function init() {
  if (token && myName) {
    try {
      await api("/api/me");
      enterApp();
      return;
    } catch (e) {
      doLogoutSilently();
    }
  }
  switchMode("login");
})();
