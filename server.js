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

let database = {
keys: {},
devices: {}
};

function now() {
return Math.floor(Date.now() / 1000);
}

function sendJSON(res,obj){
res.writeHead(200,{"Content-Type":"application/json"});
res.end(JSON.stringify(obj));
}

function normalize(path){
return path.replace(/\/+/g,"/");
}

function saveDB(){
fs.writeFileSync(DB_FILE,JSON.stringify(database,null,2));
}

function loadDB(){
try{
if(fs.existsSync(DB_FILE)){
const raw=fs.readFileSync(DB_FILE);
database=raw.length?JSON.parse(raw):{keys:{},devices:{}};
}
}catch{
database={keys:{},devices:{}};
}
}

loadDB();

function generateKey(){
const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let r="";
for(let i=0;i<6;i++){
r+=chars.charAt(Math.floor(Math.random()*chars.length));
}
return "MTOOLMAX-"+r;
}

function generateDeviceId(){
return crypto.randomBytes(16).toString("hex");
}

function createSignature(secretB64,data){
const secret=Buffer.from(secretB64,"base64");
return crypto.createHmac("sha1",secret).update(data,"utf8").digest("base64");
}

function verifySignature(secretB64,data,signature){
const expected=createSignature(secretB64,data);
return expected===signature;
}

function shortenLink(longUrl,callback){
const api=`https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`;
https.get(api,(resp)=>{
let data="";
resp.on("data",c=>data+=c);
resp.on("end",()=>{
try{
const j=JSON.parse(data);
callback(j);
}catch{
callback(null);
}
});
}).on("error",()=>callback(null));
}

function encryptPayload(pubBase64,payload){

const publicKey=crypto.createPublicKey({
key:Buffer.from(pubBase64,"base64").toString("utf8"),
format:"pem"
});

const aesKey=crypto.randomBytes(32);
const iv=crypto.randomBytes(12);

const cipher=crypto.createCipheriv("aes-256-gcm",aesKey,iv);

const encrypted=Buffer.concat([
cipher.update(JSON.stringify(payload),"utf8"),
cipher.final()
]);

const tag=cipher.getAuthTag();

const encryptedKey=crypto.publicEncrypt(
{
key:publicKey,
padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,
oaepHash:"sha1"
},
aesKey
);

return{
ok:true,
iv:iv.toString("base64"),
ct:encrypted.toString("base64"),
ek:encryptedKey.toString("base64"),
tag:tag.toString("base64")
};

}

const server=http.createServer((req,res)=>{

const parsed=url.parse(req.url,true);
const pathname=normalize(parsed.pathname);

if(pathname==="/server-time"){
return sendJSON(res,{server_time:now()});
}

if(pathname==="/api/apikey/create"){

const key=generateKey();

database.keys[key]={
key:key,
status:"pending",
created_at:now(),
expires_at:0,
device_id:null
};

saveDB();

const callback=`${BASE_URL}/api/apikey/callback?key=${key}`;

shortenLink(callback,(result)=>{

if(!result||result.status==="error"){
return sendJSON(res,{error:"Link4m error"});
}

return sendJSON(res,{
shortened_link:result.shortenedUrl||result.shortened_url
});

});

return;
}

if(pathname==="/api/apikey/callback"){

const key=parsed.query.key;

const rec=database.keys[key];

if(!rec){
res.writeHead(404);
return res.end("Key not found");
}

rec.status="verified";
rec.created_at=now();
rec.expires_at=now()+86400;

saveDB();

res.writeHead(302,{
Location:`${KEY_PAGE}?ma=${key}`
});

return res.end();

}

if(pathname==="/api/devices/register" && req.method==="POST"){

let body="";
req.on("data",c=>body+=c);

req.on("end",()=>{

let parsedBody={};

try{
parsedBody=JSON.parse(body);
}catch{}

const deviceId=parsedBody.device_id||generateDeviceId();

const secret=crypto.randomBytes(32).toString("base64");

database.devices[deviceId]={
device_id:deviceId,
secret:secret,
created_at:now(),
last_seen:now()
};

saveDB();

return sendJSON(res,{
ok:true,
device_id:deviceId,
client_secret_b64:secret,
created_at:new Date().toISOString(),
last_seen:new Date().toISOString(),
secret_rotated_at:new Date().toISOString()
});

});

return;
}

if(pathname.startsWith("/keys/") && pathname.endsWith(".sec")){

const apiKey=pathname.replace("/keys/","").replace(".sec","");

const pub=parsed.query.pub;

if(!pub){
return sendJSON(res,{ok:false});
}

const rec=database.keys[apiKey];

if(!rec||rec.status!=="verified"){
return sendJSON(res,{ok:false});
}

if(rec.expires_at<=now()){
return sendJSON(res,{ok:false,reason:"expired"});
}

const remaining=rec.expires_at-now();

const payload={
ok:true,
remaining:remaining,
key:apiKey,
expires_at:rec.expires_at,
device_limit:999999,
devices_used:rec.device_id?1:0,
is_expired:false,
devices:[
{
device_id:rec.device_id||"unknown",
label:"Device",
added_at:rec.created_at
}
],
hethan:"Key hết hạn",
crack:"OK",
keyhethan:"Key đã hết hạn",
keydahethan:"Key đã sử dụng",
thietbikhongcontrongkey:"Thiết bị không hợp lệ",
pathapikey:"/api/apikey/create",
pathregdevice:"/api/devices/register",
useragent:"BonApp/2.6.9",
pathsumbit:"/pathsumbit",
pathatackdevice:"/attack",
pathloginkey:"/login",
paththongbaomoi:"/notice/latest",
path50thongbao:"/notices",
pathenfbgolike:"/fb",
pathcaptcha:"/captcha",
pathgolike:"/golike",
pathfb:"/fb",
pathtds:"/tds",
pathig:"/ig",
pathttc:"/ttc",
pathtiktok:"/tiktok",
listapi:[
BASE_URL+"/"
]
};

try{
const encrypted=encryptPayload(pub,payload);
return sendJSON(res,encrypted);
}catch{
return sendJSON(res,{ok:false});
}

}

if(pathname==="/notices"){

return sendJSON(res,[
{
title:"Thông báo hệ thống",
message:"Server hoạt động ổn định",
versionName:"2.6.9",
created_at:Date.now()
},
{
title:"Cập nhật",
message:"Server riêng đã kích hoạt",
versionName:"2.6.9",
created_at:Date.now()
}
]);

}

if(pathname==="/notice/latest"){

return sendJSON(res,{
title:"Thông báo mới nhất",
message:"Server online",
versionName:"2.6.9",
created_at:Date.now()
});

}

if(pathname==="/config"){

return sendJSON(res,{
hethan:"Key hết hạn",
crack:"OK",
keyhethan:"Key đã hết hạn",
keydahethan:"Key đã sử dụng",
thietbikhongcontrongkey:"Thiết bị không hợp lệ",
pathapikey:"/api/apikey/create",
pathregdevice:"/api/devices/register",
useragent:"MToolMax-http",
pathsumbit:"/pathsumbit",
pathatackdevice:"/attack",
pathloginkey:"/login",
paththongbaomoi:"/notice/latest",
path50thongbao:"/notices",
pathenfbgolike:"/fb",
pathcaptcha:"/captcha",
pathgolike:"/golike",
pathfb:"/fb",
pathtds:"/tds",
pathig:"/ig",
pathttc:"/ttc",
pathtiktok:"/tiktok",
listapi:[
BASE_URL+"/"
]
});

}

if(pathname==="/pathsumbit"){
return sendJSON(res,{items:[]});
}

if(pathname==="/"){

res.writeHead(200,{"Content-Type":"text/html;charset=UTF-8"});

return res.end(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>BIBON KEY SERVER</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{
margin:0;
background:#000;
color:#00ffcc;
font-family:monospace;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
}
.box{
background:#0a0a0a;
padding:40px;
border-radius:12px;
box-shadow:0 0 30px #00ffcc33;
text-align:center;
}
button{
padding:12px 30px;
background:#00ffcc;
border:none;
border-radius:6px;
cursor:pointer;
font-weight:bold;
}
button:hover{
opacity:0.8;
}
</style>
</head>
<body>

<div class="box">
<h2>BIBON KEY SYSTEM</h2>
<p>Server Online</p>
<button onclick="getKey()">LẤY KEY FREE</button>
</div>

<script>
function getKey(){

fetch("/api/apikey/create")
.then(r=>r.json())
.then(d=>{

if(d.shortened_link){

let clean=d.shortened_link.replace("https://","");

let intent="intent://"+clean+"#Intent;scheme=https;package=com.android.chrome;end";

location.href=intent;

setTimeout(()=>{
location.href=d.shortened_link;
},1000);

}else{
alert("Lỗi tạo key");
}

});

}
</script>

</body>
</html>
`);

}

return sendJSON(res,{ok:true,uri:pathname});

});

server.listen(PORT,"0.0.0.0",()=>{
console.log("Server running on port",PORT);
});
