// db.js — 一个极简的「数据库」：所有数据存成 JSON 文件。
// 不需要安装额外的数据库软件，适合小型个人/朋友圈站点。
// 写操作通过队列串行执行，避免并发写入互相覆盖。

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  tokens: path.join(DATA_DIR, "tokens.json"),
  posts: path.join(DATA_DIR, "posts.json"),
};

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
  }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tokens, {});
ensureFile(FILES.posts, []);

// 简单的串行写入队列，防止多个请求同时写同一个文件导致数据损坏。
let queue = Promise.resolve();
function enqueue(task) {
  const result = queue.then(task, task);
  queue = result.catch(() => {}); // 不让某次失败卡住队列
  return result;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// 所有读写都通过这两个函数，保证同一时间只有一个写操作在跑。
function read(name) {
  return readJSON(FILES[name]);
}

function update(name, mutateFn) {
  return enqueue(() => {
    const data = readJSON(FILES[name]);
    const next = mutateFn(data);
    writeJSON(FILES[name], next);
    return next;
  });
}

module.exports = { read, update };
