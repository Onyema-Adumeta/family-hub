import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

interface FamilyClient {
  ws: WebSocket;
  familyId: string;
  memberId: string;
}

const clients: FamilyClient[] = [];

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'ws://localhost');
    const token = url.searchParams.get('token');

    if (!token) { ws.close(1008, 'No token'); return; }

    let familyId: string, memberId: string;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      familyId = payload.familyId;
      memberId = payload.memberId;
    } catch { ws.close(1008, 'Invalid token'); return; }

    const client: FamilyClient = { ws, familyId, memberId };
    clients.push(client);

    ws.on('close', () => {
      const idx = clients.indexOf(client);
      if (idx >= 0) clients.splice(idx, 1);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Relay messages within the same family
        broadcast(familyId, msg, memberId);
      } catch { /* ignore bad messages */ }
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
