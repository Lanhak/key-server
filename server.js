const http = require("http")
const url = require("url")
const fs = require("fs")
const crypto = require("crypto")
const https = require("https")

const PORT = process.env.PORT || 3000
const BASE_URL = "https://key-server-4-nsw2.onrender.com"
const LINK4M_TOKEN = "6899fc9d171a1f07277dde22"
const KEY_PAGE = "https://lanhakk.blogspot.com/2026/01/lanh-ak.html"
const DB_FILE = "database.json"

let database = {
    keys: {},
    devices: {},
    notices: []
}

const KEY_DURATION = 86400



// ================= LOAD DATABASE =================

try {

    if (fs.existsSync(DB_FILE)) {

        const raw = fs.readFileSync(DB_FILE, "utf8")

        if (raw.trim().length > 0) {
            database = JSON.parse(raw)
        }

    } else {

        fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2))

    }

} catch {

    database = { keys: {}, devices: {}, notices: [] }

}



// ================= SAVE DATABASE =================

function saveDB() {

    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2))
    } catch {}

}



// ================= TIME =================

function now() {
    return Math.floor(Date.now() / 1000)
}



// ================= PATH NORMALIZE =================

function normalize(path) {

    if (!path) return "/"

    return path.replace(/\/+/g, "/")

}



// ================= SEND JSON =================

function sendJSON(res, obj) {

    const data = JSON.stringify(obj)

    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
    })

    res.end(data)

}



// ================= GENERATE KEY =================

function generateKey() {

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    let key

    do {

        let random = ""

        for (let i = 0; i < 6; i++) {
            random += chars[Math.floor(Math.random() * chars.length)]
        }

        key = "MTOOLMAX-" + random

    } while (database.keys[key])

    return key

}



// ================= SHORTEN LINK =================

function shortenLink(longUrl, callback) {

    const apiUrl =
        `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`

    https.get(apiUrl, resp => {

        let data = ""

        resp.on("data", c => data += c)

        resp.on("end", () => {

            try {

                const json = JSON.parse(data)

                if (json.shortenedUrl || json.shortened_url) {
                    callback(json)
                } else {
                    callback(null)
                }

            } catch {
                callback(null)
            }

        })

    }).on("error", () => callback(null))

}



// ================= DEVICE REGISTER =================

function registerDevice(deviceId) {

    if (!deviceId) {
        deviceId = crypto.randomBytes(16).toString("hex")
    }

    if (!database.devices[deviceId]) {

        database.devices[deviceId] = {

            device_id: deviceId,

            key: null,

            created_at: now(),

            last_seen: now()

        }

        saveDB()

    }

    return deviceId

}



// ================= CREATE KEY =================

function createKeyForDevice(deviceId) {

    const device = database.devices[deviceId]

    if (!device) return null

    if (device.key) {

        const keyRecord = database.keys[device.key]

        if (keyRecord) {

            if (keyRecord.expires_at > now()) {
                return keyRecord.key
            }

        }

    }

    const key = generateKey()

    const created = now()

    const expires = created + KEY_DURATION

    database.keys[key] = {

        key: key,

        device_id: deviceId,

        status: "verified",

        created_at: created,

        expires_at: expires

    }

    device.key = key

    device.last_seen = created

    saveDB()

    return key

}



// ================= CLEANUP =================

function cleanupExpiredKeys() {

    const t = now()

    for (const k in database.keys) {

        const r = database.keys[k]

        if (r.expires_at <= t) {

            const device = database.devices[r.device_id]

            if (device && device.key === k) {
                device.key = null
            }

            delete database.keys[k]

        }

    }

    saveDB()

}

setInterval(cleanupExpiredKeys, 60000)



// ================= ENCRYPT PAYLOAD =================

function encryptPayload(pubBase64, payload) {

    try {

        const publicKey = crypto.createPublicKey({

            key: Buffer.from(pubBase64, "base64").toString("utf8"),

            format: "pem"

        })

        const aesKey = crypto.randomBytes(32)

        const iv = crypto.randomBytes(12)

        const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv)

        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(payload), "utf8"),
            cipher.final()
        ])

        const tag = cipher.getAuthTag()

        const encryptedKey = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha1"
            },
            aesKey
        )

        return {

            ok: true,

            ek: encryptedKey.toString("base64"),

            iv: iv.toString("base64"),

            ct: encrypted.toString("base64"),

            tag: tag.toString("base64")

        }

    } catch {

        return { ok: false }

    }

}



// ================= SERVER =================

const server = http.createServer((req, res) => {

    const parsed = url.parse(req.url, true)

    const pathname = normalize(parsed.pathname)



// ================= SERVER TIME =================

if (pathname === "/server-time") {

    return sendJSON(res, {

        server_time: now()

    })

}



// ================= DEVICE REGISTER =================

if (pathname === "/api/devices/register" && req.method === "POST") {

    let body = ""

    req.on("data", c => body += c)

    req.on("end", () => {

        let parsed

        try {
            parsed = JSON.parse(body)
        } catch {
            parsed = {}
        }

        const deviceId = registerDevice(parsed.device_id)

        return sendJSON(res, {

            ok: true,

            device_id: deviceId,

            created_at: now()

        })

    })

    return

}



// ================= CREATE KEY =================

if (pathname === "/api/apikey/create") {

    const deviceId = parsed.query.device_id

    if (!deviceId) {

        return sendJSON(res, {

            ok: false,

            message: "device_id required"

        })

    }

    registerDevice(deviceId)

    const key = createKeyForDevice(deviceId)

    const callbackUrl =
        `${BASE_URL}/api/apikey/callback?key=${key}`

    shortenLink(callbackUrl, result => {

        if (!result) {

            return sendJSON(res, {

                ok: false

            })

        }

        return sendJSON(res, {

            shortened_link:
                result.shortenedUrl ||
                result.shortened_url

        })

    })

    return

}



// ================= CALLBACK =================

if (pathname === "/api/apikey/callback") {

    const key = parsed.query.key

    const record = database.keys[key]

    if (!record) {

        res.writeHead(404)

        return res.end("Key not found")

    }

    res.writeHead(302, {
        Location: `${KEY_PAGE}?ma=${key}`
    })

    return res.end()

}



// ================= KEY CHECK =================

if (pathname.startsWith("/keys/") && pathname.endsWith(".sec")) {

    const key = pathname.replace("/keys/", "").replace(".sec", "")

    const pub = parsed.query.pub

    const record = database.keys[key]

    if (!record) {

        return sendJSON(res, { ok: false })

    }

    if (record.expires_at <= now()) {

        return sendJSON(res, { ok: false, reason: "expired" })

    }

    const remaining = record.expires_at - now()

    const payload = {

        ok: true,

        key: key,

        remaining: remaining,

        expires_at: record.expires_at,

        server_time: now(),

        device_limit: 1,

        devices_used: 1

    }

    const enc = encryptPayload(pub, payload)

    return sendJSON(res, enc)

}



// ================= NOTICES =================

if (pathname === "/notices") {

    return sendJSON(res, database.notices)

}



// ================= NOTICE LATEST =================

if (pathname === "/notice/latest") {

    const latest = database.notices[database.notices.length - 1]

    return sendJSON(res, latest || {})

}



// ================= CONFIG =================

if (pathname === "/config") {

    return sendJSON(res, {

        hethan: "Key hết hạn",

        crack: "OK",

        keyhethan: "Key đã hết hạn",

        keydahethan: "Key đã sử dụng",

        thietbikhongcontrongkey: "Thiết bị không hợp lệ",

        pathapikey: "/keys/",

        pathregdevice: "/api/devices/register",

        useragent: "MToolMax-http",

        paththongbaomoi: "/notice/latest",

        path50thongbao: "/notices",

        listapi: [BASE_URL]

    })

}



// ================= VERSION PAGE =================

if (pathname === "/" && parsed.query.verision_app) {

    const version = parsed.query.verision_app

    res.writeHead(200, { "Content-Type": "text/html" })

    return res.end(`

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>BIBON SERVER</title>
<style>
body{
background:#000;
color:#00ffcc;
font-family:monospace;
display:flex;
justify-content:center;
align-items:center;
height:100vh
}
.box{
text-align:center
}
</style>
</head>
<body>
<div class="box">
<h1>BIBON KEY SERVER</h1>
<p>Version: ${version}</p>
<p id="time"></p>
</div>
<script>
let remaining=0
setInterval(()=>{
remaining++
document.getElementById("time").innerText="Server Time: "+Date.now()
},1000)
</script>
</body>
</html>

`)

}



// ================= HOME =================

if (pathname === "/") {

res.writeHead(200,{ "Content-Type":"text/html" })

return res.end(`

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>BIBON KEY SYSTEM</title>
<style>
body{
background:#000;
color:#0f0;
font-family:monospace;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
flex-direction:column
}
button{
padding:10px 20px;
background:#0f0;
border:none;
cursor:pointer
}
</style>
</head>
<body>

<h2>BIBON KEY SERVER</h2>

<button onclick="getKey()">GET KEY</button>

<script>

function getKey(){

let device="web_"+Math.random().toString(36).substring(2)

fetch("/api/apikey/create?device_id="+device)

.then(r=>r.json())

.then(d=>{

if(d.shortened_link){

location.href=d.shortened_link

}else{

alert("error")

}

})

}

</script>

</body>
</html>

`)

}



// ================= FALLBACK =================

return sendJSON(res, {

    ok: true,

    uri: pathname

})



})



server.listen(PORT, "0.0.0.0", () => {

console.log("Server running on port", PORT)

})
