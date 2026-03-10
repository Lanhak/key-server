const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

const PORT = process.env.PORT || 3000;

const BASE_URL = "https://boon-tool-1-0.onrender.com";

const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";

const KEY_PAGE =
"https://lanhakk.blogspot.com/2026/01/lanh-ak.html";

const VERSION = "2.6.9";

const DB_FILE = "database.json";

let database = {};

// ================= LOAD DATABASE =================
try{
 if(fs.existsSync(DB_FILE)){
  const raw = fs.readFileSync(DB_FILE);
  database = raw.length ? JSON.parse(raw) : {};
 }
}catch{
 database = {};
}

function saveDB(){
 fs.writeFileSync(DB_FILE,JSON.stringify(database,null,2));
}

function now(){
 return Math.floor(Date.now()/1000);
}

function sendJSON(res,obj){
 res.writeHead(200,{"Content-Type":"application/json"});
 res.end(JSON.stringify(obj));
}

function normalize(path){
 return path.replace(/\/+/g,"/");
}

// ================= HMAC =================

function createSignature(secretB64,data){

 const secret = Buffer.from(secretB64,"base64");

 return crypto
  .createHmac("sha256",secret)
  .update(data,"utf8")
  .digest("base64");

}

function verifySignature(secretB64,data,sign){

 const expected = createSignature(secretB64,data);

 return expected === sign;

}

// ================= KEY GENERATOR =================

function generateKey(){

 const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

 let r="";

 for(let i=0;i<6;i++){
  r+=chars.charAt(Math.floor(Math.random()*chars.length));
 }

 return "MTOOLMAX-"+r;
}

// ================= LINK4M =================

function shortenLink(longUrl,cb){

 const api=
`https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(longUrl)}`;

 https.get(api,(resp)=>{

  let data="";

  resp.on("data",c=>data+=c);

  resp.on("end",()=>{

   try{

    const json=JSON.parse(data);

    cb(json);

   }catch{

    cb(null);

   }

  });

 }).on("error",()=>cb(null));

}

// ================= SERVER =================

const server=http.createServer((req,res)=>{

 const parsed=url.parse(req.url,true);

 const pathname=normalize(parsed.pathname);

 console.log("REQ",req.method,pathname);

 // ================= SERVER TIME =================

 if(pathname==="/server-time"){

  return sendJSON(res,{
   server_time:now()
  });

 }

 // ================= CREATE KEY =================

 if(pathname==="/api/apikey/create"){

  const key=generateKey();

  database[key]={

   key:key,

   status:"pending",

   created_at:now(),

   expires_at:0,

   device_limit:2,

   devices:[]

  };

  saveDB();

  const callback=
`${BASE_URL}/api/apikey/callback?key=${key}`;

  shortenLink(callback,(result)=>{

   if(!result){

    return sendJSON(res,{error:"link4m error"});

   }

   return sendJSON(res,{
    shortened_link:
     result.shortenedUrl||
     result.shortened_url
   });

  });

  return;
 }

 // ================= CALLBACK VERIFY =================

 if(pathname==="/api/apikey/callback"){

  const key=parsed.query.key;

  const record=database[key];

  if(!record){

   return res.end("Key not found");

  }

  record.status="verified";

  const t=now();

  record.created_at=t;

  record.expires_at=t+86400;

  saveDB();

  res.writeHead(302,{
   Location:`${KEY_PAGE}?ma=${key}`
  });

  return res.end();

 }

 // ================= REGISTER DEVICE =================

 if(pathname==="/api/devices/register" && req.method==="POST"){

  let body="";

  req.on("data",c=>body+=c);

  req.on("end",()=>{

   let parsed;

   try{parsed=JSON.parse(body);}catch{parsed={};}

   const deviceId=
    parsed.device_id||
    crypto.randomBytes(16).toString("hex");

   const secret=
    crypto.randomBytes(32).toString("base64");

   if(!database.__devices){

    database.__devices={};

   }

   database.__devices[deviceId]={

    device_id:deviceId,

    secret:secret,

    created_at:now()

   };

   saveDB();

   return sendJSON(res,{

    ok:true,

    device_id:deviceId,

    client_secret_b64:secret

   });

  });

  return;

 }

 // ================= ATTACH DEVICE =================

 if(
  pathname.startsWith("/keys/") &&
  pathname.endsWith("/devices") &&
  req.method==="POST"
 ){

  const key=pathname.split("/")[2];

  let body="";

  req.on("data",c=>body+=c);

  req.on("end",()=>{

   let parsed;

   try{parsed=JSON.parse(body);}catch{parsed={};}

   const deviceId=parsed.device_id;

   if(!deviceId){

    return sendJSON(res,{ok:false});

   }

   const record=database[key];

   if(!record){

    return sendJSON(res,{ok:false});

   }

   if(!database.__devices ||
      !database.__devices[deviceId]){

    return sendJSON(res,{
     ok:false,
     message:"device not registered"
    });

   }

   if(!record.devices)record.devices=[];

   if(!record.devices.includes(deviceId)){

    if(record.devices.length>=record.device_limit){

     return sendJSON(res,{
      ok:false,
      message:"device limit reached"
     });

    }

    record.devices.push(deviceId);

   }

   saveDB();

   return sendJSON(res,{
    ok:true,
    devices_used:record.devices.length,
    devices_remaining:
     record.device_limit-record.devices.length
   });

  });

  return;

 }

 // ================= KEY.SEC =================

 if(
  pathname.startsWith("/keys/") &&
  pathname.endsWith(".sec")
 ){

  const apiKey=
   pathname.replace("/keys/","").replace(".sec","");

  const pubBase64=parsed.query.pub;

  if(!pubBase64){

   return sendJSON(res,{ok:false});

  }

  const record=database[apiKey];

  if(!record || record.status!=="verified"){

   return sendJSON(res,{ok:false});

  }

  const nowTime=now();

  if(!record.expires_at || record.expires_at<=nowTime){

   record.expires_at=nowTime+86400;

   saveDB();

  }

  const remaining=record.expires_at-nowTime;

  try{

   const publicKey=crypto.createPublicKey({

    key:Buffer.from(pubBase64,"base64").toString("utf8"),

    format:"pem"

   });

   const aesKey=crypto.randomBytes(32);

   const payload=JSON.stringify({

    ok:true,

    key:apiKey,

    remaining:remaining,

    expires_at:record.expires_at,

    device_limit:record.device_limit,

    devices_used:
     record.devices?record.devices.length:0,

    versionName:VERSION,

    config:{

     hethan:"Key hết hạn",

     crack:"OK",

     keyhethan:"Key đã hết hạn",

     keydahethan:"Key đã sử dụng",

     thietbikhongcontrongkey:"Thiết bị không hợp lệ",

     pathapikey:"/api/apikey/create",

     pathregdevice:"/api/devices/register",

     useragent:"BonApp/"+VERSION,

     pathsumbit:"/submit",

     pathloginkey:"/login",

     paththongbaomoi:"/notice/latest",

     path50thongbao:"/notice/list",

     pathcaptcha:"/captcha",

     pathfb:"/fb",

     pathtds:"/tds",

     pathig:"/ig",

     pathttc:"/ttc",

     pathtiktok:"/tiktok",

     listapi:[]

    }

   });

   const iv=crypto.randomBytes(12);

   const cipher=
    crypto.createCipheriv("aes-256-gcm",aesKey,iv);

   const encryptedData=Buffer.concat([

    cipher.update(payload,"utf8"),

    cipher.final()

   ]);

   const tag=cipher.getAuthTag();

   const encryptedKey=crypto.publicEncrypt({

    key:publicKey,

    padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,

    oaepHash:"sha1"

   },aesKey);

   return sendJSON(res,{

    ok:true,

    iv:iv.toString("base64"),

    ct:encryptedData.toString("base64"),

    ek:encryptedKey.toString("base64"),

    tag:tag.toString("base64")

   });

  }

  catch{

   return sendJSON(res,{ok:false});

  }

 }

// ================= HOME PAGE =================

if(pathname==="/"){

 const totalKeys =
  Object.keys(database)
   .filter(k=>k!=="__devices").length;

 const totalDevices =
  database.__devices ?
  Object.keys(database.__devices).length : 0;

 res.writeHead(200,{
  "Content-Type":"text/html"
 });

 return res.end(`

<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">

<title>BON TOOL SERVER</title>

<style>

body{
 background:#0f172a;
 font-family:Arial;
 color:white;
 display:flex;
 align-items:center;
 justify-content:center;
 height:100vh;
 margin:0;
}

.card{
 background:#1e293b;
 padding:40px;
 border-radius:14px;
 width:420px;
 text-align:center;
 box-shadow:0 15px 40px rgba(0,0,0,0.6);
}

h1{
 margin-top:0;
}

button{
 background:#22c55e;
 border:none;
 padding:14px 24px;
 border-radius:10px;
 color:white;
 font-size:16px;
 cursor:pointer;
 margin-top:15px;
}

button:hover{
 background:#16a34a;
}

.stat{
 margin-top:12px;
 font-size:14px;
 opacity:.8;
}

.version{
 margin-top:18px;
 font-size:13px;
 opacity:.6;
}

.link{
 margin-top:15px;
 word-break:break-all;
}

</style>

</head>

<body>

<div class="card">

<h1>🚀 BON TOOL SERVER</h1>

<p>Tạo key để sử dụng ứng dụng</p>

<button onclick="createKey()">
TẠO KEY
</button>

<div id="result" class="link"></div>

<div class="stat">
🔑 Tổng key: ${totalKeys}
</div>

<div class="stat">
📱 Tổng device: ${totalDevices}
</div>

<div class="version">
Server Version ${VERSION}
</div>

</div>

<script>

function createKey(){

 fetch('/api/apikey/create')

 .then(r=>r.json())

 .then(d=>{

  if(d.shortened_link){

   document.getElementById("result").innerHTML =
   '<a href="'+d.shortened_link+'" style="color:#38bdf8">'+
   d.shortened_link+'</a>';

  }

 });

}

</script>

</body>
</html>

`);

}
 // ================= FALLBACK =================

 return sendJSON(res,{ok:true});

});

// ================= START =================

server.listen(PORT,"0.0.0.0",()=>{

 console.log("Server running",PORT);

});
