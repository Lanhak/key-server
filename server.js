/****************************************************************************************
 * BON KEY SYSTEM - COMPLETE SERVER
 * VERSION: 2.6.9
 * FILE: server.js
 * NODE: >=18
 ****************************************************************************************/

const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

/****************************************************************************************
 * CONFIG
 ****************************************************************************************/

const PORT = process.env.PORT || 3000;

const BASE_URL = "https://key-server-4-nsw2.onrender.com";
const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";

const KEY_PAGE = "https://lanhakk.blogspot.com/2026/01/lanh-ak.html";

const DB_FILE = "database.json";

const KEY_PREFIX = "MTOOLMAX-";

const KEY_DURATION = 24 * 60 * 60; // 24h seconds

const DEVICE_LIMIT = 999999;

const USER_AGENT_REQUIRED = "MToolMax-http";

/****************************************************************************************
 * DATABASE
 ****************************************************************************************/

let database = {
  keys: {},
  devices: {}
};

function loadDB() {

  try {

    if (!fs.existsSync(DB_FILE)) {
      saveDB();
    }

    const raw = fs.readFileSync(DB_FILE);

    if (!raw || !raw.length) {
      saveDB();
      return;
    }

    const parsed = JSON.parse(raw);

    if (parsed) {
      database = parsed;
    }

  } catch (e) {

    database = {
      keys: {},
      devices: {}
    };

    saveDB();
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
}

loadDB();

/****************************************************************************************
 * UTILS
 ****************************************************************************************/

function now() {
  return Math.floor(Date.now() / 1000);
}

function randomHex(len = 16) {
  return crypto.randomBytes(len).toString("hex");
}

function randomBase64(len = 32) {
  return crypto.randomBytes(len).toString("base64");
}

function generateKey() {

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let r = "";

  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }

  return KEY_PREFIX + r;
}

function normalize(p) {
  return (p || "/").replace(/\/+/g, "/");
}

function sendJSON(res, obj) {

  const data = JSON.stringify(obj);

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data)
  });

  res.end(data);
}

function sendHTML(res, html) {

  res.writeHead(200, {
    "Content-Type": "text/html; charset=UTF-8"
  });

  res.end(html);
}

function readBody(req) {

  return new Promise((resolve) => {

    let data = "";

    req.on("data", chunk => data += chunk);

    req.on("end", () => resolve(data));
  });
}

/****************************************************************************************
 * HMAC
 ****************************************************************************************/

function createSignature(secretB64, dataString) {

  const secret = Buffer.from(secretB64, "base64");

  return crypto
    .createHmac("sha1", secret)
    .update(dataString, "utf8")
    .digest("base64");
}

function verifySignature(secretB64, dataString, signature) {

  const expected = createSignature(secretB64, dataString);

  return expected === signature;
}

/****************************************************************************************
 * AES GCM + RSA
 ****************************************************************************************/

function encryptPayloadRSA(pubBase64, payloadObject) {

  const publicKey = crypto.createPublicKey({
    key: Buffer.from(pubBase64, "base64").toString("utf8"),
    format: "pem"
  });

  const aesKey = crypto.randomBytes(32);

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

  const payload = JSON.stringify(payloadObject);

  const encrypted = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  const encryptedKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha1"
    },
    aesKey
  );

  return {
    ok: true,
    ek: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
    ct: encrypted.toString("base64"),
    tag: tag.toString("base64")
  };
}

/****************************************************************************************
 * LINK4M
 ****************************************************************************************/

function shortenLink(longUrl) {

  return new Promise((resolve) => {

    const apiUrl =
      `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`;

    https.get(apiUrl, (resp) => {

      let data = "";

      resp.on("data", d => data += d);

      resp.on("end", () => {

        try {

          const json = JSON.parse(data);

          resolve(json);

        } catch {
          resolve(null);
        }

      });

    }).on("error", () => resolve(null));

  });
}

/****************************************************************************************
 * DEVICE
 ****************************************************************************************/

function registerDevice(deviceId) {

  if (!deviceId) deviceId = randomHex(16);

  const secret = randomBase64(32);

  database.devices[deviceId] = {

    device_id: deviceId,
    secret: secret,

    created_at: now(),
    last_seen: now()
  };

  saveDB();

  return {
    device_id: deviceId,
    secret: secret
  };
}

/****************************************************************************************
 * KEY
 ****************************************************************************************/

function createKeyForDevice(deviceId) {

  const key = generateKey();

  database.keys[key] = {

    key: key,

    device_id: deviceId,

    status: "pending",

    created_at: now(),

    expires_at: 0,

    devices: []
  };

  saveDB();

  return key;
}

/****************************************************************************************
 * SERVER
 ****************************************************************************************/

const server = http.createServer(async (req, res) => {

  const parsed = url.parse(req.url, true);

  const pathname = normalize(parsed.pathname);

  const query = parsed.query;

  const method = req.method;

  const ua = req.headers["user-agent"] || "";

/****************************************************************************************
 * SERVER TIME
 ****************************************************************************************/

  if (pathname === "/server-time") {

    return sendJSON(res, {
      server_time: now()
    });
  }

/****************************************************************************************
 * DEVICE REGISTER
 ****************************************************************************************/

  if (pathname === "/api/devices/register" && method === "POST") {

    const raw = await readBody(req);

    let parsedBody;

    try {
      parsedBody = JSON.parse(raw);
    } catch {
      parsedBody = {};
    }

    const deviceId = parsedBody.device_id || randomHex(16);

    const device = registerDevice(deviceId);

    const timeISO = new Date().toISOString();

    return sendJSON(res, {

      ok: true,

      device_id: device.device_id,

      client_secret_b64: device.secret,

      created_at: timeISO,

      last_seen: timeISO,

      secret_rotated_at: timeISO
    });
  }

/****************************************************************************************
 * CREATE KEY
 ****************************************************************************************/

  if (pathname === "/api/apikey/create") {

    const deviceId = query.device_id || randomHex(16);

    const key = createKeyForDevice(deviceId);

    const callback = `${BASE_URL}/api/apikey/callback?key=${key}`;

    const result = await shortenLink(callback);

    if (!result || result.status === "error") {

      return sendJSON(res, { error: "link error" });

    }

    return sendJSON(res, {

      shortened_link:
        result.shortenedUrl ||
        result.shortened_url
    });
  }

/****************************************************************************************
 * CALLBACK VERIFY
 ****************************************************************************************/

  if (pathname === "/api/apikey/callback") {

    const key = query.key;

    const record = database.keys[key];

    if (!record) {
      return res.end("key not found");
    }

    record.status = "verified";

    record.created_at = now();

    record.expires_at = now() + KEY_DURATION;

    saveDB();

    res.writeHead(302, {
      Location: `${KEY_PAGE}?ma=${key}`
    });

    return res.end();
  }

/****************************************************************************************
 * DEVICE ATTACH KEY
 ****************************************************************************************/

  if (
    pathname.startsWith("/keys/") &&
    pathname.endsWith("/devices") &&
    method === "POST"
  ) {

    const parts = pathname.split("/");

    const apiKey = parts[2];

    const raw = await readBody(req);

    let parsedBody;

    try {
      parsedBody = JSON.parse(raw);
    } catch {
      parsedBody = {};
    }

    const deviceId = parsedBody.device_id;

    if (!deviceId) {

      return sendJSON(res, {
        ok: false,
        message: "No device_id"
      });
    }

    const record = database.keys[apiKey];

    if (!record) {
      return sendJSON(res, { ok: false });
    }

    if (!record.devices) record.devices = [];

    if (!record.devices.includes(deviceId)) {

      if (record.devices.length >= DEVICE_LIMIT) {

        return sendJSON(res, {
          ok: false,
          reason: "device limit"
        });
      }

      record.devices.push(deviceId);

      saveDB();
    }

    return sendJSON(res, {
      ok: true,
      message: "Key valid"
    });
  }

/****************************************************************************************
 * KEY SEC
 ****************************************************************************************/

  if (
    pathname.startsWith("/keys/") &&
    pathname.endsWith(".sec")
  ) {

    const apiKey = pathname
      .replace("/keys/", "")
      .replace(".sec", "");

    const pubBase64 = query.pub;

    if (!pubBase64) {
      return sendJSON(res, { ok: false });
    }

    const record = database.keys[apiKey];

    if (!record || record.status !== "verified") {

      return sendJSON(res, { ok: false });
    }

    const nowTime = now();

    if (!record.expires_at) {

      record.expires_at = nowTime + KEY_DURATION;

      saveDB();
    }

    if (record.expires_at <= nowTime) {

      return sendJSON(res, {
        ok: false,
        reason: "expired"
      });
    }

    const remaining = record.expires_at - nowTime;

    const payload = {

      ok: true,

      key: apiKey,

      remaining: remaining,

      expires_at: record.expires_at,

      device_limit: DEVICE_LIMIT,

      devices_used: record.devices.length,

      is_expired: false,

      crack: "OK",

      listapi: [
        BASE_URL + "/"
      ],

      pathapikey: "/api/apikey/create",

      pathregdevice: "/api/devices/register",

      useragent: USER_AGENT_REQUIRED,

      paththongbaomoi: "/notice/latest",

      path50thongbao: "/notices"
    };

    return sendJSON(res, encryptPayloadRSA(pubBase64, payload));
  }

/****************************************************************************************
 * CONFIG
 ****************************************************************************************/

  if (pathname === "/config") {

    return sendJSON(res, {

      hethan: "Key hết hạn",

      crack: "OK",

      keyhethan: "Key đã hết hạn",

      keydahethan: "Key đã sử dụng",

      thietbikhongcontrongkey: "Thiết bị không hợp lệ",

      pathapikey: "/api/apikey/create",

      pathregdevice: "/api/devices/register",

      useragent: USER_AGENT_REQUIRED,

      paththongbaomoi: "/notice/latest",

      path50thongbao: "/notices",

      listapi: [
        BASE_URL + "/"
      ]
    });
  }

/****************************************************************************************
 * NOTICES
 ****************************************************************************************/

  if (pathname === "/notices") {

    return sendJSON(res, [

      {
        title: "Thông báo hệ thống",
        message: "Server hoạt động ổn định",
        versionName: "2.6.9",
        created_at: Date.now()
      },

      {
        title: "Cập nhật",
        message: "App đã chuyển server riêng",
        versionName: "2.6.9",
        created_at: Date.now()
      }

    ]);
  }

/****************************************************************************************
 * LATEST NOTICE
 ****************************************************************************************/

  if (pathname === "/notice/latest") {

    return sendJSON(res, {

      title: "Thông báo mới",

      message: "Server đang hoạt động bình thường",

      versionName: "2.6.9",

      created_at: Date.now()
    });
  }

/****************************************************************************************
 * HOME PAGE
 ****************************************************************************************/

  if (pathname === "/") {

    return sendHTML(res, `

<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<title>Bon Key Server</title>

<meta name="viewport" content="width=device-width,initial-scale=1">

<style>

body{
background:#000;
color:#00ff99;
font-family:monospace;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
flex-direction:column;
}

button{
padding:12px 25px;
background:#00ff99;
border:none;
border-radius:5px;
cursor:pointer;
font-weight:bold;
}

</style>

</head>

<body>

<h2>BON KEY SERVER</h2>

<button onclick="getKey()">LẤY KEY FREE</button>

<script>

function getKey(){

fetch("/api/apikey/create")
.then(r=>r.json())
.then(d=>{

if(d.shortened_link){

location.href=d.shortened_link;

}else{

alert("Lỗi tạo key");

}

})

}

</script>

</body>

</html>

`);
  }

/****************************************************************************************
 * FALLBACK
 ****************************************************************************************/

  return sendJSON(res, {
    ok: true,
    uri: pathname
  });

});

/****************************************************************************************
 * START
 ****************************************************************************************/

server.listen(PORT, "0.0.0.0", () => {

  console.log("SERVER RUNNING PORT", PORT);

});
