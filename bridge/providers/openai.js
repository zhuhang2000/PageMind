import { BaseProvider } from './base.js';

export class OpenAIProvider extends BaseProvider {
  getName() {
    return 'openai';
  }

  async chat(messages) {
    return await this.request('chat', { messages });
  }
}
