
type Listener = (data: any) => void;

export class NativeSocketService {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectInterval: number = 3000;
    private shouldReconnect: boolean = true;
    public isConnected: boolean = false;
    public id: string = '';
    private listeners: Map<string, Listener[]> = new Map();

    constructor(url: string) {
        this.url = url;
    }

    public connect(token?: string) {
        this.shouldReconnect = true;

        let wsUrl = this.url;
        if (token) {
            const separator = wsUrl.includes('?') ? '&' : '?';
            wsUrl = `${wsUrl}${separator}token=${token}`;
        }

        try {
            this.ws = new WebSocket(wsUrl);
        } catch (e) {
            console.error('Invalid WebSocket URL:', wsUrl);
            return;
        }

        this.ws.onopen = () => {
            console.log('✅ WS Connected');
            this.isConnected = true;
            this.emitLocal('connect', null);
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type) {
                    this.emitLocal(message.type, message.data);
                }
            } catch (e) {
                console.error('WS Parse Error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('❌ WS Disconnected');
            this.isConnected = false;
            this.emitLocal('disconnect', null);
            if (this.shouldReconnect) {
                setTimeout(() => this.connect(token), this.reconnectInterval);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WS Error:', error);
            this.emitLocal('connect_error', error);
        };
    }

    public disconnect() {
        this.shouldReconnect = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    public emit(event: string, data?: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type: event, data });
            this.ws.send(message);
        } else {
            console.warn('WS not connected, cannot emit:', event);
        }
    }

    public on(event: string, callback: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);
    }

    public off(event: string, callback?: Listener) {
        if (!this.listeners.has(event)) return;

        if (callback) {
            const list = this.listeners.get(event)!;
            this.listeners.set(event, list.filter(cb => cb !== callback));
        } else {
            this.listeners.delete(event);
        }
    }

    public removeAllListeners(event?: string) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    private emitLocal(event: string, data: any) {
        const list = this.listeners.get(event);
        if (list) {
            list.forEach(cb => cb(data));
        }
    }

    public close() {
        this.disconnect();
    }
}

export const createNativeSocket = (url: string) => {
    return new NativeSocketService(url);
};
