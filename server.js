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

// Load database nếu có
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

    // ================================
    // TẠO KEY + LINK4M
    // ================================
    if (q.pathname === "/api/apikey/create") {

        const device_id = q.query.device_id;
        if (!device_id) {
            return res.end(JSON.stringify({ error: "Missing device_id" }));
        }

        const now = Math.floor(Date.now() / 1000);

        // Nếu còn hạn thì không cho tạo mới
        if (database[device_id] &&
            database[device_id].status === "verified" &&
            database[device_id].expires_at > now) {

            return res.end(JSON.stringify({
                error: "Key still active"
            }));
        }

        const key = generateKey();

        database[device_id] = {
            key: key,
            status: "pending",
            expires_at: 0
        };

        saveDB();

        // Link callback sau khi vượt link4m
        const callbackUrl = `${process.env.RENDER_EXTERNAL_URL}/api/apikey/callback?key=${key}`;

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

    // ================================
    // CALLBACK SAU KHI VƯỢT LINK
    // ================================
    if (q.pathname === "/api/apikey/callback") {

        const key = q.query.key;

        for (let device in database) {

            if (database[device].key === key) {

                database[device].status = "verified";
                database[device].expires_at =
                    Math.floor(Date.now() / 1000) + 86400; // 24H từ lúc kích hoạt

                saveDB();

                // Redirect về trang blog của m kèm key
                res.writeHead(302, {
                    Location: `${KEY_PAGE}?ma=${key}`
                });

                return res.end();
            }
        }

        return res.end("Key not found");
    }

    // ================================
    // CHECK KEY
    // ================================
    if (q.pathname === "/api/apikey/status.sec") {

        const apiKey = q.query.api_key;
        const device_id = q.query.device_id;

        if (!database[device_id]) {
            return res.end(JSON.stringify({ is_expired: true }));
        }

        const record = database[device_id];
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
            devices: [{ device_id: device_id }]
        }));
    }

    res.end("Server running...");
});

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
