const axios = require("axios");

async function replay(req) {
    try {
        const res = await axios({
            method: req.method,
            url: req.url,
            data: req.body || {},
            headers: req.headers || {}
        });

        return {
            success: true,
            status: res.status,
            data: res.data
        };

    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

module.exports = { replay };
