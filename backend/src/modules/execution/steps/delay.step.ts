import { Injectable } from '@nestjs/common';

@Injectable()
export class DelayStep {
  async execute(config: Record<string, any>) {
    const ms = Number(config.ms || 0);

    if (ms < 0) {
      throw new Error('Delay ms must be >= 0');
    }

    await new Promise((resolve) => setTimeout(resolve, ms));

    return { delayed: ms };
  }
}
