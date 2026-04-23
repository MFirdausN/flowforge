import { BadRequestException, Injectable } from '@nestjs/common';
import vm from 'node:vm';

@Injectable()
export class ScriptStep {
  async execute(config: Record<string, any>) {
    if (typeof config.code !== 'string' || config.code.trim().length === 0) {
      throw new BadRequestException('Script step requires non-empty code');
    }

    const timeoutMs = Math.min(
      Math.max(Number(config.timeout_ms ?? 1000), 100),
      5000,
    );
    const sandbox = {
      input: config.input ?? {},
      result: undefined,
      console: {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const context = vm.createContext(sandbox, {
      name: 'flowforge-script-step',
      codeGeneration: { strings: false, wasm: false },
    });
    const script = new vm.Script(`"use strict";\n${config.code}`, {
      filename: 'workflow-step.vm.js',
    });

    script.runInContext(context, { timeout: timeoutMs });

    return {
      result: sandbox.result,
    };
  }
}
