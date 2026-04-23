import { Injectable } from '@nestjs/common';

@Injectable()
export class HttpStep {
  async execute(config: Record<string, any>) {
    const method = config.method || 'GET';
    const url = config.url;

    if (!url) {
      throw new Error('HTTP step requires url');
    }

    const response = await fetch(url, {
      method,
      headers: config.headers || {},
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(`HTTP step failed with status ${response.status}`);
    }

    return data;
  }
}
