
const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const fs = require("fs")
const crypto = require("crypto")

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ extended: true }))

const DB = "database.json"

function loadDB() {

    if (!fs.existsSync(DB)) {

        fs.writeFileSync(DB, JSON.stringify({
            keys: [],
            devices: [],
            logs: []
        }, null, 2))
    }

    return JSON.parse(fs.readFileSync(DB))
}

function saveDB(data) {
    fs.writeFileSync(DB, JSON.stringify(data, null, 2))
}

function randomKey() {
    return crypto.randomBytes(16).toString("hex")
}

function randomToken() {
    return crypto.randomBytes(32).toString("hex")
}

app.use((req, res, next) => {

    try {

        const db = loadDB()

        db.logs.push({
            time: Date.now(),
            path: req.path,
            method: req.method,
            body: req.body,
            headers: req.headers
        })

        saveDB(db)

    } catch(e) {}

    next()
})

app.get("/", (req, res) => {

    res.send(`
    <html>
    <head>
        <title>MTool Server</title>
        <style>
            body{
                background:#0f172a;
                color:white;
                font-family:Arial;
                padding:30px;
            }

            .card{
                background:#1e293b;
                padding:20px;
                border-radius:20px;
                margin-bottom:20px;
            }
        </style>
    </head>

    <body>

        <div class="card">
            <h1>MTOOL SERVER ONLINE</h1>
            <p>Status: ONLINE</p>
        </div>

        <div class="card">
            <h2>Total Endpoints</h2>
            <p>68</p>
        </div>

    </body>
    </html>
    `)
})

app.get("/server-time", (req, res) => {

    res.json({
        success: true,
        timestamp: Math.floor(Date.now() / 1000),
        timezone: "Asia/Ho_Chi_Minh",
        server: "online"
    })
})

app.get("/ping", (req, res) => {

    res.json({
        success: true,
        message: "pong",
        status: 200
    })
})

app.get("/status", (req, res) => {

    res.json({
        success: true,
        online: true,
        maintenance: false
    })
})

app.get("/config", (req, res) => {

    res.json({
        success: true,
        premium: true,
        maintenance: false,
        version: "99.0.0"
    })
})

app.post("/generate", (req, res) => {

    const db = loadDB()

    const key = randomKey()

    db.keys.push({
        key,
        device_id: req.body.device_id || "unknown",
        premium: true,
        active: true,
        created_at: Date.now()
    })

    saveDB(db)

    res.json({
        success: true,
        key,
        premium: true,
        expires: "2099-12-31"
    })
})

app.post("/verify", (req, res) => {

    const db = loadDB()

    const found = db.keys.find(x =>
        x.key == req.body.key
    )

    if (!found) {

        return res.json({
            success: false,
            valid: false
        })
    }

    res.json({
        success: true,
        valid: true,
        premium: true,
        expires: "2099-12-31"
    })
})


app.all("/0396785304", (req, res) => {

    res.json({
        success: true,
        endpoint: "/0396785304",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/?lang=vi", (req, res) => {

    res.json({
        success: true,
        endpoint: "/?lang=vi",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/@", (req, res) => {

    res.json({
        success: true,
        endpoint: "/@",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/@codevuong", (req, res) => {

    res.json({
        success: true,
        endpoint: "/@codevuong",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/aapt", (req, res) => {

    res.json({
        success: true,
        endpoint: "/aapt",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/accounts/edit/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/accounts/edit/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/accounts/emailsignup/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/accounts/emailsignup/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/address.api.php", (req, res) => {

    res.json({
        success: true,
        endpoint: "/address.api.php",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api.php", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api.php",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/?fields=", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/?fields=",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/?fields=tiktok_run&id=", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/?fields=tiktok_run&id=",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/advertising/publishers/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/advertising/publishers/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/advertising/publishers/tiktok/jobs?account_id=", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/advertising/publishers/tiktok/jobs?account_id=",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/coin/?type=", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/coin/?type=",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/fb-account", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/fb-account",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/fb-account/verify-account", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/fb-account/verify-account",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/graphql/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/graphql/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/instagram-account", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/instagram-account",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/job", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/job",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/job/check-job-valid", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/job/check-job-valid",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/job/check_job_success", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/job/check_job_success",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/report/send", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/report/send",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/statistics/report", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/statistics/report",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/tiktok-account", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/tiktok-account",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/users/me", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/users/me",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/v1/users/web_profile_info/?username=", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/v1/users/web_profile_info/?username=",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/v1/web/accounts/edit/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/v1/web/accounts/edit/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/v1/web/accounts/web_change_profile_picture/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/v1/web/accounts/web_change_profile_picture/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/v1/web/accounts/web_create_ajax/attempt/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/v1/web/accounts/web_create_ajax/attempt/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/api/v1/web/friendships/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/api/v1/web/friendships/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/apk/res-auto", (req, res) => {

    res.json({
        success: true,
        endpoint: "/apk/res-auto",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/apk/res/android", (req, res) => {

    res.json({
        success: true,
        endpoint: "/apk/res/android",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/app/version", (req, res) => {

    res.json({
        success: true,
        endpoint: "/app/version",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/auth", (req, res) => {

    res.json({
        success: true,
        endpoint: "/auth",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/createTask", (req, res) => {

    res.json({
        success: true,
        endpoint: "/createTask",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/device/bind", (req, res) => {

    res.json({
        success: true,
        endpoint: "/device/bind",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/device/check", (req, res) => {

    res.json({
        success: true,
        endpoint: "/device/check",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/g/qqfrph952", (req, res) => {

    res.json({
        success: true,
        endpoint: "/g/qqfrph952",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/getTaskResult", (req, res) => {

    res.json({
        success: true,
        endpoint: "/getTaskResult",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/golike/mahoa", (req, res) => {

    res.json({
        success: true,
        endpoint: "/golike/mahoa",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/google/gson/blob/main/Troubleshooting.md#", (req, res) => {

    res.json({
        success: true,
        endpoint: "/google/gson/blob/main/Troubleshooting.md#",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/graphql/query", (req, res) => {

    res.json({
        success: true,
        endpoint: "/graphql/query",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/groups/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/groups/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/home/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/home/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/ip", (req, res) => {

    res.json({
        success: true,
        endpoint: "/ip",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/ip.json", (req, res) => {

    res.json({
        success: true,
        endpoint: "/ip.json",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/keys", (req, res) => {

    res.json({
        success: true,
        endpoint: "/keys",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/keys/check", (req, res) => {

    res.json({
        success: true,
        endpoint: "/keys/check",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/licenses/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/licenses/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/m/?lang=vi", (req, res) => {

    res.json({
        success: true,
        endpoint: "/m/?lang=vi",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/me", (req, res) => {

    res.json({
        success: true,
        endpoint: "/me",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/notice/latest", (req, res) => {

    res.json({
        success: true,
        endpoint: "/notice/latest",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/notices", (req, res) => {

    res.json({
        success: true,
        endpoint: "/notices",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/scr/login.php", (req, res) => {

    res.json({
        success: true,
        endpoint: "/scr/login.php",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/scr/tiktok_add.php", (req, res) => {

    res.json({
        success: true,
        endpoint: "/scr/tiktok_add.php",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/scr/user.php", (req, res) => {

    res.json({
        success: true,
        endpoint: "/scr/user.php",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/token/verify", (req, res) => {

    res.json({
        success: true,
        endpoint: "/token/verify",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/view/chtiktok/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/view/chtiktok/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/view/setting/", (req, res) => {

    res.json({
        success: true,
        endpoint: "/view/setting/",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.all("/view/setting/load.php", (req, res) => {

    res.json({
        success: true,
        endpoint: "/view/setting/load.php",
        method: req.method,
        premium: true,
        status: 200,
        timestamp: Date.now()
    })
})


app.use((req, res) => {

    res.status(200).json({
        success: false,
        message: "endpoint not found",
        path: req.path
    })
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
