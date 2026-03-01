const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";
const KEY_PAGE = "https://lanhakk.blogspot.com/2026/01/lanh-ak.html";
const PORT = process.env.PORT || 3000;
const DB_FILE = "database.json";

let database = {};

// Load database
if (fs.existsSync(DB_FILE)) {
    database = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
}

function generateKey() {
    return "bon_" + crypto.randomBytes(5).toString("hex");
}

function shortenLink(longUrl, callback) {
    const apiUrl = `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`;

    https.get(apiUrl, (resp) => {
        let data = "";
        resp.on("data", chunk => data += chunk);
        resp.on("end", () => {
            try {
                callback(JSON.parse(data));
            } catch {
                callback(null);
            }
        });
    }).on("error", () => callback(null));
}

const server = http.createServer((req, res) => {

    const q = url.parse(req.url, true);

    // ==========================
    // CREATE KEY (dùng pub)
    // ==========================
    if (q.pathname === "/api/apikey/create") {

        const pub = q.query.pub;

        if (!pub) {
            return res.end(JSON.stringify({ error: "Missing pub" }));
        }

        const now = Math.floor(Date.now() / 1000);

        if (database[pub] &&
            database[pub].status === "verified" &&
            database[pub].expires_at > now) {

            return res.end(JSON.stringify({
                error: "Key still active"
            }));
        }

        const key = generateKey();

        database[pub] = {
            key: key,
            status: "pending",
            expires_at: 0
        };

        saveDB();

        const callbackUrl =
            `${process.env.RENDER_EXTERNAL_URL}/api/apikey/callback?key=${key}`;

        shortenLink(callbackUrl, (result) => {

            if (!result || result.status === "error") {
                return res.end(JSON.stringify({
                    error: "Link4m error"
                }));
            }

            return res.end(JSON.stringify({
                shortened_link: result.shortenedUrl
            }));
        });

        return;
    }

    // ==========================
    // CALLBACK
    // ==========================
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

    // ==========================
    // STATUS CHECK (APP CALL)
    // ==========================
    if (q.pathname === "/api/apikey/status.sec") {

        const apiKey = q.query.api_key;
        const pub = q.query.pub;

        if (!apiKey || !pub) {
            return res.end(JSON.stringify({ is_expired: true }));
        }

        if (!database[pub]) {
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

    res.writeHead(200, { "Content-Type": "text/html" });
res.end(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Bon Key Server</title>
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
.box{
    text-align:center;
}
h1{
    font-size:18px;
    margin-bottom:10px;
}
.status{
    font-size:13px;
    color:#666;
    margin-bottom:20px;
}
.badge{
    padding:6px 12px;
    border:1px solid #00ff99;
    border-radius:4px;
    font-size:12px;
}
</style>
</head>
<body>
    <div class="box">
        <h1>BON KEY SYSTEM</h1>
        <div class="status">Server running...</div>
        <div class="badge">Link4m Enabled</div>
    </div>
</body>
</html>
`);

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
