const http = require("http");
const url = require("url");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const DB_FILE = "database.json";
const TRIAL_MS = 24 * 60 * 60 * 1000; // 24h

let db = { keys: {}, deviceToKey: {} };

if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch {}
  db.keys ||= {};
  db.deviceToKey ||= {};
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nowMs() {
  return Date.now();
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { resolve({}); }
    });
  });
}

function genKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}-${part()}-${part()}`;
}

function getActiveKeyForDevice(deviceId) {
  const key = db.deviceToKey[deviceId];
  if (!key) return null;
  const rec = db.keys[key];
  if (!rec) return null;
  if (rec.revoked) return null;
  if (nowMs() >= rec.expiresAt) return null;
  if (rec.deviceId !== deviceId) return null;
  return rec;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // (Tuỳ chọn) CORS cho debug; app Android không bắt buộc
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.end();

  // health
  if (pathname === "/server-time") {
    return sendJSON(res, 200, { ok: true, server_time: nowMs() });
  }

  // POST /requestTrial  { deviceId }
  if (pathname === "/requestTrial" && req.method === "POST") {
    const body = await readBody(req);
    const deviceId = String(body.deviceId || "").trim();
    if (!deviceId || deviceId.length < 6) return sendJSON(res, 400, { ok: false, error: "deviceId không hợp lệ" });

    // nếu đã có key còn hạn -> trả lại
    const active = getActiveKeyForDevice(deviceId);
    if (active) {
      return sendJSON(res, 200, { ok: true, key: active.key, expiresAt: active.expiresAt, reused: true });
    }

    // cấp key mới 24h (1 key/1 device)
    const key = genKey();
    const expiresAt = nowMs() + TRIAL_MS;
    db.keys[key] = { key, deviceId, expiresAt, revoked: false, createdAt: nowMs() };
    db.deviceToKey[deviceId] = key;
    saveDB();

    return sendJSON(res, 200, { ok: true, key, expiresAt, reused: false });
  }

  // POST /validateKey  { deviceId, key }
  if (pathname === "/validateKey" && req.method === "POST") {
    const body = await readBody(req);
    const deviceId = String(body.deviceId || "").trim();
    const key = String(body.key || "").trim();
    if (!deviceId || deviceId.length < 6) return sendJSON(res, 400, { ok: false, error: "deviceId không hợp lệ" });
    if (!key || key.length < 10) return sendJSON(res, 400, { ok: false, error: "key không hợp lệ" });

    const rec = db.keys[key];
    if (!rec) return sendJSON(res, 200, { ok: true, valid: false, reason: "NOT_FOUND" });
    if (rec.revoked) return sendJSON(res, 200, { ok: true, valid: false, reason: "REVOKED" });
    if (rec.deviceId !== deviceId) return sendJSON(res, 200, { ok: true, valid: false, reason: "DEVICE_MISMATCH" });
    if (nowMs() >= rec.expiresAt) return sendJSON(res, 200, { ok: true, valid: false, reason: "EXPIRED", expiresAt: rec.expiresAt });

    return sendJSON(res, 200, { ok: true, valid: true, expiresAt: rec.expiresAt });
  }

  return sendJSON(res, 404, { ok: false, error: "NOT_FOUND" });
});

server.listen(PORT, () => console.log("Server running on", PORT));
