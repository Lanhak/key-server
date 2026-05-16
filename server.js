const express = require("express");
const cors = require("cors");
const fs = require("fs");
const moment = require("moment");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const DB_FILE = "db.json";

function loadDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function isExpired(expireDate) {
    return moment().isAfter(moment(expireDate, "YYYY-MM-DD HH:mm:ss"));
}

app.get("/api/check", (req, res) => {
    const key = req.query.key;
    const hwid = req.query.hwid;

    if (!key || !hwid) {
        return res.send("ERROR");
    }

    const db = loadDB();

    const item = db.keys.find(k => k.key === key);

    if (!item) {
        return res.send("LOCKED");
    }

    if (item.status !== "ACTIVE") {
        return res.send("LOCKED");
    }

    if (isExpired(item.expire)) {
        return res.send("EXPIRED");
    }

    if (!item.devices) {
        item.devices = [];
    }

    if (!item.devices.includes(hwid)) {
        if (item.devices.length >= item.deviceLimit) {
            return res.send("LIMIT_REACHED");
        }

        item.devices.push(hwid);
    }

    if (!item.hwid) {
        item.hwid = hwid;
    }

    if (item.hwid !== hwid && item.deviceLimit === 1) {
        return res.send("WRONG_HWID");
    }

    saveDB(db);

    return res.send(`ACTIVE|${item.expire}`);
});

app.post("/api/create", (req, res) => {
    const { key, days } = req.body;

    const db = loadDB();

    const expire = moment()
        .add(days || 30, "days")
        .format("YYYY-MM-DD HH:mm:ss");

    db.keys.push({
        key,
        hwid: "",
        expire,
        status: "ACTIVE",
        deviceLimit: 1,
        devices: []
    });

    saveDB(db);

    res.json({
        success: true,
        key,
        expire
    });
});

app.get("/api/list", (req, res) => {
    const db = loadDB();
    res.json(db.keys);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
