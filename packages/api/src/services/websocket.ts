import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

interface FamilyClient { ws: WebSocket; familyId: string; memberId: string; }
const clients = new Set<FamilyClient>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', 'ws://localhost');
    const token = url.searchParams.get('token');
    if (!token || !process.env.JWT_SECRET) { ws.close(1008, 'Unauthorized'); return; }
    let familyId: string;
    let memberId: string;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as jwt.JwtPayload;
      if (typeof payload.familyId !== 'string' || typeof payload.memberId !== 'string' || !payload.familyId || !payload.memberId) throw new Error('Invalid claims');
      familyId = payload.familyId;
      memberId = payload.memberId;
    } catch { ws.close(1008, 'Unauthorized'); return; }
    const client: FamilyClient = { ws, familyId, memberId };
    clients.add(client);
    ws.on('close', () => clients.delete(client));
    ws.on('error', () => clients.delete(client));
    let lastTypingAt = 0;
    ws.on('message', (raw) => {
      const bytes = Array.isArray(raw) ? raw.reduce((total, part) => total + part.byteLength, 0) : raw.byteLength;
      if (bytes > 1024) { ws.close(1009, 'Message too large'); return; }
      try {
        const msg: unknown = JSON.parse(raw.toString());
        if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
        const type = (msg as { type: unknown }).type;
        if (type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
        if (type === 'chat:typing') {
          const now = Date.now();
          if (now - lastTypingAt < 750) return;
          lastTypingAt = now;
          const data = msg as { memberName?: unknown; memberEmoji?: unknown };
          broadcast(familyId, {
            type: 'chat:typing', memberId,
            memberName: typeof data.memberName === 'string' ? data.memberName.slice(0, 80) : '',
            memberEmoji: typeof data.memberEmoji === 'string' ? data.memberEmoji.slice(0, 16) : '',
          }, memberId);
        }
      } catch { /* ignore malformed client messages */ }
    });
    ws.send(JSON.stringify({ type: 'connected', memberId }));
  });
}

export function broadcast(familyId: string, data: unknown, excludeMemberId?: string) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.familyId === familyId && client.memberId !== excludeMemberId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}
