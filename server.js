const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";
const KEY_PAGE = "https://lanhakk.blogspot.com/2026/01/lanh-ak.html";
const BASE_URL = "https://key-server-4-nsw2.onrender.com"; // sửa nếu đổi domain
const PORT = process.env.PORT || 3000;
const DB_FILE = "database.json";

let database = {};

// ===== LOAD DATABASE AN TOÀN =====
try {
    if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE);
        database = raw.length ? JSON.parse(raw) : {};
    }
} catch (err) {
    console.log("Database lỗi, reset về rỗng");
    database = {};
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
    } catch (e) {
        console.log("Lỗi khi lưu database");
    }
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

function getClientIP(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress;
}

function generateDeviceId(ip) {
    return crypto
        .createHash("md5")
        .update(ip + "mtool_salt_2026")
        .digest("hex"); // 32 ký tự
}

const server = http.createServer((req, res) => {
    console.log("REQUEST:", req.method, req.url);
    const q = url.parse(req.url, true);

    // ================= CREATE =================
    if (q.pathname === "/api/apikey/create") {

        const pub = q.query.pub;
        if (!pub) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Missing pub" }));
        }

        const now = Math.floor(Date.now() / 1000);

        if (database[pub] &&
            database[pub].status === "verified" &&
            database[pub].expires_at > now) {

            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Key still active" }));
        }

        const key = generateKey();

        database[key] = {
    pub: pub,
    status: "pending",
    expires_at: 0
};

        saveDB();

        const callbackUrl =
            `${BASE_URL}/api/apikey/callback?key=${key}`;

        shortenLink(callbackUrl, (result) => {

            res.writeHead(200, { "Content-Type": "application/json" });

            if (!result || result.status === "error") {
                return res.end(JSON.stringify({
                    error: "Link4m error"
                }));
            }

            return res.end(JSON.stringify({
                shortened_link:
                    result.shortenedUrl ||
                    result.shortened_url
            }));
        });

        return;
    }

    // ================= CALLBACK =================
    if (q.pathname === "/api/apikey/callback") {

    if (req.method === "HEAD") {
        res.writeHead(200);
        return res.end();
    }

    const key = q.query.key;

    for (let pub in database) {

        if (database[pub].key === key) {

            database[pub].status = "verified";
            database[pub].expires_at =
                Math.floor(Date.now() / 1000) + 86400;

            saveDB();

            res.writeHead(302, {
                Location: `${KEY_PAGE}?ma=${key}`
            });

            return res.end();
        }
    }

    return res.end("Key not found");
    }
    // ================= STATUS =================
    if (q.pathname === "/api/apikey/status.sec") {

    const apiKey = q.query.api_key;
    const pub = q.query.pub;

    res.writeHead(200, { "Content-Type": "application/json" });

    // App bắt buộc phải có pub
    if (!pub) {
        return res.end(JSON.stringify({
            ok: false,
            error: "Missing pub"
        }));
    }

    if (!apiKey) {
        return res.end(JSON.stringify({
            ok: false,
            error: "Missing api_key"
        }));
    }

    // 🔥 Quan trọng: tra theo KEY, không tra theo pub
    const record = database[apiKey];

    if (!record) {
        return res.end(JSON.stringify({
            ok: false,
            valid: false
        }));
    }

    if (record.status !== "verified") {
        return res.end(JSON.stringify({
            ok: false,
            valid: false
        }));
    }

    if (Date.now() / 1000 > record.expires_at) {
        return res.end(JSON.stringify({
            ok: false,
            expired: true
        }));
    }

    return res.end(JSON.stringify({
        ok: true,
        valid: true,
        expires_at: record.expires_at
    }));
    }

    // ================= TRANG CHỦ =================
    if (q.pathname === "/") {
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
    padding:10px 20px;
    background:#00ff99;
    border:none;
    border-radius:5px;
    cursor:pointer;
    font-weight:bold;
}
button:hover{
    opacity:0.8;
}
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
            window.location.href = data.shortened_link;
        }else{
            alert(data.error || "Lỗi tạo link!");
        }
    });
}
</script>
</body>
</html>
`);
    }
// ================= SERVER TIME =================
if (q.pathname === "/server-time") {

    res.writeHead(200, { "Content-Type": "application/json" });

    return res.end(JSON.stringify({
        server_time: Math.floor(Date.now() / 1000)
    }));
}
    // ================= KEYS =================
if (q.pathname === "/keys") {

    res.writeHead(200, { "Content-Type": "application/json" });

    return res.end(JSON.stringify({
        ok: true,
        uri: "/keys"
    }));
}
    
    // ================= NOTICES =================
if (q.pathname === "/notices") {

    res.writeHead(200, { "Content-Type": "application/json" });

    return res.end(JSON.stringify({
        ok: true,
        force_update: false,
        versionName: "2.6.9",
        id: 0,
        title: "",
        message: "",
        update_url: "",
        motd: "",
        notice: "",
        status: "ok",
        created_at: Math.floor(Date.now() / 1000),
        notices: []
    }));
}

    // ================= NOTICE LATEST =================
if (q.pathname === "/notice/latest") {

    res.writeHead(200, { "Content-Type": "application/json" });

    return res.end(JSON.stringify({
        ok: true,
        force_update: false,
        versionName: "2.6.9",
        id: 0,
        title: "",
        message: "",
        update_url: "",
        motd: "",
        notice: "",
        status: "ok",
        created_at: Math.floor(Date.now() / 1000),
        notices: []
    }));
}
//=======devices====≈=
const rawPath = url.parse(req.url).pathname;
const pathname = q.pathname.replace(/\/+/g, "/");

if (pathname === "/api/devices/register") {

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", () => {

        console.log("BODY:", body);
        console.log("HEADERS:", req.headers);

        let parsed;
        try {
            parsed = JSON.parse(body);
        } catch {
            parsed = {};
        }

        const deviceId = parsed.device_id || crypto.randomBytes(16).toString("hex");
        const now = new Date().toISOString();

        res.writeHead(200, { "Content-Type": "application/json" });

        res.end(JSON.stringify({
            ok: true,
            device_id: deviceId,
            client_secret_b64: Buffer.from(deviceId + "_secret").toString("base64"),
            created_at: now,
            last_seen: now,
            secret_rotated_at: now
        }));
    });

    return;
}
    
    // ===== DEBUG 404 =====
console.log("404 PATH:", q.pathname);

res.writeHead(404, { "Content-Type": "application/json" });
res.end(JSON.stringify({
    error: "Not Found",
    path: q.pathname
}));

}); // ĐÓNG createServer

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
