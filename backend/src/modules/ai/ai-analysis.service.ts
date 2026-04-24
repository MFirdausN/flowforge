import { Injectable, NotFoundException } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { serializeBigInt } from '../../common/utils/serialize-bigint';
import { ContentReviewDto } from './dto/content-review.dto';

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

type ContentReviewResult = {
  source: 'heuristic' | 'llm';
  seo: {
    score: number;
    titleLengthOk: boolean;
    excerptLengthOk: boolean;
    keywordDensity: 'low' | 'balanced' | 'high';
    notes: string[];
  };
  plagiarism: {
    risk: 'low' | 'medium' | 'high';
    score: number;
    repeatedSentenceCount: number;
    notes: string[];
  };
  sensitiveContent: {
    risk: 'low' | 'medium' | 'high';
    score: number;
    categories: string[];
    notes: string[];
  };
  summary: string;
  recommendation: 'approve' | 'review' | 'revise';
  checkedAt: string;
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

  async reviewPostContent(input: ContentReviewDto): Promise<ContentReviewResult> {
    const heuristicReview = this.buildHeuristicContentReview(input);
    const llmReview = await this.tryReviewContentWithLlm(input);

    return llmReview ?? heuristicReview;
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

  private buildHeuristicContentReview(
    input: ContentReviewDto,
  ): ContentReviewResult {
    const rawText = `${input.title} ${input.excerpt ?? ''} ${input.content}`.trim();
    const normalizedText = rawText.replace(/\s+/g, ' ').trim();
    const words = normalizedText
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const uniqueWords = new Set(words);
    const keywordDensityRatio = words.length === 0 ? 0 : uniqueWords.size / words.length;

    const titleLength = input.title.trim().length;
    const excerptLength = input.excerpt?.trim().length ?? 0;
    const sentences = input.content
      .split(/[.!?]\s+/)
      .map((sentence) => sentence.trim().toLowerCase())
      .filter((sentence) => sentence.length > 20);

    const sentenceCounts = new Map<string, number>();
    for (const sentence of sentences) {
      sentenceCounts.set(sentence, (sentenceCounts.get(sentence) ?? 0) + 1);
    }

    const repeatedSentenceCount = [...sentenceCounts.values()].filter(
      (count) => count > 1,
    ).length;

    const sensitiveKeywords = [
      'violence',
      'kill',
      'blood',
      'weapon',
      'suicide',
      'sexual',
      'porn',
      'hate',
      'racist',
      'terror',
      'drugs',
      'gambling',
    ];
    const foundSensitiveKeywords = sensitiveKeywords.filter((keyword) =>
      normalizedText.toLowerCase().includes(keyword),
    );

    const seoNotes: string[] = [];
    const titleLengthOk = titleLength >= 30 && titleLength <= 60;
    const excerptLengthOk = excerptLength === 0 || (excerptLength >= 80 && excerptLength <= 160);

    if (!titleLengthOk) {
      seoNotes.push('Title idealnya berada di rentang 30-60 karakter.');
    }

    if (!excerptLengthOk) {
      seoNotes.push('Excerpt idealnya sekitar 80-160 karakter untuk preview dan SEO.');
    }

    if (words.length < 120) {
      seoNotes.push('Konten masih pendek; artikel yang lebih komprehensif biasanya lebih kuat untuk SEO.');
    }

    const keywordDensity =
      keywordDensityRatio < 0.45 ? 'high' : keywordDensityRatio > 0.75 ? 'low' : 'balanced';

    if (keywordDensity === 'high') {
      seoNotes.push('Kosakata terlalu berulang; variasikan diksi agar tidak terlihat seperti keyword stuffing.');
    }

    const seoScore = Math.max(
      20,
      Math.min(
        100,
        78 +
          (titleLengthOk ? 8 : -8) +
          (excerptLengthOk ? 6 : -6) +
          (words.length >= 120 ? 6 : -8) +
          (keywordDensity === 'balanced' ? 8 : keywordDensity === 'low' ? -4 : -10),
      ),
    );

    const plagiarismNotes: string[] = [];
    let plagiarismRisk: 'low' | 'medium' | 'high' = 'low';
    let plagiarismScore = 12;

    if (repeatedSentenceCount > 0) {
      plagiarismNotes.push(
        `${repeatedSentenceCount} kalimat terdeteksi berulang dan sebaiknya dirapikan.`,
      );
      plagiarismScore += repeatedSentenceCount * 12;
    }

    if (keywordDensity === 'high') {
      plagiarismNotes.push('Pola repetisi tinggi dapat mengindikasikan teks terlalu templated.');
      plagiarismScore += 10;
    }

    if (repeatedSentenceCount >= 3) {
      plagiarismRisk = 'high';
    } else if (repeatedSentenceCount >= 1) {
      plagiarismRisk = 'medium';
    }

    plagiarismScore = Math.max(0, Math.min(100, plagiarismScore));

    const sensitiveNotes: string[] = [];
    let sensitiveRisk: 'low' | 'medium' | 'high' = 'low';
    let sensitiveScore = foundSensitiveKeywords.length * 14;

    if (foundSensitiveKeywords.length > 0) {
      sensitiveNotes.push(
        `Terdeteksi kata sensitif: ${foundSensitiveKeywords.slice(0, 6).join(', ')}.`,
      );
    }

    if (foundSensitiveKeywords.length >= 4) {
      sensitiveRisk = 'high';
    } else if (foundSensitiveKeywords.length >= 1) {
      sensitiveRisk = 'medium';
    }

    sensitiveScore = Math.max(0, Math.min(100, sensitiveScore));

    if (sensitiveNotes.length === 0) {
      sensitiveNotes.push('Tidak ada indikasi kuat konten sensitif dari heuristik dasar.');
    }

    if (plagiarismNotes.length === 0) {
      plagiarismNotes.push('Tidak ada pola repetisi tinggi yang menonjol dari heuristik dasar.');
    }

    if (seoNotes.length === 0) {
      seoNotes.push('Struktur dasar artikel sudah cukup sehat untuk SEO dari sisi heuristik.');
    }

    const recommendation =
      plagiarismRisk === 'high' || sensitiveRisk === 'high'
        ? 'revise'
        : plagiarismRisk === 'medium' || sensitiveRisk === 'medium' || seoScore < 65
          ? 'review'
          : 'approve';

    return {
      source: 'heuristic',
      seo: {
        score: seoScore,
        titleLengthOk,
        excerptLengthOk,
        keywordDensity,
        notes: seoNotes,
      },
      plagiarism: {
        risk: plagiarismRisk,
        score: plagiarismScore,
        repeatedSentenceCount,
        notes: plagiarismNotes,
      },
      sensitiveContent: {
        risk: sensitiveRisk,
        score: sensitiveScore,
        categories: foundSensitiveKeywords,
        notes: sensitiveNotes,
      },
      summary:
        recommendation === 'approve'
          ? 'Konten terlihat cukup aman dan siap dilanjutkan ke alur editorial.'
          : recommendation === 'review'
            ? 'Konten layak ditinjau dulu sebelum dipublikasikan.'
            : 'Konten sebaiknya direvisi dulu sebelum masuk ke tahap berikutnya.',
      recommendation,
      checkedAt: new Date().toISOString(),
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

    if (
      context.status === RunStatus.TIMEOUT ||
      combinedError.includes('timed out')
    ) {
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
        likelyCause:
          'The workflow definition contains a step type that the engine cannot execute yet.',
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

  private async tryAnalyzeWithLlm(
    context: any,
  ): Promise<FailureAnalysis | null> {
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

      const payload = await response.json();
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

  private async tryReviewContentWithLlm(
    input: ContentReviewDto,
  ): Promise<ContentReviewResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

    if (!apiKey) {
      return null;
    }

    const prompt = `You are reviewing a blog draft before publication.
Return only valid JSON with this exact shape:
{
  "seo": { "score": number, "titleLengthOk": boolean, "excerptLengthOk": boolean, "keywordDensity": "low"|"balanced"|"high", "notes": string[] },
  "plagiarism": { "risk": "low"|"medium"|"high", "score": number, "repeatedSentenceCount": number, "notes": string[] },
  "sensitiveContent": { "risk": "low"|"medium"|"high", "score": number, "categories": string[], "notes": string[] },
  "summary": string,
  "recommendation": "approve"|"review"|"revise"
}

Rules:
- Do not claim exact plagiarism detection against the whole internet.
- Treat plagiarism as similarity/repetition risk only.
- Keep notes concise and actionable.

Draft:
${JSON.stringify(input).slice(0, 10000)}`;

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
          max_output_tokens: 800,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const text = this.extractResponseText(payload);
      const parsed = this.safeParseJson(text);

      if (!parsed) {
        return null;
      }

      return {
        source: 'llm',
        seo: {
          score: this.normalizeScore(parsed.seo?.score, 70),
          titleLengthOk: Boolean(parsed.seo?.titleLengthOk),
          excerptLengthOk: Boolean(parsed.seo?.excerptLengthOk),
          keywordDensity: this.normalizeKeywordDensity(parsed.seo?.keywordDensity),
          notes: this.normalizeNotes(parsed.seo?.notes, 'No SEO notes provided.'),
        },
        plagiarism: {
          risk: this.normalizeRisk(parsed.plagiarism?.risk),
          score: this.normalizeScore(parsed.plagiarism?.score, 20),
          repeatedSentenceCount: Number(parsed.plagiarism?.repeatedSentenceCount ?? 0),
          notes: this.normalizeNotes(
            parsed.plagiarism?.notes,
            'No plagiarism-risk notes provided.',
          ),
        },
        sensitiveContent: {
          risk: this.normalizeRisk(parsed.sensitiveContent?.risk),
          score: this.normalizeScore(parsed.sensitiveContent?.score, 10),
          categories: Array.isArray(parsed.sensitiveContent?.categories)
            ? parsed.sensitiveContent.categories.map((value) => String(value))
            : [],
          notes: this.normalizeNotes(
            parsed.sensitiveContent?.notes,
            'No sensitive-content notes provided.',
          ),
        },
        summary: String(parsed.summary ?? 'Draft reviewed with AI assistance.'),
        recommendation: this.normalizeRecommendation(parsed.recommendation),
        checkedAt: new Date().toISOString(),
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
    result: Pick<
      FailureAnalysis,
      'likelyCause' | 'suggestedFix' | 'confidence'
    >,
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

  private normalizeRisk(value: unknown): 'low' | 'medium' | 'high' {
    return value === 'low' || value === 'medium' || value === 'high'
      ? value
      : 'medium';
  }

  private normalizeRecommendation(value: unknown): 'approve' | 'review' | 'revise' {
    return value === 'approve' || value === 'review' || value === 'revise'
      ? value
      : 'review';
  }

  private normalizeKeywordDensity(value: unknown): 'low' | 'balanced' | 'high' {
    return value === 'low' || value === 'balanced' || value === 'high'
      ? value
      : 'balanced';
  }

  private normalizeNotes(value: unknown, fallback: string): string[] {
    if (!Array.isArray(value)) {
      return [fallback];
    }

    const notes = value.map((item) => String(item)).filter(Boolean);
    return notes.length > 0 ? notes : [fallback];
  }

  private normalizeScore(value: unknown, fallback: number): number {
    const score = Number(value);
    if (Number.isNaN(score)) {
      return fallback;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
