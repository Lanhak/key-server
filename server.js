const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
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

function sendJSON(res, obj) {
    const body = JSON.stringify(obj, null, 4);

    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
    });

    res.end(body);
}

function generateKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let random = "";

    for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return "MTOOLMAX-" + random;
}

// ================= SERVER =================
const server = http.createServer((req, res) => {

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(req.method, pathname);


// ================= CREATE KEY =================
if (pathname === "/api/apikey/create") {

    const key = generateKey();
    const created = now();

    database[key] = {
        id: Object.keys(database).length + 1,
        token: key,
        expired: created + 86400,
        created_time: created,
        devices: []
    };

    saveDB();

    return sendJSON(res,{
        ok:true,
        key:key
    });
}


// ================= DEVICE REGISTER =================
if (pathname === "/api/devices/register" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", () => {

        let parsed;

        try {
            parsed = JSON.parse(body);
        } catch {
            parsed = {};
        }

        const deviceId =
            parsed.device_id ||
            crypto.randomBytes(16).toString("hex");

        return sendJSON(res,{
            ok:true,
            device_id:deviceId
        });

    });

    return;
}


// ================= KEY STATUS =================
if (pathname === "/api/apikey/status.sec") {

    const apiKey = parsedUrl.query.api_key;

    if (!apiKey) {
        return sendJSON(res,{ok:false});
    }

    const record = database[apiKey];

    if (!record) {
        return sendJSON(res,{ok:false});
    }

    const nowTime = now();

    const remaining = record.expired - nowTime;

    // ================= PAYLOAD =================
    const payload = JSON.stringify({

        ok:true,
        key:apiKey,

        remaining:remaining,
        expired:record.expired,
        server_time:nowTime,

        is_expired:false,

        devices_used:record.devices.length,
        device_limit:2,

        devices:(record.devices || []).map(d => ({
            device_id:d,
            label:"Device",
            added_at:nowTime
        }))

    });

    // ================= AES ENCRYPT =================
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        aesKey,
        iv
    );

    const encryptedData = Buffer.concat([
        cipher.update(payload,"utf8"),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();


    // ================= RSA ENCRYPT KEY =================
    const pubBase64 = parsedUrl.query.pub;

    if (!pubBase64) {

        // debug mode
        return sendJSON(res,{
            ok:true,
            remaining:remaining,
            expired:record.expired,
            server_time:nowTime
        });
    }

    const publicKey = crypto.createPublicKey({
        key:Buffer.from(pubBase64,"base64").toString("utf8"),
        format:"pem"
    });

    const encryptedKey = crypto.publicEncrypt(
        {
            key:publicKey,
            padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash:"sha1"
        },
        aesKey
    );

    return sendJSON(res,{
        ok:true,

        ek:encryptedKey.toString("base64"),
        iv:iv.toString("base64"),
        ct:encryptedData.toString("base64"),
        tag:tag.toString("base64")
    });
}


// ================= ROOT =================
if (pathname === "/") {

    res.writeHead(200,{
        "Content-Type":"text/html"
    });

    return res.end(`
<h2>MToolMax Key Server</h2>
<p>Server running...</p>
`);
}

sendJSON(res,{ok:false});

});

server.listen(PORT,()=>{
    console.log("SERVER RUNNING:",PORT);
});
