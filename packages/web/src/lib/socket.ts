import { useAuthStore } from '../store/auth';

type MessageHandler = (msg: any) => void;

class FamilySocket {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private connectedToken: string | null = null;

  connect() {
    const token = useAuthStore.getState().token;
    if (!token) { this.disconnect(); return; }
    this.intentionallyClosed = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws && this.connectedToken === token &&
        (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.ws) { const old = this.ws; this.ws = null; old.close(); }

    const base = import.meta.env.VITE_WS_URL || 'wss://family-hubapi-production.up.railway.app';
    const ws = new WebSocket(`${base}?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    this.connectedToken = token;

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      try {
        const msg = JSON.parse(e.data);
        this.handlers.forEach(h => { try { h(msg); } catch { /* isolate handlers */ } });
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.connectedToken = null;
      if (!this.intentionallyClosed && useAuthStore.getState().token) {
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, 3000);
      }
    };

    ws.onerror = () => { ws.close(); };
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    const ws = this.ws;
    this.ws = null;
    this.connectedToken = null;
    ws?.close();
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  }
}

export const familySocket = new FamilySocket();
