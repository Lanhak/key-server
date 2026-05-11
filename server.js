/**
 * Server cấp key hợp pháp (free key + trang nhận key + API verify)
 *
 * Chạy local:
 *   npm init -y
 *   npm i express helmet cors
 *   node server.js
 *
 * Deploy (Render/Railway):
 *   Build: npm i
 *   Start: node server.js
 *   Env: PORT (auto), BASE_URL (khuyến nghị, ví dụ https://ten-app.onrender.com)
 *
 * Deploy (Vercel/serverless):
 * - Vercel KHÔNG phù hợp cho app.listen() kiểu server truyền thống. Nếu bạn dùng Vercel,
 *   nên chuyển sang dạng serverless handler. (Mình có thể chuyển giúp nếu bạn xác nhận dùng Vercel.)
 *
 * Mặc định:
 * - GET  /              : Trang web có nút "○ Lấy key free"
 * - POST /api/free-key  : Tạo key + trả về claimUrl để mở (user tự mở link lấy key)
 * - GET  /claim/:token  : Trang hiển thị key (copy)
 * - POST /api/verify    : App gọi để kiểm tra key { key, deviceId? }
 */
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();

app.set("trust proxy", true);
app.use(helmet({ contentSecurityPolicy: false })); // cho phép inline script/css để gói trong 1 file
app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));

// Log request (bật khi cần debug: LOG_REQUESTS=1)
if (process.env.LOG_REQUESTS === "1") {
  app.use((req, _res, next) => {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ip=${req.ip} ua=${req.headers["user-agent"] || "-"}`);
    next();
  });
}

// ====== CẤU HÌNH ======
const PORT = Number(process.env.PORT || 3000);

// DATA_FILE:
// - Render/Railway: có thể ghi ở project dir (nhưng không bền vĩnh viễn nếu redeploy)
// - Serverless (Vercel…): FS thường chỉ ghi được ở /tmp
const DATA_DIR =
  process.env.DATA_DIR ||
  (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? os.tmpdir() : __dirname);
const DATA_FILE = path.join(DATA_DIR, "data.keys.json");

// key miễn phí: hết hạn cuối ngày (giống “dùng trong ngày”), bạn đổi tuỳ ý
const FREE_KEY_EXPIRES_AT_END_OF_DAY = true;
const FREE_KEY_TTL_MS = 6 * 60 * 60 * 1000; // fallback: 6 giờ nếu không dùng end-of-day

// giới hạn lấy key theo IP (chống spam)
const FREE_KEY_COOLDOWN_MS = 60 * 1000; // 60s / 1 lần
const FREE_KEY_DAILY_LIMIT = 10; // tối đa 10 key/ngày/IP

// bind device (tuỳ chọn): lần verify đầu sẽ gắn deviceId, các lần sau bắt buộc trùng
const BIND_TO_DEVICE_ID = true;

// ====== Helpers ======
function nowMs() {
  return Date.now();
}

function endOfDayMs() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function newKey() {
  // Ví dụ key: BON_xxxxx... (bạn đổi prefix theo app)
  return `BON_${crypto.randomBytes(18).toString("base64url")}`;
}

function getClientIp(req) {
  // trust proxy đã bật -> req.ip dùng được
  return (req.ip || "").replace("::ffff:", "") || "unknown";
}

function normalizeDeviceId(deviceId) {
  if (!deviceId) return "";
  const s = String(deviceId).trim();
  // tránh payload quá dài
  if (s.length > 128) return s.slice(0, 128);
  return s;
}

function ensureDataDir() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  } catch {
    // ignore
  }
}

function loadDB() {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const db = JSON.parse(raw);
    if (!db || typeof db !== "object") return { keys: {}, claims: {}, ipStats: {} };
    db.keys ||= {};
    db.claims ||= {};
    db.ipStats ||= {};
    return db;
  } catch {
    return { keys: {}, claims: {}, ipStats: {} };
  }
}

function saveDB(db) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function cleanupExpired(db) {
  const t = nowMs();
  for (const [k, v] of Object.entries(db.keys)) {
    if (v?.expiresAt && v.expiresAt <= t) delete db.keys[k];
  }
  for (const [token, v] of Object.entries(db.claims)) {
    // token claim chỉ sống ngắn để user mở link lấy key (vd 15 phút)
    if (v?.expiresAt && v.expiresAt <= t) delete db.claims[token];
  }
}

function getBaseUrl(req) {
  // Ưu tiên BASE_URL nếu bạn set sẵn (khuyến nghị cho production)
  if (process.env.BASE_URL) return String(process.env.BASE_URL).replace(/\/+$/, "");

  // Fallback: tự suy ra từ request (tránh sai http/https khi deploy)
  const proto = req.protocol || "http";
  const host = req.get("host") || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

// ====== UI HTML (gói trong 1 file server.js) ======
function pageShell({ title, bodyHtml, baseUrl, extraHead = "", extraScript = "" }) {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>
    :root{
      --bg1:#0b1220; --bg2:#0f1b35; --card:#121a2a;
      --text:#e9eefc; --muted:#9aa7c7; --accent:#6ee7ff; --accent2:#a78bfa;
      --danger:#ff6b6b; --ok:#2ee59d;
    }
    *{box-sizing:border-box}
    body{
      margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      color:var(--text);
      background: radial-gradient(1200px 600px at 10% 10%, rgba(110,231,255,.18), transparent 60%),
                  radial-gradient(900px 500px at 90% 20%, rgba(167,139,250,.16), transparent 55%),
                  linear-gradient(180deg, var(--bg1), var(--bg2));
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:24px;
    }
    .wrap{width:min(980px,100%);}
    .top{
      display:flex; gap:14px; align-items:center; justify-content:space-between;
      margin-bottom:14px;
    }
    .brand{display:flex; align-items:center; gap:12px;}
    .logo{
      width:42px; height:42px; border-radius:14px;
      background: linear-gradient(135deg, rgba(110,231,255,.9), rgba(167,139,250,.9));
      box-shadow: 0 12px 35px rgba(110,231,255,.10);
    }
    .title{font-weight:800; letter-spacing:.2px;}
    .sub{color:var(--muted); font-size:13px; margin-top:3px;}
    .card{
      background: rgba(18,26,42,.78);
      border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 25px 60px rgba(0,0,0,.35);
      border-radius: 20px;
      overflow:hidden;
    }
    .card-inner{padding:22px;}
    .grid{display:grid; grid-template-columns: 1.2fr .8fr; gap:16px;}
    @media (max-width: 860px){ .grid{grid-template-columns: 1fr;} }
    .panel{
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 16px;
      padding:16px;
    }
    .btn{
      appearance:none; border:0;
      padding: 12px 16px;
      border-radius: 14px;
      color: #031018;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      cursor:pointer;
      box-shadow: 0 16px 45px rgba(110,231,255,.14);
      transition: transform .08s ease;
      width:100%;
      display:flex; align-items:center; justify-content:center; gap:10px;
    }
    .btn:active{transform: translateY(1px);}
    .btn.secondary{
      background: rgba(255,255,255,.06);
      color: var(--text);
      border: 1px solid rgba(255,255,255,.10);
      box-shadow:none;
    }
    .chip{
      display:inline-flex; gap:8px; align-items:center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.10);
      color: var(--muted);
      font-size: 12px;
    }
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;}
    .k{
      padding: 14px 14px;
      border-radius: 16px;
      background: rgba(0,0,0,.28);
      border: 1px solid rgba(255,255,255,.10);
      word-break: break-all;
    }
    .msg{margin-top:10px; color: var(--muted); font-size: 13px; line-height: 1.5;}
    .ok{color: var(--ok);}
    .danger{color: var(--danger);}
    a{color: var(--accent); text-decoration:none}
    .foot{padding:12px 18px; border-top: 1px solid rgba(255,255,255,.06); color: var(--muted); font-size:12px;}
    .spinner{
      width:16px;height:16px;border-radius:50%;
      border:2px solid rgba(0,0,0,.2);
      border-top-color: rgba(0,0,0,.65);
      display:none;
      animation: spin .7s linear infinite;
    }
    @keyframes spin{to{transform: rotate(360deg)}}
  </style>
  ${extraHead}
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <div class="logo"></div>
        <div>
          <div class="title">${escapeHtml(title)}</div>
          <div class="sub">Free key portal · Verify API</div>
        </div>
      </div>
      <span class="chip">Server: <span class="mono">${escapeHtml(baseUrl)}</span></span>
    </div>
    <div class="card">
      <div class="card-inner">
        ${bodyHtml}
      </div>
      <div class="foot">
        Tip: Người dùng bấm “Lấy key free” → mở link nhận key → copy key → quay lại app nhập key → app gọi <span class="mono">POST /api/verify</span>.
      </div>
    </div>
  </div>
  <script>
    ${extraScript}
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ====== ROUTES ======
app.get("/", (req, res) => {
  const ip = getClientIp(req);
  const baseUrl = getBaseUrl(req);

  const bodyHtml = `
    <div class="grid">
      <div class="panel">
        <div class="chip">IP hiện tại: <span class="mono">${escapeHtml(ip)}</span></div>
        <h2 style="margin:12px 0 6px;">Lấy key miễn phí</h2>
        <div class="msg">
          Bấm nút bên dưới để server tạo key và mở trang nhận key (tự copy key).
          Sau đó quay lại ứng dụng và nhập key để xác thực.
        </div>
        <div style="height:12px"></div>
        <button id="btnFree" class="btn">
          <span>○ Lấy key free</span>
          <span id="sp" class="spinner"></span>
        </button>
        <div id="out" class="msg"></div>
      </div>
      <div class="panel">
        <h3 style="margin:0 0 8px;">API cho app</h3>
        <div class="k mono">POST ${escapeHtml(baseUrl)}/api/verify</div>
        <div class="msg">
          Body JSON:
          <div class="k mono" style="margin-top:8px;">{"key":"BON_...","deviceId":"... (tuỳ chọn)"}</div>
          Response:
          <div class="k mono" style="margin-top:8px;">{"ok":true,"expiresAt":...}</div>
        </div>
        <div style="height:8px"></div>
        <button class="btn secondary" onclick="window.location.href='/health'">Kiểm tra server</button>
      </div>
    </div>
  `;

  const extraScript = `
    const btn = document.getElementById('btnFree');
    const out = document.getElementById('out');
    const sp = document.getElementById('sp');
    btn.addEventListener('click', async () => {
      out.textContent = '';
      sp.style.display = 'inline-block';
      btn.disabled = true;
      try{
        const r = await fetch('/api/free-key', { method:'POST' });
        const j = await r.json().catch(() => ({}));
        if(!r.ok){
          out.innerHTML = '<span class="danger">'+(j.error || ('Có lỗi (HTTP '+r.status+')'))+'</span>';
          return;
        }
        out.innerHTML =
          '<span class="ok">Tạo key thành công.</span><br/>' +
          'Mở link nhận key: <a target="_blank" rel="noopener" href="'+j.claimUrl+'">'+j.claimUrl+'</a>';
        // auto mở tab nhận key
        window.open(j.claimUrl, '_blank', 'noopener');
      }catch(e){
        out.innerHTML = '<span class="danger">Lỗi kết nối.</span>';
      }finally{
        sp.style.display = 'none';
        btn.disabled = false;
      }
    });
  `;

  res.type("html").send(pageShell({ title: "Key Server", bodyHtml, extraScript, baseUrl }));
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    dataFile: DATA_FILE, // để debug quyền ghi file
  });
});

// Tạo key + claim link (user tự mở)
app.post("/api/free-key", (req, res) => {
  try {
    const db = loadDB();
    cleanupExpired(db);

    const ip = getClientIp(req);
    const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const statKey = `${ip}::${dayKey}`;
    const s = db.ipStats[statKey] || { lastAt: 0, count: 0 };

    if (s.lastAt && nowMs() - s.lastAt < FREE_KEY_COOLDOWN_MS) {
      const waitSec = Math.ceil((FREE_KEY_COOLDOWN_MS - (nowMs() - s.lastAt)) / 1000);
      saveDB(db);
      return res.status(429).json({ error: `Bạn thao tác quá nhanh, thử lại sau ${waitSec}s.` });
    }
    if (s.count >= FREE_KEY_DAILY_LIMIT) {
      saveDB(db);
      return res.status(429).json({ error: "Hôm nay bạn đã đạt giới hạn lấy key miễn phí." });
    }

    const key = newKey();
    const token = randomToken(18);
    const createdAt = nowMs();
    const expiresAt = FREE_KEY_EXPIRES_AT_END_OF_DAY ? endOfDayMs() : createdAt + FREE_KEY_TTL_MS;

    db.keys[key] = {
      key,
      type: "free",
      createdAt,
      expiresAt,
      createdIp: ip,
      deviceId: "", // sẽ bind lúc verify (nếu bật)
    };

    // claim token sống 15 phút (chỉ để mở trang nhận key)
    db.claims[token] = {
      token,
      key,
      createdAt,
      expiresAt: createdAt + 15 * 60 * 1000,
    };

    db.ipStats[statKey] = { lastAt: createdAt, count: (s.count || 0) + 1 };
    saveDB(db);

    const baseUrl = getBaseUrl(req);
    const claimUrl = `${baseUrl}/claim/${encodeURIComponent(token)}`;
    res.json({ ok: true, claimUrl, expiresAt });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("free-key error:", e);
    res.status(500).json({ error: "Server lỗi khi tạo key" });
  }
});

// Trang nhận key
app.get("/claim/:token", (req, res) => {
  const token = String(req.params.token || "");
  const baseUrl = getBaseUrl(req);

  const db = loadDB();
  cleanupExpired(db);

  const c = db.claims[token];
  if (!c) {
    try {
      saveDB(db);
    } catch {}
    return res
      .status(404)
      .type("html")
      .send(
        pageShell({
          title: "Nhận key",
          baseUrl,
          bodyHtml: `<div class="panel"><h2>Link không hợp lệ / đã hết hạn</h2><div class="msg">Vui lòng quay lại trang chủ để lấy key mới.</div><div style="height:12px"></div><a class="btn secondary" href="/">Về trang chủ</a></div>`,
        })
      );
  }

  const rec = db.keys[c.key];
  if (!rec) {
    delete db.claims[token];
    try {
      saveDB(db);
    } catch {}
    return res
      .status(404)
      .type("html")
      .send(
        pageShell({
          title: "Nhận key",
          baseUrl,
          bodyHtml: `<div class="panel"><h2>Key không tồn tại</h2><div class="msg">Vui lòng lấy key mới.</div><div style="height:12px"></div><a class="btn secondary" href="/">Về trang chủ</a></div>`,
        })
      );
  }

  const expText = new Date(rec.expiresAt).toLocaleString("vi-VN");
  const bodyHtml = `
    <div class="panel">
      <div class="chip">Trạng thái: <span class="ok">Sẵn sàng</span></div>
      <h2 style="margin:12px 0 8px;">Key của bạn</h2>
      <div id="k" class="k mono">${escapeHtml(rec.key)}</div>
      <div class="msg">Hạn dùng: <span class="mono">${escapeHtml(expText)}</span></div>
      <div style="height:12px"></div>
      <button id="copy" class="btn">Copy key</button>
      <div id="m" class="msg"></div>
      <div style="height:10px"></div>
      <a class="btn secondary" href="/">Lấy key khác</a>
    </div>
  `;

  const extraScript = `
    const k = document.getElementById('k').innerText.trim();
    const m = document.getElementById('m');
    document.getElementById('copy').addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(k);
        m.innerHTML = '<span class="ok">Đã copy. Quay lại app và dán vào.</span>';
      }catch(e){
        m.innerHTML = '<span class="danger">Không copy được tự động. Hãy bôi đen và copy thủ công.</span>';
      }
    });
  `;

  try {
    saveDB(db);
  } catch {}
  res.type("html").send(pageShell({ title: "Nhận key", bodyHtml, extraScript, baseUrl }));
});

// App verify key
app.post("/api/verify", (req, res) => {
  try {
    const key = String(req.body?.key || "").trim();
    const deviceId = normalizeDeviceId(req.body?.deviceId);
    const ip = getClientIp(req);

    if (!key) return res.status(400).json({ ok: false, error: "Thiếu key" });

    const db = loadDB();
    cleanupExpired(db);

    const rec = db.keys[key];
    if (!rec) {
      saveDB(db);
      return res.status(401).json({ ok: false, error: "Key không hợp lệ" });
    }
    if (rec.expiresAt && rec.expiresAt <= nowMs()) {
      delete db.keys[key];
      saveDB(db);
      return res.status(401).json({ ok: false, error: "Key đã hết hạn" });
    }

    if (BIND_TO_DEVICE_ID) {
      if (!deviceId) {
        saveDB(db);
        return res.status(400).json({ ok: false, error: "Thiếu deviceId" });
      }
      if (!rec.deviceId) {
        rec.deviceId = deviceId; // bind lần đầu
      } else if (rec.deviceId !== deviceId) {
        saveDB(db);
        return res.status(401).json({ ok: false, error: "Key đã được gắn cho thiết bị khác" });
      }
    }

    rec.lastVerifyAt = nowMs();
    rec.lastVerifyIp = ip;
    db.keys[key] = rec;
    saveDB(db);

    return res.json({
      ok: true,
      type: rec.type,
      expiresAt: rec.expiresAt,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("verify error:", e);
    return res.status(500).json({ ok: false, error: "Server lỗi khi verify" });
  }
});

// ====== START ======
// NOTE: Nếu bạn deploy kiểu server truyền thống (Render/Railway/VPS) thì dùng app.listen như dưới.
// Nếu bạn dùng Vercel, hãy nói mình biết để mình chuyển sang serverless handler (không dùng listen).
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Key server running (port=${PORT}) dataFile=${DATA_FILE} baseUrl=${process.env.BASE_URL || "(auto)"}`);
});

