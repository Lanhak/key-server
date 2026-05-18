const express = require('express');
const os = require('os');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ========================================
// MEMORY DATABASE
// ========================================

let USER = {
    id: 1,
    username: "guest_user",
    name: "Guest User",
    coin: 1000,
    vip: false,
    token: "token_xxxxxx"
};

let JOBS = [
    {
        id: 1,
        type: "follow",
        username: "demo_user_1",
        reward: 100
    },
    {
        id: 2,
        type: "like",
        username: "demo_user_2",
        reward: 50
    },
    {
        id: 3,
        type: "share",
        username: "demo_user_3",
        reward: 70
    }
];

// ========================================
// COLORS
// ========================================

const C = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    reset: "\x1b[0m"
};

// ========================================
// BEAUTIFUL LOG
// ========================================

function line() {
    console.log(C.cyan + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + C.reset);
}

function logRequest(req) {

    line();

    console.log(
        C.green + "[API]" + C.reset,
        req.method,
        req.path
    );

    console.log(
        C.yellow + "[IP]" + C.reset,
        req.ip
    );

    console.log(
        C.blue + "[BODY]" + C.reset,
        JSON.stringify(req.body, null, 2)
    );

    line();
}

// ========================================
// LOGGER
// ========================================

app.use((req, res, next) => {

    logRequest(req);

    next();
});

// ========================================
// HEADER
// ========================================

app.use((req, res, next) => {

    res.setHeader("Content-Type", "application/json");

    next();
});

// ========================================
// HOME PAGE
// ========================================

app.get('/', (req, res) => {

    res.send(`
<!DOCTYPE html>
<html>
<head>

<title>Mock API Server</title>

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
    border-radius:15px;
    margin-bottom:20px;
    box-shadow:0 0 20px rgba(0,0,0,0.3);
}

h1{
    color:#38bdf8;
}

.api{
    background:#111827;
    padding:10px;
    border-radius:10px;
    margin-top:10px;
}

.green{
    color:#22c55e;
}

.orange{
    color:#f59e0b;
}

</style>

</head>

<body>

<div class="card">

<h1>🚀 MOCK API SERVER</h1>

<p class="green">
SERVER ONLINE
</p>

<p>
User : ${USER.username}
</p>

<p>
Coin : ${USER.coin}
</p>

<p>
VIP : ${USER.vip}
</p>

</div>

<div class="card">

<h2>📡 API LIST</h2>

<div class="api">GET /api/users/me</div>
<div class="api">GET /api/job</div>
<div class="api">POST /api/job/check_job_success</div>
<div class="api">POST /api/job/check-job-valid</div>
<div class="api">POST /api/devices/register</div>
<div class="api">POST /api/tiktok-account</div>
<div class="api">POST /api/fb-account</div>
<div class="api">POST /api/instagram-account</div>

</div>

<div class="card">

<h2>🖥 SERVER INFO</h2>

<p>Platform : ${os.platform()}</p>
<p>RAM : ${(os.totalmem()/1024/1024/1024).toFixed(2)} GB</p>
<p>Status : <span class="orange">RUNNING</span></p>

</div>

</body>
</html>
`);

});

// ========================================
// USER
// ========================================

app.get('/api/users/me', (req, res) => {

    res.json({
        success: true,
        data: USER
    });

});

// ========================================
// DEVICE REGISTER
// ========================================

app.post('/api/devices/register', (req, res) => {

    res.json({
        success: true,
        token: USER.token,
        device_id: "DEVICE_001"
    });

});

// ========================================
// JOB LIST
// ========================================

app.get('/api/job', (req, res) => {

    res.json({
        success: true,
        total: JOBS.length,
        jobs: JOBS
    });

});

// ========================================
// CHECK JOB VALID
// ========================================

app.post('/api/job/check-job-valid', (req, res) => {

    res.json({
        success: true,
        valid: true,
        message: "job valid"
    });

});

// ========================================
// CHECK JOB SUCCESS
// ========================================

app.post('/api/job/check_job_success', (req, res) => {

    USER.coin += 100;

    res.json({
        success: true,
        reward: 100,
        balance: USER.coin
    });

});

// ========================================
// TIKTOK ACCOUNT
// ========================================

app.post('/api/tiktok-account', (req, res) => {

    res.json({
        success: true,
        username: req.body.username || "guest_tiktok",
        connected: true
    });

});

// ========================================
// FACEBOOK ACCOUNT
// ========================================

app.post('/api/fb-account', (req, res) => {

    res.json({
        success: true,
        facebook_id: "100001",
        connected: true
    });

});

// ========================================
// INSTAGRAM ACCOUNT
// ========================================

app.post('/api/instagram-account', (req, res) => {

    res.json({
        success: true,
        instagram_id: "ig_001",
        connected: true
    });

});

// ========================================
// 404
// ========================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "API NOT FOUND"
    });

});

// ========================================
// START SERVER
// ========================================

const PORT = 3000;

app.listen(PORT, () => {

    console.clear();

    console.log(C.cyan);

    console.log(`
╔══════════════════════════════════════╗
║          MOCK API SERVER            ║
╠══════════════════════════════════════╣
║ STATUS : ONLINE                     ║
║ PORT   : ${PORT}                        ║
║ API    : ACTIVE                     ║
╚══════════════════════════════════════╝
`);

    console.log(C.reset);

});
