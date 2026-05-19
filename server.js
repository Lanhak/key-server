const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const DB_FILE = "database.json";

let database = {};

if (fs.existsSync(DB_FILE)) {
database = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
}

function generateKey() {
return "bon_" + crypto.randomBytes(5).toString("hex");
}

const server = http.createServer((req, res) => {

res.setHeader("Content-Type", "application/json");

const q = url.parse(req.url, true);

// =====================================
// SERVER TIME
// =====================================
if (q.pathname === "/server-time") {

    return res.end(JSON.stringify({
        server_time: Math.floor(Date.now() / 1000)
    }));
}

// =====================================
// TẠO KEY TEST
// =====================================
if (q.pathname === "/create-key") {

    const device_id = q.query.device_id;

    if (!device_id) {
        return res.end(JSON.stringify({
            ok: false,
            message: "Missing device_id"
        }));
    }

    const key = generateKey();

    database[device_id] = {
        key: key,
        expires_at: Math.floor(Date.now() / 1000) + 86400
    };

    saveDB();

    return res.end(JSON.stringify({
        ok: true,
        api_key: key
    }));
}

// =====================================
// VERIFY DEVICE
// =====================================
if (q.pathname === "/devices" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => {
        body += chunk;
    });

    req.on("end", () => {

        try {

            const json = JSON.parse(body);

            const device_id = json.device_id;
            const label = json.label || "";

            // app thường gửi key qua header
            const apiKey =
                req.headers["x-api-key"] ||
                req.headers["apikey"] ||
                req.headers["authorization"];

            if (!device_id || !apiKey) {

                return res.end(JSON.stringify({
                    ok: false,
                    message: "Missing data"
                }));
            }

            const record = database[device_id];

            if (!record) {

                return res.end(JSON.stringify({
                    ok: false,
                    message: "Device not registered"
                }));
            }

            if (record.key !== apiKey) {

                return res.end(JSON.stringify({
                    ok: false,
                    message: "Invalid API key"
                }));
            }

            const now = Math.floor(Date.now() / 1000);

            if (now > record.expires_at) {

                return res.end(JSON.stringify({
                    ok: false,
                    message: "Key expired"
                }));
            }

            return res.end(JSON.stringify({
                ok: true,
                message: "Device verified",
                devices_used: 1,
                devices_remaining: 0,
                device_label: label
            }));

        } catch (e) {

            return res.end(JSON.stringify({
                ok: false,
                message: "Bad JSON"
            }));
        }
    });

    return;
}

res.end(JSON.stringify({
    ok: false,
    message: "Endpoint not found"
}));

});

server.listen(PORT, () => {
console.log("Server running on port", PORT);
});
