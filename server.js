const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const bodyParser = require("body-parser");
const moment = require("moment");
const CryptoJS = require("crypto-js");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
const ADMIN_PASSWORD = "lanhak_admin";
const LINK4M_TOKEN = "6899fc9d171a1f07277dde22";
const SECRET = "KANTOOL_SECRET_2026";

// ===== MIDDLEWARE =====
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// ===== DATABASE =====
const DB_FILE = "database.json";

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        keys: []
    }, null, 2));
}

function loadDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function generateKey(days = 30) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `KAN-${random}-${Date.now().toString().slice(-5)}`;
}

function encrypt(text) {
    return CryptoJS.AES.encrypt(text, SECRET).toString();
}

function decrypt(text) {
    try {
        return CryptoJS.AES.decrypt(text, SECRET).toString(CryptoJS.enc.Utf8);
    } catch {
        return "";
    }
}

// ===== HOME =====
app.get("/", (req, res) => {
    const db = loadDB();

    res.send(`
    <html>
    <head>
        <title>KanTool License Server</title>
        <style>
            body{
                background:#0f172a;
                color:white;
                font-family:Arial;
                padding:40px;
            }

            .card{
                background:#1e293b;
                padding:30px;
                border-radius:20px;
                max-width:900px;
                margin:auto;
                box-shadow:0 0 30px rgba(0,0,0,0.4);
            }

            h1{
                color:#00e5ff;
            }

            input,button{
                width:100%;
                padding:14px;
                margin-top:10px;
                border:none;
                border-radius:12px;
                font-size:16px;
            }

            button{
                background:#00e676;
                color:black;
                font-weight:bold;
                cursor:pointer;
            }

            table{
                width:100%;
                margin-top:20px;
                border-collapse:collapse;
            }

            td,th{
                border:1px solid #334155;
                padding:12px;
                text-align:center;
            }

            .locked{
                color:#ff5252;
            }

            .active{
                color:#00e676;
            }
        </style>
    </head>

    <body>
        <div class="card">
            <h1>⚡ KANTOOL LICENSE SERVER ⚡</h1>

            <form action="/create-key" method="POST">
                <input type="password" name="password" placeholder="Admin Password" required>
                <input type="number" name="days" placeholder="Số ngày sử dụng" value="30">
                <button>TẠO KEY</button>
            </form>

            <table>
                <tr>
                    <th>KEY</th>
                    <th>HWID</th>
                    <th>HẾT HẠN</th>
                    <th>TRẠNG THÁI</th>
                </tr>

                ${db.keys.map(k => `
                    <tr>
                        <td>${k.key}</td>
                        <td>${k.hwid || "Chưa kích hoạt"}</td>
                        <td>${k.expire_date}</td>
                        <td class="${k.locked ? "locked" : "active"}">
                            ${k.locked ? "LOCKED" : "ACTIVE"}
                        </td>
                    </tr>
                `).join("")}
            </table>
        </div>
    </body>
    </html>
    `);
});

// ===== CREATE KEY =====
app.post("/create-key", (req, res) => {
    const { password, days } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.send("Sai mật khẩu admin");
    }

    const db = loadDB();

    const key = generateKey();

    const expireDate = moment()
        .add(Number(days), "days")
        .format("YYYY-MM-DD HH:mm:ss");

    db.keys.push({
        id: uuidv4(),
        key,
        hwid: null,
        expire_date: expireDate,
        locked: false,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
    });

    saveDB(db);

    res.redirect("/");
});

// ===== CHECK KEY =====
// APP REQUEST:
// ?api=check&key=XXX&hwid=XXX

app.get("/api", (req, res) => {
    const api = req.query.api;

    if (api !== "check") {
        return res.send("INVALID_API");
    }

    const key = req.query.key;
    const hwid = req.query.hwid;

    const db = loadDB();

    const item = db.keys.find(x => x.key === key);

    if (!item) {
        return res.send("LOCKED");
    }

    if (item.locked) {
        return res.send("LOCKED");
    }

    const now = moment();
    const expire = moment(item.expire_date);

    if (now.isAfter(expire)) {
        return res.send("EXPIRED");
    }

    // CHƯA CÓ HWID
    if (!item.hwid) {
        item.hwid = hwid;
        saveDB(db);

        return res.send(`ACTIVE|${item.expire_date}`);
    }

    // SAI HWID
    if (item.hwid !== hwid) {
        return res.send("WRONG_HWID");
    }

    return res.send(`ACTIVE|${item.expire_date}`);
});

// ===== LOCK KEY =====
app.get("/lock/:key", (req, res) => {
    const db = loadDB();

    const item = db.keys.find(x => x.key === req.params.key);

    if (!item) {
        return res.send("Không tồn tại key");
    }

    item.locked = true;

    saveDB(db);

    res.redirect("/");
});

// ===== RESET HWID =====
app.get("/reset-hwid/:key", (req, res) => {
    const db = loadDB();

    const item = db.keys.find(x => x.key === req.params.key);

    if (!item) {
        return res.send("Không tồn tại key");
    }

    item.hwid = null;

    saveDB(db);

    res.redirect("/");
});

// ===== LINK4M =====
app.get("/short", async (req, res) => {
    try {
        const url = req.query.url;

        const api = `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(url)}`;

        const response = await axios.get(api);

        return res.json(response.data);

    } catch (e) {
        return res.json({
            status: "error",
            message: e.message
        });
    }
});

// ===== GENERATE FREE KEY =====
app.get("/free-key", async (req, res) => {
    try {
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

        const key = `FREE-${Date.now().toString().slice(-6)}`;

        const db = loadDB();

        const expireDate = moment()
            .add(1, "day")
            .format("YYYY-MM-DD HH:mm:ss");

        db.keys.push({
            id: uuidv4(),
            key,
            hwid: null,
            expire_date: expireDate,
            locked: false,
            ip
        });

        saveDB(db);

        const target = `https://example.com/?key=${key}`;

        const api = `https://link4m.co/api-shorten/v2?api=${LINK4M_TOKEN}&url=${encodeURIComponent(target)}`;

        const response = await axios.get(api);

        res.json({
            key,
            shortlink: response.data.shortenedUrl || null,
            expire_date: expireDate
        });

    } catch (e) {
        res.json({
            error: e.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
