const express = require('express');
const os = require('os');
const path = require('path');

const app = express();

// ========================================
// CONFIG
// ========================================

const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json({
    limit: '50mb'
}));

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// MEMORY DATABASE
// ========================================

let USER = {
    id: 1,
    username: "guest_user",
    name: "Guest User",
    coin: 1000,
    vip: false,
    token: "token_xxxxxx",
    level: 1,
    exp: 500
};

let JOBS = [
    {
        id: 1,
        type: "follow",
        username: "demo_user_1",
        reward: 100,
        status: "pending"
    },
    {
        id: 2,
        type: "like",
        username: "demo_user_2",
        reward: 50,
        status: "pending"
    },
    {
        id: 3,
        type: "share",
        username: "demo_user_3",
        reward: 70,
        status: "pending"
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
// LOG SYSTEM
// ========================================

function line() {

    console.log(
        C.cyan +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" +
        C.reset
    );

}

function logRequest(req) {

    line();

    console.log(
        C.green + "[METHOD]" + C.reset,
        req.method
    );

    console.log(
        C.yellow + "[PATH]" + C.reset,
        req.path
    );

    console.log(
        C.blue + "[IP]" + C.reset,
        req.ip
    );

    console.log(
        C.white + "[BODY]" + C.reset,
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
// HOME PAGE
// ========================================

app.get('/', (req, res) => {

    res.send(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

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

/* ======================================== */
/* BACKGROUND */
/* ======================================== */

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

/* ======================================== */
/* HEADER */
/* ======================================== */

header{
    padding:25px;

    display:flex;

    justify-content:space-between;

    align-items:center;

    border-bottom:1px solid rgba(255,255,255,0.08);

    backdrop-filter:blur(10px);
}

.logo{
    font-size:30px;
    font-weight:700;
    color:#38bdf8;
}

.status{
    background:#16a34a22;

    color:#4ade80;

    border:1px solid #22c55e44;

    padding:10px 18px;

    border-radius:999px;

    font-size:14px;
}

/* ======================================== */
/* CONTAINER */
/* ======================================== */

.container{
    max-width:1200px;
    margin:auto;
    padding:40px 20px;
}

/* ======================================== */
/* GRID */
/* ======================================== */

.grid{
    display:grid;

    grid-template-columns:
    repeat(auto-fit,minmax(300px,1fr));

    gap:25px;
}

/* ======================================== */
/* CARD */
/* ======================================== */

.card{
    background:
    rgba(15,23,42,0.7);

    border:
    1px solid rgba(255,255,255,0.08);

    border-radius:24px;

    padding:25px;

    backdrop-filter:blur(20px);

    transition:0.3s;

    box-shadow:
    0 10px 30px rgba(0,0,0,0.4);
}

.card:hover{

    transform:
    translateY(-5px);

    border-color:#38bdf8;

}

.card h2{
    color:#38bdf8;

    margin-bottom:20px;

    font-size:24px;
}

/* ======================================== */
/* INFO */
/* ======================================== */

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

/* ======================================== */
/* API */
/* ======================================== */

.api-list{
    display:flex;

    flex-direction:column;

    gap:14px;
}

.api{
    background:#0f172a;

    border-radius:14px;

    padding:14px;

    border:
    1px solid rgba(255,255,255,0.05);

    transition:0.3s;
}

.api:hover{
    transform:scale(1.02);

    border-color:#38bdf8;
}

.method{
    display:inline-block;

    margin-bottom:10px;

    font-size:12px;

    font-weight:700;

    padding:5px 10px;

    border-radius:999px;
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

/* ======================================== */
/* FOOTER */
/* ======================================== */

footer{
    text-align:center;

    padding:40px;

    color:#64748b;

    font-size:14px;
}

/* ======================================== */
/* ANIMATION */
/* ======================================== */

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

<!-- USER -->

<div class="card">

<h2>👤 USER INFO</h2>

<div class="info">
<div class="label">Username</div>
<div class="value">${USER.username}</div>
</div>

<div class="info">
<div class="label">Name</div>
<div class="value">${USER.name}</div>
</div>

<div class="info">
<div class="label">Coin</div>
<div class="value">${USER.coin}</div>
</div>

<div class="info">
<div class="label">VIP</div>
<div class="value">${USER.vip}</div>
</div>

<div class="info">
<div class="label">Token</div>
<div class="value">${USER.token}</div>
</div>

</div>

<!-- SERVER -->

<div class="card">

<h2>🖥 SERVER INFO</h2>

<div class="info">
<div class="label">Platform</div>
<div class="value">${os.platform()}</div>
</div>

<div class="info">
<div class="label">RAM</div>
<div class="value">
${(os.totalmem()/1024/1024/1024).toFixed(2)} GB
</div>
</div>

<div class="info">
<div class="label">Port</div>
<div class="value">${PORT}</div>
</div>

<div class="info">
<div class="label">Status</div>
<div class="value" style="color:#4ade80;">
RUNNING
</div>
</div>

</div>

</div>

<!-- API -->

<div class="card fade" style="margin-top:25px;">

<h2>📡 API ENDPOINT</h2>

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
AI GENERATED MOCK SERVER
</footer>

</body>

</html>
`);

});

// ========================================
// API USER
// ========================================

app.get('/api/users/me', (req, res) => {

    res.json({
        success: true,
        data: USER
    });

});

// ========================================
// API DEVICE REGISTER
// ========================================

app.post('/api/devices/register', (req, res) => {

    res.json({
        success: true,
        token: USER.token,
        device_id: "DEVICE_001"
    });

});

// ========================================
// API JOB
// ========================================

app.get('/api/job', (req, res) => {

    res.json({
        success: true,
        total: JOBS.length,
        jobs: JOBS
    });

});

// ========================================
// API VALID JOB
// ========================================

app.post('/api/job/check-job-valid', (req, res) => {

    res.json({
        success: true,
        valid: true,
        message: "job valid"
    });

});

// ========================================
// API SUCCESS JOB
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
// API TIKTOK
// ========================================

app.post('/api/tiktok-account', (req, res) => {

    res.json({
        success: true,
        username:
        req.body.username || "guest_tiktok",
        connected: true
    });

});

// ========================================
// API FACEBOOK
// ========================================

app.post('/api/fb-account', (req, res) => {

    res.json({
        success: true,
        facebook_id: "100001",
        connected: true
    });

});

// ========================================
// API INSTAGRAM
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
