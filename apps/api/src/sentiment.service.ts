import { Injectable, Logger } from '@nestjs/common';

export type SentimentResult = {
  score: number;
  magnitude: number;
};

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);

  private apiKey() {
    return (
      process.env.GOOGLE_NATURAL_LANGUAGE_API_KEY?.trim() ||
      process.env.GOOGLE_PLACES_API_KEY?.trim() ||
      ''
    );
  }

  /** Analiza el sentimiento de un comentario con Cloud Natural Language. */
  async analyzeComment(text: string): Promise<SentimentResult | null> {
    const key = this.apiKey();
    if (!key) {
      this.logger.warn('[Sentiment] sin API key, se omite análisis');
      return null;
    }

    try {
      const res = await fetch(
        `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document: {
              type: 'PLAIN_TEXT',
              content: text.slice(0, 5000),
              language: 'es',
            },
            encodingType: 'UTF8',
          }),
        }
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        documentSentiment?: { score?: number; magnitude?: number };
      };
      const sentiment = data.documentSentiment;
      if (
        typeof sentiment?.score !== 'number' ||
        typeof sentiment?.magnitude !== 'number'
      ) {
        this.logger.warn('[Sentiment] respuesta sin documentSentiment');
        return null;
      }
      return { score: sentiment.score, magnitude: sentiment.magnitude };
    } catch (err) {
      this.logger.warn(
        `Sentiment analisis falló: ${err instanceof Error ? err.message : err}`
      );
      return null;
    }
  }
}
