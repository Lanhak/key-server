const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;

const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";
const DOMAIN = "https://key-server-zfwa.onrender.com";

const DB_FILE = "db.json";

// ================= DB =================
let db = {};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE));
    } catch {
        db = {};
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ================= UTIL =================
function json(res, data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

function generateKey() {
    return "bon_" + crypto.randomBytes(5).toString("hex");
}

// ================= LINK4M =================
function shorten(url, cb) {
    const api = `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(url)}`;

    https.get(api, (r) => {
        let data = "";
        r.on("data", c => data += c);
        r.on("end", () => {
            try { cb(JSON.parse(data)); }
            catch { cb(null); }
        });
    }).on("error", () => cb(null));
}

// =====================================================
// 🔥 HOME UI (ĐẸP + MENU RÕ RÀNG)
// =====================================================
function homeUI() {
return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>KEY SYSTEM</title>
<style>
body{margin:0;background:#0b1220;font-family:Arial;color:white}
.card{
    width:450px;
    margin:120px auto;
    background:#111a2e;
    padding:30px;
    border-radius:20px;
    text-align:center;
    box-shadow:0 0 30px rgba(0,255,255,0.15);
}
h1{color:#22d3ee}
.btn{
    width:100%;
    height:55px;
    border:none;
    border-radius:12px;
    background:#06b6d4;
    color:white;
    font-size:18px;
    cursor:pointer;
    margin-top:15px;
}
.btn2{
    background:#1f2937;
}
.info{
    margin-top:15px;
    color:#94a3b8;
    font-size:14px;
}
</style>
</head>

<body>

<div class="card">

<h1>KEY SYSTEM PANEL</h1>

<p>✔ 1 Key / 1 Device</p>
<p>✔ Expire: 24 Hours</p>
<p>✔ Link4M Active</p>

<button class="btn" onclick="location.href='/create'">
TẠO KEY NGAY
</button>

<button class="btn btn2" onclick="location.href='/check-ui'">
CHECK KEY TOOL
</button>

<div class="info">
Powered By LANH AK
</div>

</div>

</body>
</html>
`;
}

// =====================================================
// 🔥 CREATE KEY UI (PHẦN BẠN ĐANG THIẾU)
// =====================================================
function createUI() {
return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Create Key</title>
<style>
body{background:#0b1220;font-family:Arial;color:white}
.box{
    width:450px;
    margin:120px auto;
    background:#111a2e;
    padding:30px;
    border-radius:20px;
    text-align:center;
    box-shadow:0 0 25px rgba(0,255,255,0.1);
}
input{
    width:100%;
    height:50px;
    margin-top:15px;
    border:none;
    border-radius:12px;
    padding-left:10px;
    background:#1f2937;
    color:white;
    font-size:16px;
}
button{
    width:100%;
    height:55px;
    margin-top:20px;
    border:none;
    border-radius:12px;
    background:#06b6d4;
    color:white;
    font-size:18px;
    cursor:pointer;
}
.result{
    margin-top:20px;
    text-align:left;
    background:#0f172a;
    padding:15px;
    border-radius:12px;
}
a{color:#22d3ee}
</style>
</head>

<body>

<div class="box">

<h2>🔑 TẠO KEY MỚI</h2>

<input id="device" placeholder="Nhập Device ID (ANDROID_ID)">

<button onclick="createKey()">GENERATE KEY</button>

<div id="out" class="result"></div>

</div>

<script>
async function createKey(){

const device = document.getElementById("device").value;

const res = await fetch("/api/create?device_id=" + device);
const data = await res.json();

if(!data.success){
document.getElementById("out").innerHTML = "❌ ERROR";
return;
}

document.getElementById("out").innerHTML =
"<p>🔑 KEY: <b>" + data.key + "</b></p>" +
"<p>🔗 ACTIVE LINK:</p>" +
"<a href='" + data.link + "' target='_blank'>" + data.link + "</a>";
}
</script>

</body>
</html>
`;
}

// =====================================================
// SERVER
// =====================================================
const server = http.createServer((req, res) => {

    const q = new URL(req.url, `http://${req.headers.host}`);

    // HOME
    if (q.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(homeUI());
    }

    // CREATE PAGE
    if (q.pathname === "/create") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(createUI());
    }

    // ================= CREATE KEY =================
    if (q.pathname === "/api/create") {

        const device = q.searchParams.get("device_id");
        if (!device) return json(res, { success: false });

        const now = Math.floor(Date.now() / 1000);

        // 1 KEY / 1 DEVICE
        if (db[device]) {
            return json(res, {
                success: false,
                message: "Device already has key",
                key: db[device].key
            });
        }

        const key = generateKey();

        db[device] = {
            key,
            status: "pending",
            created_at: now,
            expires: now + 86400 // 24H
        };

        saveDB();

        const callback = `${DOMAIN}/api/callback?key=${key}`;

        shorten(callback, (r) => {
            return json(res, {
                success: true,
                key,
                link: r?.shortenedUrl || callback
            });
        });

        return;
    }

    // ================= CALLBACK =================
    if (q.pathname === "/api/callback") {

        const key = q.searchParams.get("key");

        for (const d in db) {

            if (db[d].key === key) {

                db[d].status = "verified";
                db[d].expires = Math.floor(Date.now() / 1000) + 86400;

                saveDB();

                res.writeHead(302, {
                    Location: "https://lanhakk.blogspot.com"
                });

                return res.end();
            }
        }

        return res.end("invalid");
    }

    // ================= CHECK APP (SMALI COMPAT) =================
    if (q.pathname === "/check") {

    const key = (q.searchParams.get("key") || "").trim();
    const device = (q.searchParams.get("device") || "").trim().toUpperCase();

    const data = db[device];

    if (!data) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("INVALID_KEY");
    }

    const now = Math.floor(Date.now() / 1000);

    if (data.key !== key) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("INVALID_KEY");
    }

    if (data.status !== "verified") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("PENDING");
    }

    if (now > data.expires) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("EXPIRED");
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
    }

    res.writeHead(404);
    res.end("NOT FOUND");
});

// START
server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
