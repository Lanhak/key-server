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

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>AI MOCK SERVER</title>

<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{
    background:#020617;
    color:white;
    font-family:'Poppins',sans-serif;
    overflow-x:hidden;
}

/* ========================= */
/* BACKGROUND */
/* ========================= */

.bg{
    position:fixed;
    width:100%;
    height:100%;
    top:0;
    left:0;
    background:
    radial-gradient(circle at top left,#0ea5e955,transparent 30%),
    radial-gradient(circle at bottom right,#7c3aed55,transparent 30%);
    z-index:-1;
}

/* ========================= */
/* HEADER */
/* ========================= */

header{
    padding:25px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.08);
    backdrop-filter:blur(10px);
}

.logo{
    font-size:28px;
    font-weight:700;
    color:#38bdf8;
}

.status{
    padding:10px 18px;
    border-radius:999px;
    background:#16a34a22;
    color:#4ade80;
    border:1px solid #22c55e44;
    font-size:14px;
}

/* ========================= */
/* MAIN */
/* ========================= */

.container{
    max-width:1200px;
    margin:auto;
    padding:40px 20px;
}

.grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
    gap:25px;
}

.card{
    background:rgba(15,23,42,0.7);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:24px;
    padding:25px;
    backdrop-filter:blur(20px);
    transition:0.3s;
    box-shadow:0 10px 30px rgba(0,0,0,0.4);
}

.card:hover{
    transform:translateY(-5px);
    border-color:#38bdf8;
}

.card h2{
    font-size:22px;
    margin-bottom:20px;
    color:#38bdf8;
}

.info{
    margin-bottom:15px;
}

.label{
    color:#94a3b8;
    font-size:14px;
}

.value{
    margin-top:5px;
    font-size:18px;
    font-weight:600;
}

/* ========================= */
/* API LIST */
/* ========================= */

.api-list{
    display:flex;
    flex-direction:column;
    gap:14px;
}

.api{
    background:#0f172a;
    border-radius:14px;
    padding:14px;
    border:1px solid rgba(255,255,255,0.05);
    transition:0.3s;
}

.api:hover{
    border-color:#38bdf8;
    transform:scale(1.02);
}

.method{
    font-size:12px;
    font-weight:700;
    padding:5px 10px;
    border-radius:999px;
    display:inline-block;
    margin-bottom:10px;
}

.get{
    background:#16a34a22;
    color:#4ade80;
}

.post{
    background:#ea580c22;
    color:#fb923c;
}

.path{
    font-size:15px;
    word-break:break-all;
}

/* ========================= */
/* FOOTER */
/* ========================= */

footer{
    text-align:center;
    padding:40px;
    color:#64748b;
    font-size:14px;
}

/* ========================= */
/* ANIMATION */
/* ========================= */

.fade{
    animation:fade 1s ease;
}

@keyframes fade{
    from{
        opacity:0;
        transform:translateY(20px);
    }
    to{
        opacity:1;
        transform:translateY(0);
    }
}

</style>
</head>

<body>

<div class="bg"></div>

<header>

<div class="logo">
🚀 AI MOCK SERVER
</div>

<div class="status">
● ONLINE
</div>

</header>

<div class="container">

<div class="grid fade">

<!-- ================= -->
<!-- USER CARD -->
<!-- ================= -->

<div class="card">

<h2>👤 User Info</h2>

<div class="info">
<div class="label">Username</div>
<div class="value">guest_user</div>
</div>

<div class="info">
<div class="label">Coin</div>
<div class="value">1000</div>
</div>

<div class="info">
<div class="label">VIP</div>
<div class="value">False</div>
</div>

<div class="info">
<div class="label">Token</div>
<div class="value">
token_xxxxx
</div>
</div>

</div>

<!-- ================= -->
<!-- SERVER CARD -->
<!-- ================= -->

<div class="card">

<h2>🖥 Server Info</h2>

<div class="info">
<div class="label">Platform</div>
<div class="value">Linux</div>
</div>

<div class="info">
<div class="label">RAM</div>
<div class="value">30.65 GB</div>
</div>

<div class="info">
<div class="label">Port</div>
<div class="value">3000</div>
</div>

<div class="info">
<div class="label">Status</div>
<div class="value" style="color:#4ade80;">
Running
</div>
</div>

</div>

</div>

<!-- ================= -->
<!-- API CARD -->
<!-- ================= -->

<div class="card fade" style="margin-top:25px;">

<h2>📡 API Endpoint</h2>

<div class="api-list">

<div class="api">
<div class="method get">GET</div>
<div class="path">/api/users/me</div>
</div>

<div class="api">
<div class="method get">GET</div>
<div class="path">/api/job</div>
</div>

<div class="api">
<div class="method post">POST</div>
<div class="path">/api/job/check_job_success</div>
</div>

<div class="api">
<div class="method post">POST</div>
<div class="path">/api/job/check-job-valid</div>
</div>

<div class="api">
<div class="method post">POST</div>
<div class="path">/api/devices/register</div>
</div>

<div class="api">
<div class="method post">POST</div>
<div class="path">/api/tiktok-account</div>
</div>

<div class="api">
<div class="method post">POST</div>
<div class="path">/api/fb-account</div>
</div>

<div class="api">
<div class="method post">POST</div>
<div class="path">/api/instagram-account</div>
</div>

</div>

</div>

</div>

<footer>
AI GENERATED MOCK SERVER UI
</footer>

</body>
</html>

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
