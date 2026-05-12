const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";

const DOMAIN = "https://key-server-zfwa.onrender.com";

const KEY_PAGE =
"https://lanhakk.blogspot.com/2026/01/lanh-ak.html";

const PORT = process.env.PORT || 3000;
const DB_FILE = "database.json";

let database = {};

if (fs.existsSync(DB_FILE)) {
    database = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(database, null, 2)
    );
}

function json(res, data) {

    res.writeHead(200, {
        "Content-Type":
        "application/json; charset=UTF-8"
    });

    res.end(JSON.stringify(data));
}

function generateKey() {
    return "bon_" +
    crypto.randomBytes(5).toString("hex");
}

function shortenLink(longUrl, callback) {

    const apiUrl =
    `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`;

    https.get(apiUrl, (resp) => {

        let data = "";

        resp.on("data", chunk => {
            data += chunk;
        });

        resp.on("end", () => {

            try {

                const result = JSON.parse(data);

                callback(result);

            } catch {

                callback(null);
            }
        });

    }).on("error", () => {

        callback(null);
    });
}

const server = http.createServer((req, res) => {

    const q =
    new URL(req.url,
    `http://${req.headers.host}`);

    // =========================
    // GIAO DIỆN CHÍNH
    // =========================

    if (q.pathname === "/") {

        res.writeHead(200, {
            "Content-Type":
            "text/html; charset=UTF-8"
        });

        return res.end(`
<!DOCTYPE html>
<html lang="vi">

<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>MTool Max</title>

<style>

body{
    margin:0;
    padding:0;
    background:#020617;
    font-family:Arial;
    color:white;
}

.container{
    width:100%;
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
}

.card{
    width:420px;
    background:#0f172a;
    border-radius:25px;
    padding:30px;
    text-align:center;
    box-shadow:0 0 30px rgba(0,255,255,0.2);
}

.logo{
    font-size:35px;
    font-weight:bold;
    color:#22d3ee;
}

.status{
    margin-top:10px;
    color:#4ade80;
}

.info{
    margin-top:20px;
    background:#111827;
    padding:15px;
    border-radius:15px;
}

.btn{
    width:100%;
    height:50px;
    margin-top:20px;
    border:none;
    border-radius:15px;
    background:#06b6d4;
    color:white;
    font-size:18px;
    cursor:pointer;
}

.footer{
    margin-top:20px;
    color:#94a3b8;
}

</style>
</head>

<body>

<div class="container">

<div class="card">

<div class="logo">
MTOOL MAX
</div>

<div class="status">
● SERVER ONLINE
</div>

<div class="info">
<p>API Status : Active</p>
<p>Link4M : Connected</p>
<p>Key System : Running</p>
</div>

<button class="btn"
onclick="window.location='/api/keypage'">

TẠO KEY

</button>

<div class="footer">
Powered By LANH AK
</div>

</div>

</div>

</body>
</html>
`);
    }

    // =========================
    // PAGE TẠO KEY
    // =========================

    if (q.pathname === "/api/keypage") {

        res.writeHead(200, {
            "Content-Type":
            "text/html; charset=UTF-8"
        });

        return res.end(`
<!DOCTYPE html>
<html lang="vi">

<head>
<meta charset="UTF-8">

<title>Create Key</title>

<style>

body{
    background:#020617;
    font-family:Arial;
    color:white;
}

.box{
    width:450px;
    margin:auto;
    margin-top:120px;
    background:#0f172a;
    padding:30px;
    border-radius:25px;
    text-align:center;
}

input{
    width:100%;
    height:50px;
    border:none;
    border-radius:15px;
    margin-top:15px;
    padding-left:15px;
    background:#111827;
    color:white;
}

button{
    width:100%;
    height:50px;
    border:none;
    border-radius:15px;
    margin-top:20px;
    background:#06b6d4;
    color:white;
    font-size:18px;
}

a{
    color:#22d3ee;
}

</style>
</head>

<body>

<div class="box">

<h1>MTOOL KEY SYSTEM</h1>

<input id="device"
placeholder="Nhập Device ID">

<button onclick="createKey()">

LẤY KEY

</button>

<div id="result"></div>

</div>

<script>

async function createKey(){

    const device =
    document.getElementById("device").value;

    const req = await fetch(
    "/api/apikey/create?device_id="
    + device
    );

    const data = await req.json();

    if(data.shortened_link){

        document.getElementById("result")
        .innerHTML = \`

        <p style="margin-top:20px">
        Link Vượt:
        </p>

        <a href="\${data.shortened_link}"
        target="_blank">

        \${data.shortened_link}

        </a>

        <p style="margin-top:15px">
        Key:
        </p>

        <input value="\${data.api_key}" readonly>

        \`;

    }else{

        alert(JSON.stringify(data));
    }
}

</script>

</body>
</html>
`);
    }

    // =========================
    // API CHECK
    // =========================

    if (q.pathname === "/api") {

        return json(res, {
            success: true
        });
    }

    // =========================
    // FIX SPLASH APP
    // =========================

    if (q.pathname === "/api/config") {

        return json(res, {
            success: true,
            maintenance: false,
            version: "2.6.9",
            update_required: false
        });
    }

    if (q.pathname === "/api/check") {

        return json(res, {
            success: true,
            status: "ok"
        });
    }

    if (q.pathname === "/api/version") {

        return json(res, {
            success: true,
            version: "2.6.9"
        });
    }

    if (q.pathname === "/ping") {

        return json(res, {
            success: true,
            ping: "ok"
        });
    }

    // =========================
    // REGISTER DEVICE
    // =========================

    if (q.pathname === "/api/devices/register") {

        return json(res, {
            success: true,
            message: "registered"
        });
    }

    // =========================
    // CREATE KEY
    // =========================

    if (q.pathname === "/api/apikey/create") {

        const device_id =
        q.searchParams.get("device_id");

        if (!device_id) {

            return json(res, {
                success: false,
                error: "Missing device_id"
            });
        }

        const now =
        Math.floor(Date.now() / 1000);

        if (
            database[device_id] &&
            database[device_id].status
            === "verified" &&
            database[device_id].expires_at > now
        ) {

            return json(res, {
                success: true,
                message: "Key still active",
                api_key:
                database[device_id].key,
                expires_at:
                database[device_id].expires_at
            });
        }

        const key = generateKey();

        database[device_id] = {
            key: key,
            status: "pending",
            expires_at: 0
        };

        saveDB();

        const callbackUrl =
        `${DOMAIN}/api/apikey/callback?key=${key}`;

        shortenLink(callbackUrl,
        (result) => {

            if (!result) {

                return json(res, {
                    success: false,
                    error: "Link4m error"
                });
            }

            return json(res, {
                success: true,
                api_key: key,
                shortened_link:
                result.shortenedUrl
                || callbackUrl
            });
        });

        return;
    }

    // =========================
    // CALLBACK VERIFY
    // =========================

    if (q.pathname ===
    "/api/apikey/callback") {

        const key =
        q.searchParams.get("key");

        for (let device in database) {

            if (
                database[device].key
                === key
            ) {

                database[device].status =
                "verified";

                database[device]
                .expires_at =

                Math.floor(
                    Date.now() / 1000
                ) + 86400;

                saveDB();

                res.writeHead(302, {
                    Location:
                    `${KEY_PAGE}?ma=${key}`
                });

                return res.end();
            }
        }

        return res.end("Key not found");
    }

    // =========================
    // CHECK KEY
    // =========================

    if (q.pathname ===
    "/api/apikey/status.sec") {

        const apiKey =
        q.searchParams.get("api_key");

        const device_id =
        q.searchParams.get("device_id");

        if (!database[device_id]) {

            return json(res, {
                success: false,
                is_expired: true
            });
        }

        const record =
        database[device_id];

        const now =
        Math.floor(Date.now() / 1000);

        if (
            record.key !== apiKey ||
            record.status !== "verified"
        ) {

            return json(res, {
                success: false,
                is_expired: true
            });
        }

        return json(res, {
            success: true,
            expires_at:
            record.expires_at,
            device_limit: 1,
            devices_used: 1,
            is_expired:
            now > record.expires_at,
            devices: [
                {
                    device_id:
                    device_id
                }
            ]
        });
    }

    // =========================
    // USER INFO
    // =========================

    if (q.pathname ===
    "/api/users/me") {

        return json(res, {
            success: true,
            user: {
                name: "Admin",
                role: "owner"
            }
        });
    }

    // =========================
    // DEFAULT
    // =========================

    return json(res, {
        success: false,
        message: "Endpoint not found"
    });

});

server.listen(PORT, () => {

    console.log(
    "Server running on port",
    PORT
    );

});
