// bridge/providers/base.js
export class BaseProvider {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async request(action, params = {}) {
    return await this.bridge.send({
      type: 'PROVIDER_REQUEST',
      payload: {
        provider: this.getName(),
        action,
        params
      }
    });
  }

  getName() {
    throw new Error('Provider must implement getName()');
  }
}
