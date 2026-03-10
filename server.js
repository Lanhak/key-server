const http = require("http")
const url = require("url")
const crypto = require("crypto")
const fs = require("fs")

const PORT = process.env.PORT || 3000
const DB_FILE = "database.json"

let database = {}

// ================= LOAD DATABASE =================
if (fs.existsSync(DB_FILE)) {
    try {
        database = JSON.parse(fs.readFileSync(DB_FILE))
    } catch {
        database = {}
    }
}

function saveDB(){
    fs.writeFileSync(DB_FILE,JSON.stringify(database,null,2))
}

function now(){
    return Math.floor(Date.now()/1000)
}

function sendJSON(res,obj){

    const body = JSON.stringify(obj,null,4)

    res.writeHead(200,{
        "Content-Type":"application/json",
        "Content-Length":Buffer.byteLength(body)
    })

    res.end(body)
}

// ================= CREATE KEY =================
function generateKey(){

    const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    let r=""

    for(let i=0;i<6;i++){
        r+=chars[Math.floor(Math.random()*chars.length)]
    }

    return "MTOOLMAX-"+r
}

// ================= SERVER =================
const server = http.createServer((req,res)=>{

const parsedUrl = url.parse(req.url,true)
const pathname = parsedUrl.pathname

console.log(req.method,pathname)

// ================= SERVER TIME =================
if(pathname==="/server-time"){

    return sendJSON(res,{
        server_time:now()
    })
}

// ================= CREATE KEY =================
if(pathname==="/api/apikey/create"){

    const key = generateKey()
    const time = now()

    database[key]={
        id:Object.keys(database).length+1,
        token:key,
        created_time:time,
        expired:time+86400,
        devices:[]
    }

    saveDB()

    return sendJSON(res,{
        ok:true,
        key:key
    })
}

// ================= DEVICE REGISTER =================
if(pathname==="/api/devices/register" && req.method==="POST"){

    let body=""

    req.on("data",c=>body+=c)

    req.on("end",()=>{

        let data

        try{
            data=JSON.parse(body)
        }catch{
            data={}
        }

        const device_id = data.device_id || crypto.randomBytes(16).toString("hex")

        return sendJSON(res,{
            ok:true,
            device_id:device_id
        })

    })

    return
}

// ================= DEVICE ADD =================
if(
pathname.startsWith("/keys/") &&
pathname.endsWith("/devices") &&
req.method==="POST"
){

    const apiKey = pathname.split("/")[2]

    let body=""

    req.on("data",c=>body+=c)

    req.on("end",()=>{

        let data

        try{
            data=JSON.parse(body)
        }catch{
            data={}
        }

        const device_id = data.device_id

        const record = database[apiKey]

        if(!record){
            return sendJSON(res,{ok:false})
        }

        if(!record.devices){
            record.devices=[]
        }

        if(device_id && !record.devices.includes(device_id)){
            record.devices.push(device_id)
        }

        saveDB()

        return sendJSON(res,{
            id:record.id,
            token:record.token,
            expired:record.expired,
            created_time:record.created_time,
            devices_used:record.devices.length,
            devices_remaining:2-record.devices.length
        })

    })

return
}

// ================= KEY CHECK (APP CALL) =================
if(
pathname.startsWith("/keys/") &&
pathname.endsWith(".sec")
){

    const apiKey = pathname
        .replace("/keys/","")
        .replace(".sec","")

    const pubBase64 = parsedUrl.query.pub

    const record = database[apiKey]

    if(!record){
        return sendJSON(res,{ok:false})
    }

    const nowTime = now()

    const remaining = record.expired - nowTime

    if(remaining<=0){
        return sendJSON(res,{ok:false})
    }

    if(!record.devices){
        record.devices=[]
    }

    // DEBUG TEST
    if(pubBase64==="test"){

        return sendJSON(res,{
            ok:true,
            remaining:remaining,
            expired:record.expired,
            server_time:nowTime,
            key:apiKey,
            devices_used:record.devices.length,
            device_limit:2
        })
    }

    try{

        const publicKey = crypto.createPublicKey({
            key:Buffer.from(pubBase64,"base64").toString("utf8"),
            format:"pem"
        })

        const payload = JSON.stringify({

            ok:true,

            remaining:remaining,
            expired:record.expired,
            server_time:nowTime,

            key:apiKey,

            devices_used:record.devices.length,
            device_limit:2,

            is_expired:false,

            devices:record.devices.map(d=>({
                device_id:d,
                label:"Device",
                added_at:nowTime
            }))

        })

        const aesKey = crypto.randomBytes(32)

        const iv = crypto.randomBytes(12)

        const cipher = crypto.createCipheriv(
            "aes-256-gcm",
            aesKey,
            iv
        )

        const encrypted = Buffer.concat([
            cipher.update(payload,"utf8"),
            cipher.final()
        ])

        const tag = cipher.getAuthTag()

        const encryptedKey = crypto.publicEncrypt(
            {
                key:publicKey,
                padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash:"sha1"
            },
            aesKey
        )

        return sendJSON(res,{
            ok:true,
            ek:encryptedKey.toString("base64"),
            iv:iv.toString("base64"),
            ct:encrypted.toString("base64"),
            tag:tag.toString("base64")
        })

    }catch{

        return sendJSON(res,{ok:false})

    }

}

// ================= ROOT =================
if(pathname==="/"){

res.writeHead(200,{
    "Content-Type":"text/html"
})

return res.end("<h2>MToolMax Key Server Running</h2>")

}

sendJSON(res,{ok:false})

})

server.listen(PORT,()=>{
console.log("Server running on",PORT)
})
