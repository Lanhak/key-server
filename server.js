const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

// =============================
// CONFIG
// =============================

const PORT = process.env.PORT || 3000;
const API_URL = 'https://key-server-zfwa.onrender.com';
const SECRET_KEY = process.env.SECRET_KEY || 'mtoolmax_secret';

// =============================
// MIDDLEWARE
// =============================

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// =============================
// MEMORY DATABASE
// =============================

let DATABASE = {
    users: [],
    logs: [],
    keys: [],
    tasks: []
};

// =============================
// HELPERS
// =============================

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function logAction(action, data = {}) {
    DATABASE.logs.push({
        action,
        data,
        time: new Date().toISOString()
    });
}

function createKey() {
    return 'MTOOL-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

// =============================
// HOME
// =============================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'MToolMax Server Running',
        server: API_URL,
        time: new Date().toISOString()
    });
});

// =============================
// STATUS
// =============================

app.get('/status', (req, res) => {
    res.json({
        online: true,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        users: DATABASE.users.length,
        keys: DATABASE.keys.length,
        logs: DATABASE.logs.length
    });
});

// =============================
// REGISTER
// =============================

app.post('/register', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu username hoặc password'
            });
        }

        const exists = DATABASE.users.find(u => u.username === username);

        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản đã tồn tại'
            });
        }

        const user = {
            id: Date.now(),
            username,
            password,
            token: generateToken(),
            createdAt: new Date().toISOString()
        };

        DATABASE.users.push(user);

        logAction('REGISTER', {
            username
        });

        res.json({
            success: true,
            message: 'Đăng ký thành công',
            token: user.token
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// =============================
// LOGIN
// =============================

app.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;

        const user = DATABASE.users.find(
            u => u.username === username && u.password === password
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Sai tài khoản hoặc mật khẩu'
            });
        }

        logAction('LOGIN', {
            username
        });

        res.json({
            success: true,
            token: user.token,
            user: {
                id: user.id,
                username: user.username
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// =============================
// GENERATE KEY
// =============================

app.post('/create-key', (req, res) => {
    try {
        const key = createKey();

        DATABASE.keys.push({
            key,
            createdAt: new Date().toISOString(),
            active: true
        });

        logAction('CREATE_KEY', {
            key
        });

        res.json({
            success: true,
            key
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// =============================
// CHECK KEY
// =============================

app.post('/check-key', (req, res) => {
    try {
        const { key } = req.body;

        const found = DATABASE.keys.find(k => k.key === key);

        if (!found) {
            return res.json({
                success: false,
                valid: false
            });
        }

        res.json({
            success: true,
            valid: found.active
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// =============================
// NOTICE API
// =============================

app.get('/notice/latest', (req, res) => {
    res.json({
        status: 'online',
        force_update: false,
        versionName: '2.0.0',
        update_url: 'https://example.com/update.apk',
        message: 'Server hoạt động bình thường',
        motd: 'Welcome To MToolMax',
        notice: 'Không có thông báo mới'
    });
});

// =============================
// TASK API
// =============================

app.post('/task/add', (req, res) => {
    try {
        const { title, data } = req.body;

        const task = {
            id: Date.now(),
            title,
            data,
            createdAt: new Date().toISOString()
        };

        DATABASE.tasks.push(task);

        res.json({
            success: true,
            task
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get('/task/list', (req, res) => {
    res.json({
        success: true,
        tasks: DATABASE.tasks
    });
});

// =============================
// LOGS
// =============================

app.get('/logs', (req, res) => {
    res.json({
        success: true,
        logs: DATABASE.logs
    });
});

// =============================
// SAVE DATABASE
// =============================

function saveDatabase() {
    try {
        fs.writeFileSync(
            path.join(__dirname, 'database.json'),
            JSON.stringify(DATABASE, null, 2)
        );
    } catch (err) {
        console.log('Save DB Error:', err.message);
    }
}

function loadDatabase() {
    try {
        const file = path.join(__dirname, 'database.json');

        if (fs.existsSync(file)) {
            DATABASE = JSON.parse(fs.readFileSync(file));
        }
    } catch (err) {
        console.log('Load DB Error:', err.message);
    }
}

loadDatabase();

setInterval(() => {
    saveDatabase();
}, 10000);

// =============================
// ERROR HANDLER
// =============================

app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
});

// =============================
// START SERVER
// =============================

// ========================================
// LINK4M FREE KEY SYSTEM
// ========================================

const LINK4M_API = "6899fc9d171a1f07277dde22";

let FREE_KEYS = {};

app.get('/api/free-key', async (req, res) => {
    try {
        const uid = req.query.uid;

        if (!uid) {
            return res.json({
                success: false,
                message: 'Thiếu UID'
            });
        }

        const destination = encodeURIComponent(
            `https://key-server-zfwa.onrender.com/api/free-key-success?uid=${uid}`
        );

        const url = `https://link4m.co/api-shorten/v2?api=${LINK4M_API}&url=${destination}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.shortenedUrl) {
            return res.json({
                success: false,
                message: 'Không tạo được link vượt'
            });
        }

        res.json({
            success: true,
            url: data.shortenedUrl
        });

    } catch (e) {
        res.json({
            success: false,
            message: e.message
        });
    }
});

app.get('/api/free-key-success', (req, res) => {
    const uid = req.query.uid;

    if (!uid) {
        return res.send('Thiếu UID');
    }

    const freeKey = 'FREE-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    FREE_KEYS[uid] = {
        key: freeKey,
        expired: Date.now() + (24 * 60 * 60 * 1000)
    };

    res.send(`
    <html>
    <body style="background:#111;color:white;text-align:center;padding-top:100px;font-family:sans-serif;">
        <h1>FREE KEY</h1>
        <h2>${freeKey}</h2>
        <p>Key dùng 24 giờ</p>
    </body>
    </html>
    `);
});

app.post('/api/check-free-key', (req, res) => {
    const { uid, key } = req.body;

    if (!FREE_KEYS[uid]) {
        return res.json({
            success: false,
            message: 'UID chưa lấy key'
        });
    }

    const data = FREE_KEYS[uid];

    if (Date.now() > data.expired) {
        delete FREE_KEYS[uid];

        return res.json({
            success: false,
            message: 'Key hết hạn'
        });
    }

    if (data.key !== key) {
        return res.json({
            success: false,
            message: 'Key sai'
        });
    }

    res.json({
        success: true,
        message: 'Key hợp lệ'
    });
});

app.listen(PORT, () => {
    console.log(`====================================`);
    console.log(`MToolMax Server Running`);
    console.log(`PORT: ${PORT}`);
    console.log(`URL: ${API_URL}`);
    console.log(`====================================`);
});
