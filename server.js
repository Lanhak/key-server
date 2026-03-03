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
    return "bon_" + crypto.randomBytes(5).toString("hex");
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

    const parsedUrl = url.parse(req.url, true);
    const pathname = normalize(parsedUrl.pathname);

    console.log("REQUEST:", req.method, pathname);

    // ================= SERVER TIME =================
    if (pathname === "/server-time") {
        return sendJSON(res, { server_time: now() });
    }

    // ================= CREATE KEY =================
    if (pathname === "/api/apikey/create") {

        const pub = parsedUrl.query.pub;

        if (!pub) {
            return sendJSON(res, { error: "Missing pub" });
        }

        const key = generateKey();

        database[key] = {
            key,
            pub,
            status: "pending",
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
        const record = database[key];

        if (!record) {
            return res.end("Key not found");
        }

        record.status = "verified";
        record.expires_at = now() + 86400; // 1 ngày
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

            const time = new Date().toISOString();

            return sendJSON(res, {
                ok: true,
                device_id: deviceId,
                client_secret_b64:
                    Buffer.from(deviceId + "_secret").toString("base64"),
                created_at: time,
                last_seen: time,
                secret_rotated_at: time
            });
        });

        return;
    }

    // ================= KEY CHECK (APP DÙNG) =================
    if (pathname.startsWith("/keys/") &&
        pathname.endsWith("/devices") &&
        req.method === "POST") {

        const parts = pathname.split("/");
        const apiKey = parts[2];

        let body = "";
        req.on("data", chunk => body += chunk);

        req.on("end", () => {

            let parsed;
            try { parsed = JSON.parse(body); } catch { parsed = {}; }

            const deviceId = parsed.device_id;

            if (!apiKey || !database[apiKey]) {
                return sendJSON(res, {
                    ok: false,
                    message: "Key not found",
                    devices_used: 0,
                    devices_remaining: 0
                });
            }

            const record = database[apiKey];

            if (record.status !== "verified") {
                return sendJSON(res, {
                    ok: false,
                    message: "Key not verified",
                    devices_used: 0,
                    devices_remaining: 0
                });
            }

            if (now() > record.expires_at) {
                return sendJSON(res, {
                    ok: false,
                    message: "Key expired",
                    devices_used: record.devices.length,
                    devices_remaining: 0
                });
            }

            if (!record.devices.includes(deviceId)) {

                if (record.devices.length >= 1) {
                    return sendJSON(res, {
                        ok: false,
                        message: "Device limit reached",
                        devices_used: record.devices.length,
                        devices_remaining: 0
                    });
                }

                record.devices.push(deviceId);
                saveDB();
            }

            return sendJSON(res, {
                ok: true,
                message: "Key valid",
                devices_used: record.devices.length,
                devices_remaining: 1 - record.devices.length
            });
        });

        return;
    }

    // ================= NOTICES =================
    if (pathname === "/notices" || pathname === "/notice/latest") {
        return sendJSON(res, {
            ok: true,
            force_update: false,
            versionName: "2.6.9",
            notices: []
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

            // MỞ BẰNG TRÌNH DUYỆT NGOÀI
            window.open(data.shortened_link, "_blank");

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

    // ================= 404 =================
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        error: "Not Found",
        path: pathname
    }));
});

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
