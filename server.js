const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

const PORT = process.env.PORT || 3000;
const BASE_URL = "https://key-server-4-nsw2.onrender.com";
const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";
const KEY_PAGE = "https://lanhakk.blogspot.com/2026/01/lanh-ak.html";
const DB_FILE = "database.json";

let database = {};

// ================= HMAC =================
function createSignature(secretB64, data) {
  const secret = Buffer.from(secretB64, "base64");
  return crypto.createHmac("sha1", secret).update(data, "utf8").digest("base64");
}

function verifySignature(secretB64, data, sig) {
  return createSignature(secretB64, data) === sig;
}

// ================= DATABASE =================
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE);
    database = raw.length ? JSON.parse(raw) : {};
  }
} catch {
  database = {};
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function normalize(p) {
  return p.replace(/\/+/g, "/");
}

function sendJSON(res, obj) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

// ================= KEY GEN =================
function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return "MTOOLMAX-" + s;
}

// ================= LINK SHORT =================
function shortenLink(longUrl, callback) {
  const apiUrl =
    "https://link4m.co/api-shorten/v2?api=" +
    LINK4M_TOKEN +
    "&url=" +
    encodeURIComponent(longUrl);

  https
    .get(apiUrl, (resp) => {
      let data = "";
      resp.on("data", (c) => (data += c));
      resp.on("end", () => {
        try {
          callback(JSON.parse(data));
        } catch {
          callback(null);
        }
      });
    })
    .on("error", () => callback(null));
}

// ================= SERVER =================
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = normalize(parsedUrl.pathname);

  // ================= TIME =================
  if (pathname === "/server-time") {
    return sendJSON(res, { server_time: now() });
  }

  // ================= CREATE KEY =================
  if (pathname === "/api/apikey/create") {
    const key = generateKey();

    database[key] = {
      key,
      status: "pending",
      expires_at: 0,
      devices: [],
      created_at: now(),
    };

    saveDB();

    const callbackUrl = BASE_URL + "/api/apikey/callback?key=" + key;

    shortenLink(callbackUrl, (result) => {
      if (!result || result.status === "error") {
        return sendJSON(res, { error: "link_error" });
      }

      return sendJSON(res, {
        shortened_link: result.shortenedUrl || result.shortened_url,
      });
    });

    return;
  }

  // ================= CALLBACK =================
  if (pathname === "/api/apikey/callback") {
    const key = parsedUrl.query.key;
    const record = database[key];

    if (!record) return res.end("Key not found");

    record.status = "verified";
    record.created_at = now();
    record.expires_at = now() + 86400;

    saveDB();

    res.writeHead(302, {
      Location: KEY_PAGE + "?ma=" + key,
    });

    return res.end();
  }

  // ================= DEVICE REGISTER =================
  if (pathname === "/api/devices/register" && req.method === "POST") {
    let body = "";

    req.on("data", (c) => (body += c));

    req.on("end", () => {
      let parsed;

      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = {};
      }

      const deviceId =
        parsed.device_id || crypto.randomBytes(16).toString("hex");

      const secret = crypto.randomBytes(32).toString("base64");

      if (!database.__devices) database.__devices = {};

      database.__devices[deviceId] = {
        device_id: deviceId,
        secret: secret,
        created_at: now(),
        last_seen: now(),
      };

      saveDB();

      const timeISO = new Date().toISOString();

      return sendJSON(res, {
        ok: true,
        device_id: deviceId,
        client_secret_b64: secret,
        created_at: timeISO,
        last_seen: timeISO,
        secret_rotated_at: timeISO,
      });
    });

    return;
  }

  // ================= REGISTER DEVICE INTO KEY =================
  if (
    pathname.startsWith("/keys/") &&
    pathname.endsWith("/devices") &&
    req.method === "POST"
  ) {
    const apiKey = pathname.split("/")[2];

    let body = "";

    req.on("data", (c) => (body += c));

    req.on("end", () => {
      let parsed;

      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = {};
      }

      const device_id = parsed.device_id;

      if (!device_id) {
        return sendJSON(res, { ok: false, message: "no_device" });
      }

      const record = database[apiKey];

      if (!record) return sendJSON(res, { ok: false });

      if (!record.devices) record.devices = [];

      if (!record.devices.includes(device_id)) {
        record.devices.push(device_id);
      }

      saveDB();

      return sendJSON(res, { ok: true });
    });

    return;
  }

  // ================= KEY SEC =================
  if (pathname.startsWith("/keys/") && pathname.endsWith(".sec")) {
    const apiKey = pathname.replace("/keys/", "").replace(".sec", "");
    const pubBase64 = parsedUrl.query.pub;

    if (!pubBase64) return sendJSON(res, { ok: false });

    const record = database[apiKey];

    if (!record || record.status !== "verified") {
      return sendJSON(res, { ok: false });
    }

    const nowTime = now();

    if (!record.expires_at || record.expires_at <= nowTime) {
      record.expires_at = nowTime + 86400;
      saveDB();
    }

    const remaining = record.expires_at - nowTime;

    try {
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(pubBase64, "base64").toString("utf8"),
        format: "pem",
      });

      const aesKey = crypto.randomBytes(32);

      const payload = JSON.stringify({
        ok: true,
        key: apiKey,
        remaining: remaining,
        expires_at: record.expires_at,
        device_limit: 999999,
        devices_used: record.devices ? record.devices.length : 0,
        server_time: nowTime,
        crack: "OK",

        hethan: "Key hết hạn",
        keyhethan: "Key đã hết hạn",
        keydahethan: "Key đã sử dụng",
        thietbikhongcontrongkey: "Thiết bị không hợp lệ",

        pathapikey: "/api/apikey/create",
        pathregdevice: "/api/devices/register",
        useragent: "MToolMax-http",

        pathsumbit: "/pathsumbit",
        pathatackdevice: "/attack",
        pathloginkey: "/login",

        paththongbaomoi: "/notice/latest",
        path50thongbao: "/notices",

        pathenfbgolike: "/fb",
        pathcaptcha: "/captcha",
        pathgolike: "/golike",
        pathfb: "/fb",
        pathtds: "/tds",
        pathig: "/ig",
        pathttc: "/ttc",
        pathtiktok: "/tiktok",

        listapi: [BASE_URL + "/"],
      });

      const iv = crypto.randomBytes(12);

      const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

      const encryptedData = Buffer.concat([
        cipher.update(payload, "utf8"),
        cipher.final(),
      ]);

      const tag = cipher.getAuthTag();

      const encryptedKey = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha1",
        },
        aesKey
      );

      return sendJSON(res, {
        ok: true,
        ek: encryptedKey.toString("base64"),
        iv: iv.toString("base64"),
        ct: encryptedData.toString("base64"),
        tag: tag.toString("base64"),
      });
    } catch {
      return sendJSON(res, { ok: false });
    }
  }

  // ================= CONFIG =================
  if (pathname === "/config") {
    return sendJSON(res, {
      useragent: "MToolMax-http",
      pathapikey: "/api/apikey/create",
      pathregdevice: "/api/devices/register",
      paththongbaomoi: "/notice/latest",
      path50thongbao: "/notices",
      listapi: [BASE_URL + "/"],
    });
  }

  // ================= NOTICE =================
  if (pathname === "/notices") {
    return sendJSON(res, [
      {
        title: "Thông báo",
        message: "Server hoạt động",
        versionName: "2.6.9",
        created_at: Date.now(),
      },
    ]);
  }

  if (pathname === "/notice/latest") {
    return sendJSON(res, {
      title: "Thông báo mới",
      message: "Server online",
      versionName: "2.6.9",
      created_at: Date.now(),
    });
  }

  // ================= SUBMIT =================
  if (pathname === "/pathsumbit") {
    return sendJSON(res, { items: [] });
  }

  // ================= HOME =================
  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });

    return res.end(`

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>MToolMax Key Server</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

body{
background:#0a0a0a;
color:#00ffcc;
font-family:monospace;
display:flex;
align-items:center;
justify-content:center;
height:100vh;
margin:0;
}

.box{
background:#111;
padding:40px;
border-radius:15px;
box-shadow:0 0 30px #00ffcc44;
text-align:center;
width:90%;
max-width:500px;
}

h1{
color:#00ffcc;
text-shadow:0 0 10px #00ffcc;
}

button{
padding:12px 25px;
background:#00ffcc;
border:none;
border-radius:6px;
font-weight:bold;
cursor:pointer;
}

button:hover{
opacity:.8;
}

a{
color:#00ffcc;
}

</style>

</head>

<body>

<div class="box">

<h1>MTOOLMAX KEY SERVER</h1>

<p>Free Key System</p>

<button onclick="getKey()">GET KEY FREE</button>

<p id="result"></p>

<script>

function getKey(){

fetch("/api/apikey/create")

.then(r=>r.json())

.then(d=>{

if(d.shortened_link){

location.href=d.shortened_link

}else{

document.getElementById("result").innerText="Lỗi tạo key"

}

})

}

</script>

</div>

</body>

</html>

`);
  }

  return sendJSON(res, { ok: true, uri: pathname });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
