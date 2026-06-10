"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
exports.broadcast = broadcast;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const clients = [];
function setupWebSocket(wss) {
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', 'ws://localhost');
        const token = url.searchParams.get('token');
        if (!token) {
            ws.close(1008, 'No token');
            return;
        }
        let familyId, memberId;
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            familyId = payload.familyId;
            memberId = payload.memberId;
        }
        catch {
            ws.close(1008, 'Invalid token');
            return;
        }
        const client = { ws, familyId, memberId };
        clients.push(client);
        ws.on('close', () => {
            const idx = clients.indexOf(client);
            if (idx >= 0)
                clients.splice(idx, 1);
        });
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                // Relay messages within the same family
                broadcast(familyId, msg, memberId);
            }
            catch { /* ignore bad messages */ }
        });
        ws.send(JSON.stringify({ type: 'connected', memberId }));
    });
}
function broadcast(familyId, data, excludeMemberId) {
    const msg = JSON.stringify(data);
    for (const client of clients) {
        if (client.familyId === familyId && client.memberId !== excludeMemberId && client.ws.readyState === ws_1.WebSocket.OPEN) {
            client.ws.send(msg);
        }
    }
}
//# sourceMappingURL=websocket.js.map