import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Thin Anthropic (Claude) client built on fetch — no SDK dependency.
 * Reads ANTHROPIC_API_KEY + AI_MODEL from config. Exposes a plain chat helper
 * and a structured-JSON helper (via tool use) for course generation.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly endpoint = 'https://api.anthropic.com/v1/messages';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model =
      this.config.get<string>('AI_MODEL') || 'claude-sonnet-4-6';
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  private ensureConfigured() {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'AI features are not configured. Set ANTHROPIC_API_KEY on the server.',
      );
    }
  }

  private async call(body: Record<string, any>): Promise<any> {
    this.ensureConfigured();
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey as string,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, ...body }),
      });
    } catch (err) {
      this.logger.error(`AI request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not reach the AI service.');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`AI API ${res.status}: ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException(
        `AI request failed (${res.status}).`,
      );
    }
    return res.json();
  }

  /** Free-form chat. Returns the assistant's text. */
  async chat(opts: {
    system: string;
    messages: ChatMessage[];
    maxTokens?: number;
  }): Promise<string> {
    const data = await this.call({
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
    });
    return (data.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n')
      .trim();
  }

  /** Force a structured JSON result that matches `schema` (via tool use). */
  async generateJson<T = any>(opts: {
    system: string;
    prompt: string;
    schema: Record<string, any>;
    toolName?: string;
    maxTokens?: number;
  }): Promise<T> {
    const toolName = opts.toolName || 'emit';
    const data = await this.call({
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
      tools: [
        {
          name: toolName,
          description: 'Return the requested structured data.',
          input_schema: opts.schema,
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
    });
    const toolUse = (data.content || []).find(
      (c: any) => c.type === 'tool_use',
    );
    if (!toolUse?.input) {
      throw new ServiceUnavailableException(
        'AI did not return a structured result.',
      );
    }
    return toolUse.input as T;
  }
}
