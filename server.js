const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const moment = require("moment");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();

// =========================
// CONFIG
// =========================

const PORT = process.env.PORT || 3000;

const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

const DATABASE = path.join(__dirname, "database.json");

// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret: "kantool_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// =========================
// DATABASE INIT
// =========================

if (!fs.existsSync(DATABASE)) {

    fs.writeFileSync(
        DATABASE,
        JSON.stringify({
            keys: {},
            users: {},
            logs: []
        }, null, 2)
    );
}

function loadDB() {
    return JSON.parse(fs.readFileSync(DATABASE, "utf8"));
}

function saveDB(data) {
    fs.writeFileSync(DATABASE, JSON.stringify(data, null, 2));
}

// =========================
// ENCRYPT / DECRYPT
// =========================

function encryptData(data) {
    return Buffer.from(data).toString("base64");
}

function decryptData(data) {
    return Buffer.from(data, "base64").toString("utf8");
}

// =========================
// GET IP
// =========================

function getIP(req) {

    return (
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        req.ip ||
        "0.0.0.0"
    ).replace("::ffff:", "");
}

// =========================
// GENERATE KEY
// =========================

function generateKey(ip) {

    const ngay = new Date().getDate();

    const key1 = ngay * 27 + 27;

    const ipNumbers = ip.replace(/\D/g, "");

    return `bon_${key1}${ipNumbers}`;
}

// =========================
// GENERATE RANDOM PREMIUM KEY
// =========================

function generatePremiumKey() {

    const random = crypto.randomBytes(8).toString("hex").toUpperCase();

    return `KANTOOL-${random}`;
}

// =========================
// LINK4M API
// =========================

async function createShortLink(url) {

    const apiUrl =
        `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(url)}`;

    const response = await axios.get(apiUrl);

    return response.data;
}

// =========================
// LOG SYSTEM
// =========================

function addLog(message) {

    const db = loadDB();

    db.logs.unshift({
        id: uuidv4(),
        message,
        time: Date.now()
    });

    if (db.logs.length > 1000) {
        db.logs = db.logs.slice(0, 1000);
    }

    saveDB(db);
}

// =========================
// AUTH MIDDLEWARE
// =========================

function checkAdmin(req, res, next) {

    if (!req.session.admin) {
        return res.redirect("/login");
    }

    next();
}

// =========================
// BEAUTIFUL CSS
// =========================

const MAIN_STYLE = `
<style>

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{
    background:#020617;
    color:white;
    font-family:Arial;
}

.main{
    width:100%;
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    padding:20px;
}

.card{
    width:100%;
    max-width:450px;
    background:#111827;
    border-radius:25px;
    padding:30px;
    box-shadow:0 0 30px rgba(0,255,255,.15);
}

.title{
    font-size:35px;
    font-weight:bold;
    text-align:center;
    color:#00e5ff;
}

.sub{
    text-align:center;
    margin-top:10px;
    color:#94a3b8;
}

.btn{
    width:100%;
    display:block;
    text-align:center;
    margin-top:20px;
    padding:15px;
    border:none;
    border-radius:15px;
    background:linear-gradient(45deg,#00bcd4,#00e676);
    color:white;
    text-decoration:none;
    font-size:18px;
    font-weight:bold;
    cursor:pointer;
}

.input{
    width:100%;
    margin-top:15px;
    padding:15px;
    border:none;
    border-radius:15px;
    background:#1e293b;
    color:white;
    font-size:16px;
}

.keybox{
    margin-top:20px;
    background:#0f172a;
    border-radius:15px;
    padding:20px;
    text-align:center;
    font-size:24px;
    color:#00ff99;
    word-break:break-all;
}

.table{
    width:100%;
    border-collapse:collapse;
    margin-top:20px;
}

.table th,
.table td{
    border:1px solid #334155;
    padding:10px;
    text-align:left;
}

.table th{
    background:#1e293b;
}

.nav{
    width:100%;
    background:#111827;
    padding:15px;
    display:flex;
    justify-content:space-between;
    align-items:center;
}

.logo{
    font-size:25px;
    font-weight:bold;
    color:#00e5ff;
}

.nav a{
    color:white;
    text-decoration:none;
    margin-left:15px;
}

.badge{
    padding:5px 10px;
    border-radius:10px;
    background:#00e676;
    color:black;
    font-weight:bold;
}

.red{
    background:#ef4444;
    color:white;
}

.orange{
    background:#f59e0b;
    color:white;
}

</style>
`;

// =========================
// HOME
// =========================

app.get("/", (req, res) => {

    res.send(`

    <!DOCTYPE html>

    <html>

    <head>

        <title>KANTOOL SERVER</title>

        <meta name="viewport" content="width=device-width, initial-scale=1">

        ${MAIN_STYLE}

    </head>

    <body>

        <div class="main">

            <div class="card">

                <div class="title">
                    KANTOOL
                </div>

                <div class="sub">
                    Hệ Thống Key Free & Premium
                </div>

                <a class="btn" href="/free-key">
                    NHẬN KEY FREE
                </a>

                <a class="btn" href="/premium-key">
                    TẠO KEY PREMIUM
                </a>

                <a class="btn" href="/login">
                    ADMIN PANEL
                </a>

            </div>

        </div>

    </body>

    </html>

    `);
});

// =========================
// FREE KEY
// =========================

app.get("/free-key", async (req, res) => {

    try {

        const ip = getIP(req);

        const key = generateKey(ip);

        const expire = moment().endOf("day").valueOf();

        const db = loadDB();

        db.keys[key] = {
            type: "FREE",
            ip,
            hwid: null,
            status: "ACTIVE",
            created: Date.now(),
            expire,
            devices: 1
        };

        saveDB(db);

        const successUrl =
            `${req.protocol}://${req.get("host")}/success?key=${key}`;

        const shortData = await createShortLink(successUrl);

        const shortLink =
            shortData.shortenedUrl ||
            shortData.shortened_url ||
            successUrl;

        addLog(`FREE KEY CREATED: ${key}`);

        res.send(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>FREE KEY</title>

            <meta name="viewport" content="width=device-width, initial-scale=1">

            ${MAIN_STYLE}

        </head>

        <body>

            <div class="main">

                <div class="card">

                    <div class="title">
                        FREE KEY
                    </div>

                    <div class="sub">
                        Vượt Link4M để nhận key
                    </div>

                    <a class="btn" href="${shortLink}">
                        VƯỢT LINK4M
                    </a>

                </div>

            </div>

        </body>

        </html>

        `);

    } catch (e) {

        res.send(e.message);
    }
});

// =========================
// SUCCESS PAGE
// =========================

app.get("/success", (req, res) => {

    const key = req.query.key;

    res.send(`

    <!DOCTYPE html>

    <html>

    <head>

        <title>SUCCESS</title>

        <meta name="viewport" content="width=device-width, initial-scale=1">

        ${MAIN_STYLE}

    </head>

    <body>

        <div class="main">

            <div class="card">

                <div class="title">
                    KEY CỦA BẠN
                </div>

                <div class="keybox" id="key">
                    ${key}
                </div>

                <button class="btn" onclick="copyKey()">
                    COPY KEY
                </button>

            </div>

        </div>

        <script>

            function copyKey(){

                navigator.clipboard.writeText("${key}");

                alert("Đã copy key");
            }

        </script>

    </body>

    </html>

    `);
});

// =========================
// API CHECK
// =========================

app.get("/api", (req, res) => {

    const type = req.query.api;

    if (type === "check") {
        // giữ nguyên code check của bạn
        const key = req.query.key;
        const hwid = req.query.hwid;

        const db = loadDB();

        if (!db.keys[key]) return res.send("LOCKED");

        const data = db.keys[key];

        if (data.status !== "ACTIVE") return res.send("LOCKED");

        if (Date.now() > data.expire) return res.send("EXPIRED");

        if (!data.hwid) {
            data.hwid = hwid;
            db.keys[key] = data;
            saveDB(db);
        } else {
            if (data.hwid !== hwid) return res.send("WRONG_HWID");
        }

        return res.send("ACTIVE");
    }

    if (type === "version") {
        return res.json({
            version: "1.0.0",
            status: "ok"
        });
    }

    return res.send("ERROR");
});
// =========================
// LOGIN
// =========================

app.get("/login", (req, res) => {

    res.send(`

    <!DOCTYPE html>

    <html>

    <head>

        <title>LOGIN</title>

        <meta name="viewport" content="width=device-width, initial-scale=1">

        ${MAIN_STYLE}

    </head>

    <body>

        <div class="main">

            <form class="card" method="POST" action="/login">

                <div class="title">
                    ADMIN LOGIN
                </div>

                <input class="input" name="username" placeholder="Username">

                <input class="input" name="password" type="password" placeholder="Password">

                <button class="btn">
                    LOGIN
                </button>

            </form>

        </div>

    </body>

    </html>

    `);
});

app.post("/login", (req, res) => {

    const { username, password } = req.body;

    if (
        username === ADMIN_USER &&
        password === ADMIN_PASS
    ) {

        req.session.admin = true;

        return res.redirect("/admin");
    }

    res.send("LOGIN FAILED");
});

// =========================
// ADMIN PANEL
// =========================

app.get("/admin", checkAdmin, (req, res) => {

    const db = loadDB();

    let rows = "";

    Object.keys(db.keys).reverse().forEach(key => {

        const item = db.keys[key];

        rows += `

        <tr>

            <td>${key}</td>

            <td>${item.type}</td>

            <td>${item.ip}</td>

            <td>${item.hwid || "NULL"}</td>

            <td>
                <span class="badge">
                    ${item.status}
                </span>
            </td>

            <td>
                ${moment(item.expire).format("DD/MM/YYYY HH:mm:ss")}
            </td>

        </tr>

        `;
    });

    res.send(`

    <!DOCTYPE html>

    <html>

    <head>

        <title>ADMIN</title>

        <meta name="viewport" content="width=device-width, initial-scale=1">

        ${MAIN_STYLE}

    </head>

    <body>

        <div class="nav">

            <div class="logo">
                KANTOOL ADMIN
            </div>

            <div>

                <a href="/create-premium">
                    CREATE KEY
                </a>

                <a href="/logout">
                    LOGOUT
                </a>

            </div>

        </div>

        <div style="padding:20px;overflow:auto;">

            <table class="table">

                <tr>

                    <th>KEY</th>

                    <th>TYPE</th>

                    <th>IP</th>

                    <th>HWID</th>

                    <th>STATUS</th>

                    <th>EXPIRE</th>

                </tr>

                ${rows}

            </table>

        </div>

    </body>

    </html>

    `);
});

// =========================
// CREATE PREMIUM
// =========================

app.get("/create-premium", checkAdmin, (req, res) => {

    res.send(`

    <!DOCTYPE html>

    <html>

    <head>

        <title>CREATE KEY</title>

        <meta name="viewport" content="width=device-width, initial-scale=1">

        ${MAIN_STYLE}

    </head>

    <body>

        <div class="main">

            <form class="card" method="POST" action="/create-premium">

                <div class="title">
                    CREATE PREMIUM KEY
                </div>

                <input class="input" name="days" placeholder="Số ngày" value="30">

                <button class="btn">
                    TẠO KEY
                </button>

            </form>

        </div>

    </body>

    </html>

    `);
});

app.post("/create-premium", checkAdmin, (req, res) => {

    const days = parseInt(req.body.days || 30);

    const key = generatePremiumKey();

    const expire = moment().add(days, "days").valueOf();

    const db = loadDB();

    db.keys[key] = {
        type: "PREMIUM",
        ip: null,
        hwid: null,
        status: "ACTIVE",
        created: Date.now(),
        expire,
        devices: 1
    };

    saveDB(db);

    addLog(`PREMIUM KEY CREATED: ${key}`);

    res.send(`

    <!DOCTYPE html>

    <html>

    <head>

        <title>DONE</title>

        <meta name="viewport" content="width=device-width, initial-scale=1">

        ${MAIN_STYLE}

    </head>

    <body>

        <div class="main">

            <div class="card">

                <div class="title">
                    PREMIUM KEY
                </div>

                <div class="keybox">
                    ${key}
                </div>

                <a class="btn" href="/admin">
                    QUAY LẠI ADMIN
                </a>

            </div>

        </div>

    </body>

    </html>

    `);
});

// =========================
// LOGOUT
// =========================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");
    });
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {

    console.log(`KANTOOL SERVER RUNNING PORT ${PORT}`);
});
