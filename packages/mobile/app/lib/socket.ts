import { useAuthStore } from '../store/auth';

type MessageHandler = (msg: any) => void;

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001';

class FamilySocket {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimer: any = null;
  private intentionallyClosed = false;

  connect() {
    const token = useAuthStore.getState().token;
    if (!token || this.ws?.readyState === WebSocket.OPEN) return;

    this.intentionallyClosed = false;
    this.ws = new WebSocket(`${WS_URL}?token=${token}`);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.handlers.forEach(h => h(msg));
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      if (this.intentionallyClosed) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    this.intentionallyClosed = true;
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const familySocket = new FamilySocket();