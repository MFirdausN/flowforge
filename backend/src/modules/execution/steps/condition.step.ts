import { Injectable } from '@nestjs/common';

@Injectable()
export class ConditionStep {
  async execute(config: Record<string, any>) {
    const value = Boolean(config.value);
    return { result: value };
  }
}
