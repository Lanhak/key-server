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


// ================= HMAC SIGN =================
function createSignature(secretB64, dataString) {
    const secret = Buffer.from(secretB64, "base64");

    return crypto
        .createHmac("sha256", secret)
        .update(dataString, "utf8")
        .digest("base64");
}

// ================= HMAC VERIFY =================
function verifySignature(secretB64, dataString, signature) {
    const expected = createSignature(secretB64, dataString);
    return expected === signature;
}

//============KHAI BÁO//=============
function now(){
return Math.floor(Date.now()/1000);
}

function saveDB(){
fs.writeFileSync(DB_FILE,JSON.stringify(database,null,2));
}

function normalize(path){
return path.replace(/\/+/g,"/");
}

function sendJSON(res,obj){
res.writeHead(200,{"Content-Type":"application/json"});
res.end(JSON.stringify(obj));
}

function generateKey(){
const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let r="";
for(let i=0;i<6;i++){
r+=chars.charAt(Math.floor(Math.random()*chars.length));
}
return "MTOOLMAX-"+r;
}
function shortenLink(longUrl, callback){

const api =
`https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`;

https.get(api,(resp)=>{

let data="";

resp.on("data",chunk=>data+=chunk);

resp.on("end",()=>{

try{
const json=JSON.parse(data);
callback(json);
}catch{
callback(null);
}

});

}).on("error",()=>callback(null));

}

// ================= LOAD DATABASE =================
let database = {
  keys:{},
  devices:{},
  notices:[]
};

try{
if(fs.existsSync(DB_FILE)){
const raw = fs.readFileSync(DB_FILE,"utf8");

if(raw.trim().length>0){
database = JSON.parse(raw);
}
}
}catch{
database={keys:{},devices:{},notices:[]};
}

//=======// key hết hạn //=========
function cleanupExpiredKeys(){

const t = now();

for(const k in database.keys){

const r = database.keys[k];

if(r.expires_at <= t){

const device = database.devices[r.device_id];

if(device && device.key === k){
device.key=null;
}

delete database.keys[k];

}

}

saveDB();

}

setInterval(cleanupExpiredKeys,60000);
// ================= SERVER =================
const server = http.createServer((req, res) => {

    console.log("===================================");
    console.log("FULL REQUEST:", req.method, req.url);
    console.log("HEADERS:", req.headers);
    console.log("===================================");

    const parsedUrl = url.parse(req.url, true);
    const pathname = normalize(parsedUrl.pathname);

    console.log("REQUEST:", req.method, pathname);
    // ================= SERVER TIME =================
// ================= SERVER TIME =================
if (pathname === "/server-time") {
    return sendJSON(res, {
        server_time: Math.floor(Date.now() / 1000)
    });
}

// ================= CREATE KEY =================
if(pathname==="/api/apikey/create"){

if(req.method !== "GET"){
return sendJSON(res,{ok:false});
}

const deviceId = parsedUrl.query.device_id;

if(!deviceId){
return sendJSON(res,{ok:false});
}

const device = database.devices[deviceId];

if(!device){
return sendJSON(res,{ok:false});
}

if(device.key){

const r = database.keys[device.key];

if(r && r.expires_at > now()){
return sendJSON(res,{
ok:false,
message:"device already has key"
});
}

device.key=null;

}

const key = generateKey();
const created = now();

database.keys[key]={
key:key,
device_id:deviceId,
status:"verified",
created_at:created,
expires_at:created+86400
};

device.key = key;

saveDB();

return sendJSON(res,{
ok:true,
key:key,
expires_at:created+86400
});

}
    // ================= CALLBACK VERIFY =================
if (pathname === "/api/apikey/callback") {

    const key = parsedUrl.query.key;

    console.log("KEY:", key);
    console.log("DATABASE:", database);

    const record = database.keys[key];

    if (!record) {
        return res.end("Key not found");
    }

    record.status = "verified";

const created = now();
record.created_at = created;
record.expires_at = created + 86400;

saveDB();


    res.writeHead(302, {
        Location: `${KEY_PAGE}?ma=${key}`
    });

    return res.end();
}

    // ================= DEVICE REGISTER =================
   if (pathname === "/api/devices/register" && req.method === "POST") {

let body="";
req.on("data",chunk=>body+=chunk);

req.on("end",()=>{

let parsed={};
try{ parsed=JSON.parse(body); }catch{}

const deviceId =
parsed.device_id ||
crypto.randomBytes(16).toString("hex");

if(!database.devices) database.devices={};

if(!database.devices[deviceId]){

database.devices[deviceId]={
device_id:deviceId,
key:null,
created_at:now(),
last_seen:now()
};

}else{

database.devices[deviceId].last_seen = now();

}

saveDB();

return sendJSON(res,{
ok:true,
device_id:deviceId
});

});

return;
}
    // ================= KEY CHECK (APP DÙNG) =================
if (
    pathname.startsWith("/keys/") &&
    pathname.endsWith("/devices") &&
    req.method === "POST"
) {
    const parts = pathname.split("/");
    const apiKey = parts[2];

    let body = "";
    req.on("data", chunk => body += chunk);

    req.on("end", () => {

        let parsed;
        try {
            parsed = JSON.parse(body);
        } catch {
            parsed = {};
        }

        const device_id = parsed.device_id;

        if (!device_id) {
            return sendJSON(res, { ok:false, message:"No device_id" });
        }

        const record = database.keys[apiKey];
        if (!record) {
            return sendJSON(res, { ok:false });
        }

        if (!record.devices) record.devices = [];

        if (!record.devices.includes(device_id)) {
            record.devices.push(device_id);
        }
        saveDB();

        return sendJSON(res, {
            ok: true,
            message: "Key valid"
        });
    });

    return;   // ✅ QUAN TRỌNG
        }
   // ================= NOTICES =================
if (pathname === "/notices") {
    return sendJSON(res, [
        {
            title: "Thông báo hệ thống",
            message: "Server mới đã hoạt động.",
            versionName: "2.6.9",
            created_at: Date.now()
        },
        {
            title: "Cập nhật",
            message: "App đã chuyển sang server riêng.",
            versionName: "2.6.9",
            created_at: Date.now()
        }
    ]);
}

// ================= NOTICE LATEST =================
if (pathname === "/notice/latest") {
    return sendJSON(res, {
        title: "Thông báo mới nhất",
        message: "Đây là notice mới nhất từ server.",
        versionName: "2.6.9",
        created_at: Date.now()
    });
 }
 
//==========/////status.sec/////=========
if (pathname === "/api/apikey/status.sec") {

    const apiKey = parsedUrl.query.api_key;
    const pubBase64 = parsedUrl.query.pub;
    const ua = req.headers["user-agent"] || "";

    if (!ua.includes("MToolMax-http")) {
        return sendJSON(res, { ok:false });
    }

    if (!apiKey || !pubBase64) {
        return sendJSON(res, { ok:false });
    }

    const record = database.keys[apiKey];

    if (!record || record.status !== "verified") {
        return sendJSON(res, { ok:false });
    }

    const nowTime = now();

    if (!record.expires_at || record.expires_at <= nowTime) {
        record.expires_at = nowTime + 86400;
        saveDB();
    }

    const remaining = record.expires_at - nowTime;

    try {

        const publicKey = crypto.createPublicKey({
            key: Buffer.from(pubBase64, "base64").toString("utf8"),
            format: "pem"
        });

        const aesKey = crypto.randomBytes(32);

        const payload = JSON.stringify({
            ok: true,
            remaining: remaining,
            expires_at: record.expires_at,
            server_time: nowTime,
            user_id: 123456,
            username: "admin",
            balance: 9999,
            devices_used: record.devices ? record.devices.length : 0,
            device_limit:  2
        });

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

        const encryptedData = Buffer.concat([
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

        return sendJSON(res, {
            ok: true,
            ek: encryptedKey.toString("base64"),
            iv: iv.toString("base64"),
            ct: encryptedData.toString("base64"),
            tag: tag.toString("base64")
        });

    } catch (err) {
        return sendJSON(res, { ok:false });
    }
}
    // ================= KEY SEC =================
    
if(
pathname.startsWith("/keys/") &&
pathname.endsWith(".sec")
){

const apiKey = pathname
.replace("/keys/","")
.replace(".sec","");

const deviceId = parsedUrl.query.device_id;
const pubBase64 = parsedUrl.query.pub;

if(!deviceId || !pubBase64){
return sendJSON(res,{ok:false});
}

const record = database.keys[apiKey];

if(!record || record.status!=="verified"){
return sendJSON(res,{ok:false});
}

if(record.device_id !== deviceId){
return sendJSON(res,{
ok:false,
message:"device mismatch"
});
}

const nowTime = now();

if(record.expires_at <= nowTime){
return sendJSON(res,{
ok:false,
message:"key expired"
});
}

const remaining = record.expires_at - nowTime;

    if (remaining <= 0) {
        return sendJSON(res, { ok:false });
    }

    try {
        const publicKey = crypto.createPublicKey({
            key: Buffer.from(pubBase64, "base64").toString("utf8"),
            format: "pem"
        });

        const aesKey = crypto.randomBytes(32);

        const payload = JSON.stringify({
            ok: true,
            remaining: remaining,
            
            key: apiKey,
            expires_at: record.expires_at,
            device_limit: 2,
            devices_used: record.devices ? record.devices.length : 0,
            is_expired: false,
            devices: (record.devices || []).map(d => ({
            device_id: d,
            label: "Device",
            added_at: nowTime
    }))
});

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

        const encryptedData = Buffer.concat([
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

    
        return sendJSON(res, {
            ok: true,
            iv: iv.toString("base64"),
            ct: encryptedData.toString("base64"),
            ek: encryptedKey.toString("base64"),
            tag: tag.toString("base64")
        });

    } 
    
    catch (err) {
        return sendJSON(res, { ok:false });
    }
}                       



    // ================= APP CONFIG =================
if (pathname === "/config") {
    return sendJSON(res, {
        hethan: "Key hết hạn",
        crack: "OK",                      // <-- đây chính là MToolMaxApp.i.d
        keyhethan: "Key đã hết hạn",
        keydahethan: "Key đã sử dụng",
        thietbikhongcontrongkey: "Thiết bị không hợp lệ",
        pathapikey: "/api/apikey/create",
        pathregdevice: "/api/devices/register",
        useragent: "BonApp/2.6.9",
        pathsumbit: "/submit",
        pathatackdevice: "/attack",
        pathloginkey: "/login",
        paththongbaomoi: "/notice/latest",
        path50thongbao: "/notice/list",
        pathenfbgolike: "/fb",
        pathcaptcha: "/captcha",
        pathgolike: "/golike",
        pathfb: "/fb",
        pathtds: "/tds",
        pathig: "/ig",
        pathttc: "/ttc",
        pathtiktok: "/tiktok",
        listapi: []
    });
}
    //==============//getstrings2.sec//========

    if (pathname === "/getstrings2.sec") {

    const apiKey = parsedUrl.query.key;
    const pubBase64 = parsedUrl.query.pub;

    if (!apiKey || !pubBase64) {
        return sendJSON(res, { ok:false });
    }

    const record = database.keys[apiKey];

    if (!record || record.status !== "verified") {
        return sendJSON(res, { ok:false });
    }

    const nowTime = now();

    if (!record.expires_at || record.expires_at <= nowTime) {
        record.expires_at = nowTime + 86400;
        saveDB();
    }

    const remaining = record.expires_at - nowTime;

    try {

        const publicKey = crypto.createPublicKey({
            key: Buffer.from(pubBase64, "base64").toString("utf8"),
            format: "pem"
        });

        const aesKey = crypto.randomBytes(32);

        const payload = JSON.stringify({
            ok: true,
            remaining: remaining,
            expires_at: record.expires_at,
            server_time: nowTime,
            devices_used: record.devices ? record.devices.length : 0,
            device_limit: 2,
            crack: "OK"
        });

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

        const encryptedData = Buffer.concat([
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

        return sendJSON(res, {
            ok: true,
            ek: encryptedKey.toString("base64"),
            iv: iv.toString("base64"),
            ct: encryptedData.toString("base64"),
            tag: tag.toString("base64")
        });

    } catch (err) {
        return sendJSON(res, { ok:false });
    }
    }

// ================= SUBMIT (pathsumbit) =================
// ================= SUBMIT (pathsumbit) =================
if (pathname === "/pathsumbit") {
    return sendJSON(res, {
        items: []
    });
}





// ================= VERSION PAGE =================

if (pathname === "/" && parsedUrl.query.verision_app) {

    const version = parsedUrl.query.verision_app

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

