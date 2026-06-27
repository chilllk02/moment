# 小记 — 一个简单的朋友圈式网站

注册（名字+密码）、发动态、点赞、评论。数据存在服务器本地的 JSON 文件里，不需要额外的数据库。

---

## 一、本地试运行（可选，确认没问题再部署）

需要先在电脑上装好 [Node.js](https://nodejs.org)（18 版本以上）。

```bash
cd moments-app
npm install
npm start
```

然后浏览器打开 `http://localhost:3000` 就能看到网站。`Ctrl + C` 停止。

---

## 二、免费部署成真实网址（推荐：Render）

Render 提供免费的网站托管，几分钟就能搞定，不需要信用卡。

### 第 1 步：把代码放到 GitHub

1. 注册 [GitHub](https://github.com) 账号（如果还没有）
2. 新建一个仓库（Repository），命名随意，比如 `moments-app`
3. 把 `moments-app` 这个文件夹里的所有文件上传上去
   - 最简单的方式：在仓库页面点 "Add file" → "Upload files"，把文件夹里的内容拖进去
   - 不需要上传 `node_modules` 文件夹（如果有的话）

### 第 2 步：在 Render 上部署

1. 注册 [Render](https://render.com) 账号，可以直接用 GitHub 账号登录
2. 进入控制台，点击 **New +** → **Web Service**
3. 选择你刚刚上传的 GitHub 仓库
4. 填写配置：
   - **Name**：随便起一个名字，这会成为你网址的一部分
   - **Region**：选择离你近的（如 Singapore）
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Instance Type**：选 **Free**
5. 点击 **Create Web Service**

等待几分钟构建完成后，Render 会给你一个网址，类似：

```
https://moments-app-xxxx.onrender.com
```

这就是可以直接在浏览器打开、发给任何人访问的真实网址。

### ⚠️ 免费版的两个限制

- **休眠**：免费实例如果 15 分钟没人访问会自动休眠，下次有人访问时需要等 30~60 秒"醒过来"，之后就正常了。
- **数据持久性**：免费版的文件系统在重新部署（比如你改了代码重新上传）时会被清空。如果只是偶尔休眠/重启，数据是安全的；但每次主动重新部署都会丢失所有注册用户和动态。如果以后想要数据永久保存不受部署影响，需要升级到 Render 的付费版加一个"持久化磁盘"（Persistent Disk），或者换成真正的数据库（我可以另外帮你改造）。

---

## 三、其它部署方式（备选）

如果不想用 Render，也可以用同样的方式部署到：
- **Railway**（railway.app）— 流程类似，但免费额度较小
- 任何支持 Node.js 的云服务器（阿里云、腾讯云等）— 上传代码后运行 `npm install && npm start`，并用 Nginx 配置域名和 HTTPS

---

## 四、文件说明

```
moments-app/
  server.js       后端服务（注册/登录/发动态/点赞/评论的接口）
  db.js           简易文件数据库（把数据存成 JSON 文件）
  package.json    项目依赖配置
  public/
    index.html    页面结构
    style.css     样式
    app.js        前端交互逻辑
  data/           运行后自动生成，存放用户和动态数据（不需要手动创建）
```

## 五、想要的功能升级

如果之后想加：
- 上传图片
- 找回密码
- 真正的数据库（数据不会因重新部署丢失）
- 自己的域名（比如 yourname.com）

都可以在此基础上继续做，告诉我就行。
