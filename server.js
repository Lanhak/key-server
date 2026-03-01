const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";
const KEY_PAGE = "https://lanhakk.blogspot.com/2026/01/lanh-ak.html";
const BASE_URL = "https://key-server-2-at8w.onrender.com"; // sửa nếu đổi domain
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

const server = http.createServer((req, res) => {

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

        database[pub] = {
            key: key,
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

        if (!apiKey || !pub || !database[pub]) {
            return res.end(JSON.stringify({ is_expired: true }));
        }

        const record = database[pub];
        const now = Math.floor(Date.now() / 1000);

        if (record.key !== apiKey ||
            record.status !== "verified") {

            return res.end(JSON.stringify({ is_expired: true }));
        }

        return res.end(JSON.stringify({
            expires_at: record.expires_at,
            device_limit: 1,
            devices_used: 1,
            is_expired: now > record.expires_at,
            devices: [{ device_id: pub }]
        }));
    }

    // ================= TRANG CHỦ ĐẸP =================
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
    <html>
    <body style="background:#000;color:#00ff99;
    font-family:monospace;display:flex;
    justify-content:center;align-items:center;
    height:100vh;flex-direction:column;">
        <h2>BON KEY SERVER</h2>
        <p style="color:#666;">Server running...</p>
        <p style="font-size:12px;">Link4m Enabled</p>
    </body>
    </html>
    `);
});

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
