const http = require("http")
const url = require("url")
const crypto = require("crypto")
const fs = require("fs")

const PORT = process.env.PORT || 3000
const DB_FILE = "database.json"

let database = {}

if (fs.existsSync(DB_FILE)) {
    try {
        database = JSON.parse(fs.readFileSync(DB_FILE))
    } catch {
        database = {}
    }
}

function saveDB(){
    fs.writeFileSync(DB_FILE, JSON.stringify(database,null,2))
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

function generateKey(){

    const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    let r=""

    for(let i=0;i<6;i++){
        r+=chars[Math.floor(Math.random()*chars.length)]
    }

    return "MTOOLMAX-"+r
}

const server = http.createServer((req,res)=>{

const parsedUrl = url.parse(req.url,true)
const pathname = parsedUrl.pathname

console.log(req.method,pathname)

//================ SERVER TIME =================

if(pathname==="/server-time"){
    return sendJSON(res,{
        server_time:now()
    })
}

//================ CREATE KEY =================

if(pathname==="/api/apikey/create"){

    const key = generateKey()
    const time = now()

    database[key]={
        token:key,
        created_time:time,
        expired:time+86400,
        devices:[]
    }

    saveDB()

    return sendJSON(res,{
        ok:true,
        key:key,
        expired:time+86400
    })
}

//================ REGISTER DEVICE =================

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

const device_id =
data.device_id ||
crypto.randomBytes(16).toString("hex")

if(!database.__devices){
database.__devices={}
}

database.__devices[device_id]={
device_id:device_id,
created:now()
}

saveDB()

return sendJSON(res,{
ok:true,
device_id:device_id
})

})

return
}

//================ ADD DEVICE TO KEY =================

if(
pathname.startsWith("/keys/") &&
pathname.endsWith("/devices") &&
req.method==="POST"
){

const key = pathname.split("/")[2]

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

const record = database[key]

if(!record){
return sendJSON(res,{ok:false})
}

if(!record.devices){
record.devices=[]
}

if(record.devices.length>=2){
return sendJSON(res,{
ok:false,
message:"device limit"
})
}

if(!record.devices.includes(device_id)){
record.devices.push(device_id)
}

saveDB()

return sendJSON(res,{
ok:true,
devices_used:record.devices.length,
devices_remaining:2-record.devices.length
})

})

return
}

//================ KEY CHECK =================

if(
pathname.startsWith("/keys/") &&
pathname.endsWith(".sec")
){

const key = pathname
.replace("/keys/","")
.replace(".sec","")

const record = database[key]

if(!record){
return sendJSON(res,{ok:false})
}

const time = now()

if(time>=record.expired){
return sendJSON(res,{
ok:false,
is_expired:true
})
}

const remaining = record.expired-time

return sendJSON(res,{
ok:true,
remaining:remaining,
expired:record.expired,
server_time:time,
key:key,
device_limit:2,
devices_used:record.devices.length,
is_expired:false
})

}

//================ NOT FOUND =================

sendJSON(res,{ok:false})

})

server.listen(PORT,()=>{
console.log("Server running",PORT)
})
