const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const fs = require("fs")
const crypto = require("crypto")
const axios = require("axios")
const { v4: uuidv4 } = require("uuid")

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"))
app.set("view engine", "ejs")

const DB_FILE = "database.json"

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({
            keys: [],
            devices: []
        }, null, 2))
    }

    return JSON.parse(fs.readFileSync(DB_FILE))
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

function randomKey() {
    return crypto.randomBytes(16).toString("hex")
}

app.get("/", (req, res) => {
    const db = loadDB()

    res.send(`
    <html>
    <head>
        <title>Key Server</title>
        <style>
            body{
                background:#0f172a;
                color:white;
                font-family:Arial;
                padding:40px;
            }

            .card{
                background:#1e293b;
                padding:20px;
                border-radius:15px;
                margin-bottom:20px;
            }

            button{
                padding:12px;
                border:none;
                border-radius:10px;
                background:#2563eb;
                color:white;
                cursor:pointer;
            }
        </style>
    </head>

    <body>
        <h1>KEY SERVER ONLINE</h1>

        <div class="card">
            <h2>Total Keys: ${db.keys.length}</h2>
            <h2>Total Devices: ${db.devices.length}</h2>
        </div>

        <div class="card">
            <h2>API STATUS</h2>
            <p>Server Running Successfully</p>
        </div>
    </body>
    </html>
    `)
})

// Generate key
app.post("/generate", async (req, res) => {
    try {
        const { device_id } = req.body

        if (!device_id) {
            return res.json({
                success: false,
                message: "device_id required"
            })
        }

        // Link4m verify
        const LINK4M_API = "6899fc9d171a1f07277dde22"

        const key = randomKey()

        const db = loadDB()

        db.keys.push({
            key,
            device_id,
            created_at: Date.now(),
            active: true
        })

        saveDB(db)

        res.json({
            success: true,
            key,
            device_id,
            expires_in: "30d",
            message: "Key generated"
        })

    } catch (e) {
        res.json({
            success: false,
            error: e.toString()
        })
    }
})

// Verify key
app.post("/verify", (req, res) => {
    try {
        const { key, device_id } = req.body

        const db = loadDB()

        const found = db.keys.find(x =>
            x.key === key &&
            x.device_id === device_id &&
            x.active === true
        )

        if (!found) {
            return res.json({
                success: false,
                valid: false,
                message: "Invalid key"
            })
        }

        res.json({
            success: true,
            valid: true,
            premium: true,
            expires: "2099-12-31",
            device_id
        })

    } catch (e) {
        res.json({
            success: false,
            error: e.toString()
        })
    }
})

// Register device
app.post("/register-device", (req, res) => {

    const {
        device_id,
        model,
        brand,
        android
    } = req.body

    const db = loadDB()

    const exist = db.devices.find(x => x.device_id === device_id)

    if (!exist) {
        db.devices.push({
            id: uuidv4(),
            device_id,
            model,
            brand,
            android,
            created_at: Date.now()
        })

        saveDB(db)
    }

    res.json({
        success: true,
        registered: true
    })
})

// SERVER TIME
app.get("/server-time", (req, res) => {
    res.json({
        success: true,
        timestamp: Math.floor(Date.now() / 1000),
        time: new Date().toISOString(),
        timezone: "Asia/Ho_Chi_Minh",
        server: "online"
    })
})

// PING
app.get("/ping", (req, res) => {
    res.json({
        success: true,
        message: "pong",
        status: 200
    })
})

// STATUS
app.get("/status", (req, res) => {
    res.json({
        success: true,
        online: true,
        api: true,
        maintenance: false
    })
})

// GET ALL KEYS
app.get("/keys", (req, res) => {
    const db = loadDB()

    res.json({
        success: true,
        total: db.keys.length,
        data: db.keys
    })
})

// GET DEVICE KEY
app.get("/keys/:device", (req, res) => {

    const device = req.params.device

    const db = loadDB()

    const found = db.keys.find(x => x.device_id === device)

    if (!found) {
        return res.json({
            success: false,
            valid: false
        })
    }

    res.json({
        success: true,
        valid: true,
        key: found.key,
        premium: true,
        expires: "2099-12-31"
    })
})

// CHECK KEY
app.post("/keys/check", (req, res) => {

    const { key } = req.body

    const db = loadDB()

    const found = db.keys.find(x => x.key === key)

    res.json({
        success: !!found,
        valid: !!found,
        premium: !!found
    })
})

// DEVICE CHECK
app.post("/device/check", (req, res) => {

    const { device_id } = req.body

    const db = loadDB()

    const found = db.devices.find(x => x.device_id === device_id)

    res.json({
        success: true,
        exists: !!found,
        device_id
    })
})

// DEVICE BIND
app.post("/device/bind", (req, res) => {

    const { key, device_id } = req.body

    const db = loadDB()

    const found = db.keys.find(x => x.key === key)

    if (!found) {
        return res.json({
            success: false,
            message: "invalid key"
        })
    }

    found.device_id = device_id

    saveDB(db)

    res.json({
        success: true,
        bind: true
    })
})

// AUTH
app.post("/auth", (req, res) => {

    const token = crypto.randomBytes(32).toString("hex")

    res.json({
        success: true,
        token,
        expired: false,
        premium: true
    })
})

// VERIFY TOKEN
app.post("/token/verify", (req, res) => {

    res.json({
        success: true,
        valid: true,
        premium: true
    })
})

// VERSION
app.get("/app/version", (req, res) => {

    res.json({
        success: true,
        version: "99.0.0",
        force_update: false,
        update_url: ""
    })
})

// NOTICE LIST
app.get("/notices", (req, res) => {

    res.json({
        success: true,
        data: [
            {
                title: "Server Online",
                content: "Welcome",
                created_at: Date.now()
            }
        ]
    })
})

// MAHOA
app.post("/golike/mahoa", (req, res) => {

    const { text } = req.body

    const encoded = Buffer.from(text || "").toString("base64")

    res.json({
        success: true,
        original: text,
        encoded
    })
})

// Notice endpoint
app.get("/notice/latest", (req, res) => {
    res.json({
        success: true,
        title: "Server Online",
        message: "Welcome To New Server",
        version: "1.0.0"
    })
})

// Config endpoint
app.get("/config", (req, res) => {
    res.json({
        success: true,
        api: "online",
        maintenance: false,
        min_version: "1.0.0"
    })
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
