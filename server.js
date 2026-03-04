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

// ================= HMAC SIGN =================
function createSignature(secretB64, dataString) {
    const secret = Buffer.from(secretB64, "base64");

    return crypto
        .createHmac("sha256", secret)
        .update(dataString, "utf8")
        .digest("base64");
}

// ================= HMAC VERIFY =================
function verifySignature(secretB64, dataString, signature) {
    const expected = createSignature(secretB64, dataString);
    return expected === signature;
}


// ================= LOAD DATABASE =================
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

function normalize(path) {
    return path.replace(/\/+/g, "/");
}

function sendJSON(res, obj) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
}

function generateKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let random = "";
    for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return "MTOOLMAX-" + random;
}

function shortenLink(longUrl, callback) {
    const apiUrl =
        `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`;

    https.get(apiUrl, (resp) => {
        let data = "";
        resp.on("data", chunk => data += chunk);
        resp.on("end", () => {
            try {
                const json = JSON.parse(data);
                callback(json);
            } catch {
                callback(null);
            }
        });
    }).on("error", () => callback(null));
}

// ================= SERVER =================
const server = http.createServer((req, res) => {

    console.log("===================================");
    console.log("FULL REQUEST:", req.method, req.url);
    console.log("HEADERS:", req.headers);
    console.log("===================================");

    const parsedUrl = url.parse(req.url, true);
    const pathname = normalize(parsedUrl.pathname);

    console.log("REQUEST:", req.method, pathname);
    // ================= SERVER TIME =================
    if (pathname === "/server-time") {
    return sendJSON(res, {
        time: Math.floor(Date.now() / 1000)
    });
    }
// ================= CREATE KEY =================
if (pathname === "/api/apikey/create") {

    const key = generateKey(); // MTOOLMAX-XXXXXX

    database[key] = {
        key,
        status: "pending",              // ⚠ chưa verified
        expires_at: 0,
        devices: [],
        created_at: now()
    };

    saveDB();

    const callbackUrl =
        `${BASE_URL}/api/apikey/callback?key=${key}`;

    shortenLink(callbackUrl, (result) => {

        if (!result || result.status === "error") {
            return sendJSON(res, { error: "Link4m error" });
        }

        return sendJSON(res, {
            shortened_link:
                result.shortenedUrl ||
                result.shortened_url
        });
    });

    return;
}
    // ================= CALLBACK VERIFY =================
if (pathname === "/api/apikey/callback") {

    const key = parsedUrl.query.key;

    console.log("KEY:", key);
    console.log("DATABASE:", database);

    const record = database[key];

    if (!record) {
        return res.end("Key not found");
    }

    record.status = "verified";

const created = now();
record.created_at = created;
record.expires_at = created + 86400;

saveDB();


    res.writeHead(302, {
        Location: `${KEY_PAGE}?ma=${key}`
    });

    return res.end();
}

    // ================= DEVICE REGISTER =================
    if (pathname === "/api/devices/register" && req.method === "POST") {

    let body = "";
    req.on("data", chunk => body += chunk);

    req.on("end", () => {

        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = {}; }

        const deviceId =
            parsed.device_id ||
            crypto.randomBytes(16).toString("hex");

        const timeISO = new Date().toISOString();

        // 🔐 secret random 32 byte
        const secretBytes = crypto.randomBytes(32);
        const secretB64 = secretBytes.toString("base64");

        if (!database.__devices) {
            database.__devices = {};
        }

        database.__devices[deviceId] = {
            device_id: deviceId,
            secret: secretB64,
            created_at: now(),
            last_seen: now()
        };

        saveDB();

        return sendJSON(res, {
            ok: true,
            device_id: deviceId,
            client_secret_b64: secretB64,
            created_at: timeISO,
            last_seen: timeISO,
            secret_rotated_at: timeISO
        });
    });

    return;
    }

    // ================= KEY CHECK (APP DÙNG) =================

    // ================= KEY CHECK (APP DÙNG) =================
if (
    pathname.startsWith("/keys/") &&
    pathname.endsWith("/devices") &&
    req.method === "POST"
) {
    const parts = pathname.split("/");
    const apiKey = parts[2];

    let body = "";
req.on("data", chunk => body += chunk);

req.on("end", () => {

    let parsed;
    try {
        parsed = JSON.parse(body);
    } catch {
        parsed = {};
    }

    const device_id = parsed.device_id;

    if (!device_id) {
        return sendJSON(res, { ok:false, message:"No device_id" });
    }

    const record = database[apiKey];

    if (!record.devices) record.devices = [];

    if (!record.devices.includes(device_id)) {
        record.devices.push(device_id);
    }

    saveDB();

    return sendJSON(res, {
        ok: true,
        message: "Key valid"
    });
});

   // ================= NOTICES =================
if (pathname === "/notices") {
    return sendJSON(res, [
        {
            title: "Thông báo hệ thống",
            message: "Server mới đã hoạt động.",
            versionName: "2.6.9",
            created_at: Date.now()
        },
        {
            title: "Cập nhật",
            message: "App đã chuyển sang server riêng.",
            versionName: "2.6.9",
            created_at: Date.now()
        }
    ]);
}

// ================= NOTICE LATEST =================
if (pathname === "/notice/latest") {
    return sendJSON(res, {
        title: "Thông báo mới nhất",
        message: "Đây là notice mới nhất từ server.",
        versionName: "2.6.9",
        created_at: Date.now()
    });
                      }
    // ================= TRANG CHỦ =================
    if (pathname === "/") {

        res.writeHead(200, { "Content-Type": "text/html" });

        return res.end(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Bon Key System</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{
    margin:0;
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
button:hover{ opacity:0.8; }
</style>
</head>
<body>
<h2>BON KEY SERVER</h2>
<button onclick="getKey()">LẤY KEY FREE</button>

<script>
function getKey(){
    let pub = "web_" + Math.random().toString(36).substring(7);

    fetch("/api/apikey/create?pub=" + pub)
    .then(res => res.json())
    .then(data => {

        if(data.shortened_link){

            let clean = data.shortened_link.replace("https://", "");

            let intent =
                "intent://" + clean +
                "#Intent;scheme=https;package=com.android.chrome;end";

            window.location.href = intent;

            // Nếu Chrome không mở, fallback sau 1 giây
            setTimeout(() => {
                window.location.href = data.shortened_link;
            }, 1000);

        } else {
            alert(data.error || "Lỗi tạo link!");
        }

    });
}
</script>
</body>
</html>
`);
    }
//==========/////status.sec/////=========
if (pathname === "/api/apikey/status.sec") {

    const apiKey = parsedUrl.query.api_key;
    const pubBase64 = parsedUrl.query.pub;
    const ua = req.headers["user-agent"] || "";

    if (!ua.includes("MToolMax-http")) {
        return sendJSON(res, { ok:false });
    }

    if (!apiKey || !pubBase64) {
        return sendJSON(res, { ok:false });
    }

    const record = database[apiKey];

    if (!record || record.status !== "verified") {
        return sendJSON(res, { ok:false });
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
            format: "pem"
        });

        const aesKey = crypto.randomBytes(32);

        const payload = JSON.stringify({
            ok: true,
            remaining: remaining,
            expires_at: record.expires_at,
            server_time: nowTime,
            user_id: 123456,
            username: "admin",
            balance: 9999,
            devices_used: record.devices ? record.devices.length : 0,
            device_limit:  2
        });

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

        const encryptedData = Buffer.concat([
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

        return sendJSON(res, {
            ok: true,
            ek: encryptedKey.toString("base64"),
            iv: iv.toString("base64"),
            ct: encryptedData.toString("base64"),
            tag: tag.toString("base64")
        });

    } catch (err) {
        return sendJSON(res, { ok:false });
    }
}
    // ================= KEY SEC =================
    
if (
    pathname.startsWith("/keys/") &&
    pathname.endsWith(".sec")
) {
    const apiKey = pathname
        .replace("/keys/", "")
        .replace(".sec", "");

    const pubBase64 = parsedUrl.query.pub;

    if (!pubBase64) {
        return sendJSON(res, { ok:false });
    }

    const record = database[apiKey];

    if (!record || record.status !== "verified") {
        return sendJSON(res, { ok:false });
    }

    const nowTime = now();

    // Nếu chưa có expire hoặc expire <= now thì set lại 24h
    if (!record.expires_at || record.expires_at <= nowTime) {
        record.expires_at = nowTime + 86400;
        saveDB();
    }

    const remaining = record.expires_at - nowTime;

    if (remaining <= 0) {
        return sendJSON(res, { ok:false });
    }

    try {
        const publicKey = crypto.createPublicKey({
            key: Buffer.from(pubBase64, "base64").toString("utf8"),
            format: "pem"
        });

        const aesKey = crypto.randomBytes(32);

        const payload = JSON.stringify({
            ok: true,
            remaining: remaining,
            expires_at: record.expires_at,
            server_time: nowTime,
            user_id: 123456,
            username: "admin",
            devices_used: 1,
            device_limit: 2,
            balance: 9999
        });

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

        const encryptedData = Buffer.concat([
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

        return sendJSON(res, {
            ok: true,
            ek: encryptedKey.toString("base64"),
            iv: iv.toString("base64"),
            ct: encryptedData.toString("base64"),
            tag: tag.toString("base64")
        });

    } catch (err) {
        return sendJSON(res, { ok:false });
    }
    }
                        
    // ================= APP CONFIG =================
if (pathname === "/config") {
    return sendJSON(res, {
        hethan: "Key hết hạn",
        crack: "OK",                      // <-- đây chính là MToolMaxApp.i.d
        keyhethan: "Key đã hết hạn",
        keydahethan: "Key đã sử dụng",
        thietbikhongcontrongkey: "Thiết bị không hợp lệ",
        pathapikey: "/api/apikey/create",
        pathregdevice: "/api/devices/register",
        useragent: "BonApp/2.6.9",
        pathsumbit: "/submit",
        pathatackdevice: "/attack",
        pathloginkey: "/login",
        paththongbaomoi: "/notice/latest",
        path50thongbao: "/notice/list",
        pathenfbgolike: "/fb",
        pathcaptcha: "/captcha",
        pathgolike: "/golike",
        pathfb: "/fb",
        pathtds: "/tds",
        pathig: "/ig",
        pathttc: "/ttc",
        pathtiktok: "/tiktok",
        listapi: []
    });
}


    
    
    // ================= FALLBACK =================
    return sendJSON(res, {
        ok: true,
        uri: pathname
    });

});  // ← ĐÓNG createServer ở đây

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
