const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8081 });

let latestLogs = [];

wss.on("connection", ws => {
    console.log("[WS] client connected");

    ws.on("message", msg => {

        const data = JSON.parse(msg);

        // store log
        latestLogs.push(data);

        // broadcast to all UI clients
        wss.clients.forEach(c => {
            if (c.readyState === 1) {
                c.send(JSON.stringify(data));
            }
        });
    });
});

console.log("WS server running :8081");
