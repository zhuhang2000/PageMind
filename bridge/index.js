// bridge/index.js
export class Bridge {
  constructor() {
    this.callbacks = new Map();
    this.setupListener();
  }

  setupListener() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.source === 'BRIDGE_CONTENT_SCRIPT') {
        const { requestId, payload } = event.data;
        if (this.callbacks.has(requestId)) {
          this.callbacks.get(requestId)(payload);
          this.callbacks.delete(requestId);
        }
      }
    });
  }

  send(payload) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7);
      this.callbacks.set(requestId, resolve);
      
      window.postMessage({
        source: 'BRIDGE_CLIENT',
        requestId,
        payload
      }, '*');
    });
  }
}
