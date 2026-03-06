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

function loadDB() {
try {
if (fs.existsSync(DB_FILE)) {
const raw = fs.readFileSync(DB_FILE);
database = raw.length ? JSON.parse(raw) : {};
}
} catch {
database = {};
}
}

function saveDB() {
fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
}

loadDB();

function generateKey() {
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let r = "";
for (let i = 0; i < 6; i++) {
r += chars.charAt(Math.floor(Math.random() * chars.length));
}
return "MTOOLMAX-" + r;
}

function generateDeviceId() {
return crypto.randomBytes(16).toString("hex");
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

function encryptPayload(pubBase64, payloadObj) {

const publicKey = crypto.createPublicKey({
key: Buffer.from(pubBase64, "base64").toString("utf8"),
format: "pem"
});

const aesKey = crypto.randomBytes(32);

const iv = crypto.randomBytes(12);

const payload = JSON.stringify(payloadObj);

const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

const encrypted = Buffer.concat([
cipher.update(payload, "utf8"),
cipher.final()
]);

const tag = cipher.getAuthTag();

const encryptedKey = crypto.publicEncrypt(
{
key: publicKey,
padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
oaepHash: "sha1"
},
aesKey
);

return {
ok: true,
ek: encryptedKey.toString("base64"),
iv: iv.toString("base64"),
ct: encrypted.toString("base64"),
tag: tag.toString("base64")
};

}

function createDeviceIfNotExist(deviceId) {

if (!database.__devices) database.__devices = {};

if (!database.__devices[deviceId]) {

database.__devices[deviceId] = {
device_id: deviceId,
key: generateKey(),
created_at: now(),
expires_at: now() + 86400
};

}

return database.__devices[deviceId];

}

const server = http.createServer((req, res) => {

const parsedUrl = url.parse(req.url, true);
const pathname = normalize(parsedUrl.pathname);

if (pathname === "/server-time") {
return sendJSON(res, { server_time: now() });
}

if (pathname === "/api/devices/register" && req.method === "POST") {

let body = "";

req.on("data", chunk => body += chunk);

req.on("end", () => {

let parsed;
try { parsed = JSON.parse(body); } catch { parsed = {}; }

let device_id = parsed.device_id || generateDeviceId();

const record = createDeviceIfNotExist(device_id);

saveDB();

return sendJSON(res, {
ok: true,
device_id: device_id,
key: record.key,
expires_at: record.expires_at
});

});

return;
}

if (
pathname.startsWith("/keys/") &&
pathname.endsWith(".sec")
) {

const apiKey = pathname.replace("/keys/", "").replace(".sec", "");
const pubBase64 = parsedUrl.query.pub;

if (!pubBase64) {
return sendJSON(res, { ok:false });
}

let deviceRecord = null;

if (database.__devices) {
for (const d in database.__devices) {
if (database.__devices[d].key === apiKey) {
deviceRecord = database.__devices[d];
break;
}
}
}

if (!deviceRecord) {
return sendJSON(res, { ok:false });
}

const nowTime = now();

if (deviceRecord.expires_at <= nowTime) {
return sendJSON(res, { ok:false, reason:"expired" });
}

const remaining = deviceRecord.expires_at - nowTime;

const payload = {
ok: true,
remaining: remaining,
key: apiKey,
expires_at: deviceRecord.expires_at,
device_limit: 999999,
devices_used: 1,
is_expired: false,
devices: [
{
device_id: deviceRecord.device_id,
label: "Device",
added_at: deviceRecord.created_at,
hethan: "Key hết hạn",
crack: "OK",
keyhethan: "Key đã hết hạn",
keydahethan: "Key đã sử dụng",
thietbikhongcontrongkey: "Thiết bị không hợp lệ",
pathapikey: "/api/apikey/create",
pathregdevice: "/api/devices/register",
useragent: "MToolMax-http",
pathsumbit: "/pathsumbit",
pathatackdevice: "/attack",
pathloginkey: "/login",
paththongbaomoi: "/notice/latest",
path50thongbao: "/notices",
pathenfbgolike: "/fb",
pathcaptcha: "/captcha",
pathgolike: "/golike",
pathfb: "/fb",
pathtds: "/tds",
pathig: "/ig",
pathttc: "/ttc",
pathtiktok: "/tiktok",
listapi: [BASE_URL]
}
]
};

try {

const encrypted = encryptPayload(pubBase64, payload);

return sendJSON(res, encrypted);

} catch {

return sendJSON(res, { ok:false });

}

}

if (pathname === "/notices") {

return sendJSON(res, [
{
title: "Thông báo hệ thống",
message: "Server đang hoạt động ổn định",
versionName: "2.6.9",
created_at: Date.now()
}
]);

}

if (pathname === "/notice/latest") {

return sendJSON(res, {
title: "Thông báo mới",
message: "Server hoạt động bình thường",
versionName: "2.6.9",
created_at: Date.now()
});

}

if (pathname === "/pathsumbit") {

return sendJSON(res, { items: [] });

}

if (pathname === "/") {

res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });

return res.end(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>MTOOLMAX SERVER</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{
background:#000;
color:#00ffcc;
font-family:monospace;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
margin:0
}
.box{
background:#0a0a0a;
padding:40px;
border-radius:10px;
text-align:center;
box-shadow:0 0 25px #00ffcc55
}
h1{
color:#00ffcc
}
button{
padding:12px 20px;
border:none;
background:#00ffcc;
font-weight:bold;
cursor:pointer
}
button:hover{
opacity:.8
}
</style>
</head>
<body>

<div class="box">
<h1>MTOOLMAX KEY SERVER</h1>
<p>Server hoạt động</p>
<button onclick="create()">Lấy Key</button>
</div>

<script>

function create(){

fetch("/api/devices/register",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({})
})
.then(r=>r.json())
.then(d=>{

alert("Key: "+d.key)

})

}

</script>

</body>
</html>
`);

}

return sendJSON(res, { ok:true, uri:pathname });

});

server.listen(PORT,"0.0.0.0",()=>{

console.log("Server running",PORT);

});
