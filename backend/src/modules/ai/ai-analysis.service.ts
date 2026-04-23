import { Injectable, NotFoundException } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { serializeBigInt } from '../../common/utils/serialize-bigint';

type FailureAnalysis = {
  source: 'heuristic' | 'llm';
  summary: string;
  likelyCause: string;
  suggestedFix: string;
  confidence: 'low' | 'medium' | 'high';
  promptStrategy: {
    tokenLimit: string;
    malformedOutputGuard: string;
  };
  context: {
    runId: string;
    workflowId: string;
    status: string;
    failedSteps: Array<{
      stepId: string;
      stepType: string;
      errorMessage?: string | null;
    }>;
  };
};

@Injectable()
export class AiAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeRunFailure(runId: string, tenantId: string) {
    const run = await this.prisma.workflowRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
        steps: {
          orderBy: { createdAt: 'asc' },
          include: {
            logs: {
              orderBy: { createdAt: 'asc' },
              take: 10,
            },
          },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    const context = this.buildContext(run);
    const heuristicAnalysis = this.buildHeuristicAnalysis(context);
    const llmAnalysis = await this.tryAnalyzeWithLlm(context);

    return serializeBigInt(llmAnalysis ?? heuristicAnalysis);
  }

  private buildContext(run: any) {
    const failedSteps = run.steps
      .filter((step) => step.status === 'FAILED')
      .map((step) => ({
        stepId: step.stepId,
        stepType: step.stepType,
        errorMessage: step.errorMessage,
      }));
    const logs = [...run.logs, ...run.steps.flatMap((step) => step.logs ?? [])]
      .slice(-25)
      .map((log) => ({
        level: log.level,
        message: String(log.message).slice(0, 500),
        createdAt: log.createdAt,
      }));

    return {
      runId: run.id,
      workflowId: run.workflowId,
      workflowName: run.workflow?.name,
      status: run.status,
      triggerType: run.triggerType,
      errorMessage: run.errorMessage,
      durationMs: run.durationMs,
      failedSteps,
      logs,
    };
  }

  private buildHeuristicAnalysis(context: any): FailureAnalysis {
    const firstFailedStep = context.failedSteps[0];
    const combinedError = [
      context.errorMessage,
      firstFailedStep?.errorMessage,
      ...context.logs.map((log) => log.message),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (context.status === RunStatus.TIMEOUT || combinedError.includes('timed out')) {
      return this.toAnalysis(context, {
        likelyCause:
          'The workflow exceeded its configured timeout or a step took too long to finish.',
        suggestedFix:
          'Increase `timeout_ms`, reduce delay duration, add request timeouts to HTTP steps, or split long work into smaller workflows.',
        confidence: 'high',
      });
    }

    if (combinedError.includes('http step failed with status 4')) {
      return this.toAnalysis(context, {
        likelyCause:
          'An HTTP step returned a client error, commonly caused by invalid URL, headers, auth, or request body.',
        suggestedFix:
          'Verify the endpoint URL, required headers, token permissions, and payload schema for the failed HTTP step.',
        confidence: 'high',
      });
    }

    if (combinedError.includes('http step failed with status 5')) {
      return this.toAnalysis(context, {
        likelyCause:
          'An upstream service returned a server error while the workflow was executing an HTTP step.',
        suggestedFix:
          'Enable retry/backoff for the HTTP step, inspect the upstream service health, and consider adding a fallback branch.',
        confidence: 'high',
      });
    }

    if (combinedError.includes('unsupported step type')) {
      return this.toAnalysis(context, {
        likelyCause: 'The workflow definition contains a step type that the engine cannot execute yet.',
        suggestedFix:
          'Change the step type to a supported type (`http`, `delay`, `condition`) or implement the missing step handler.',
        confidence: 'high',
      });
    }

    return this.toAnalysis(context, {
      likelyCause:
        'The run failed, but the stored error context does not match a known failure pattern.',
      suggestedFix:
        'Inspect the failed step logs, confirm the workflow definition is valid, and rerun with a small input payload to isolate the failing step.',
      confidence: 'medium',
    });
  }

  private async tryAnalyzeWithLlm(context: any): Promise<FailureAnalysis | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

    if (!apiKey) {
      return null;
    }

    const prompt = this.buildPrompt(context);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: prompt,
          max_output_tokens: 500,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as any;
      const text = this.extractResponseText(payload);
      const parsed = this.safeParseJson(text);

      if (!parsed) {
        return null;
      }

      return {
        source: 'llm',
        summary: String(parsed.summary ?? 'Workflow failure analyzed by LLM.'),
        likelyCause: String(parsed.likelyCause ?? 'Unknown cause.'),
        suggestedFix: String(parsed.suggestedFix ?? 'Inspect logs and retry.'),
        confidence: this.normalizeConfidence(parsed.confidence),
        promptStrategy: this.promptStrategy,
        context: {
          runId: context.runId,
          workflowId: context.workflowId,
          status: context.status,
          failedSteps: context.failedSteps,
        },
      };
    } catch {
      return null;
    }
  }

  private buildPrompt(context: any) {
    return `You are analyzing a failed workflow run. Return only valid JSON with keys: summary, likelyCause, suggestedFix, confidence.

Rules:
- Do not invent systems not present in the context.
- Keep suggestedFix actionable and concise.
- confidence must be low, medium, or high.
- If context is insufficient, say so.

Context:
${JSON.stringify(context).slice(0, 6000)}`;
  }

  private toAnalysis(
    context: any,
    result: Pick<FailureAnalysis, 'likelyCause' | 'suggestedFix' | 'confidence'>,
  ): FailureAnalysis {
    return {
      source: 'heuristic',
      summary: `Run ${context.runId} finished with status ${context.status}. ${context.failedSteps.length} failed step(s) were found.`,
      likelyCause: result.likelyCause,
      suggestedFix: result.suggestedFix,
      confidence: result.confidence,
      promptStrategy: this.promptStrategy,
      context: {
        runId: context.runId,
        workflowId: context.workflowId,
        status: context.status,
        failedSteps: context.failedSteps,
      },
    };
  }

  private get promptStrategy() {
    return {
      tokenLimit:
        'Only the last 25 combined run/step log entries are sent, with each log message truncated to 500 characters and full context capped to 6000 JSON characters.',
      malformedOutputGuard:
        'The LLM is instructed to return JSON only; output is parsed defensively and falls back to heuristic analysis if parsing fails.',
    };
  }

  private extractResponseText(payload: any) {
    if (typeof payload.output_text === 'string') {
      return payload.output_text;
    }

    const firstText = payload.output?.[0]?.content?.find(
      (item) => item.type === 'output_text',
    )?.text;

    return typeof firstText === 'string' ? firstText : '';
  }

  private safeParseJson(text: string) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private normalizeConfidence(value: unknown): 'low' | 'medium' | 'high' {
    return value === 'low' || value === 'medium' || value === 'high'
      ? value
      : 'medium';
  }
}
