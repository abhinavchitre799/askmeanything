/**
 * Token-aware text chunking.
 *
 * We approximate tokens rather than pulling in a tokenizer dependency: for
 * English prose ~1 token ≈ 4 characters. That is accurate enough for the MVP's
 * chunk-sizing needs (target ~800 tokens, ~150 overlap). Chunking is done on
 * word boundaries so chunks stay readable.
 */

const CHARS_PER_TOKEN = 4;

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface ChunkOptions {
  /** Target chunk size in tokens. */
  chunkTokens?: number;
  /** Overlap between consecutive chunks in tokens. */
  overlapTokens?: number;
}

/** Rough token estimate for a string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split text into overlapping chunks of approximately `chunkTokens` tokens.
 * Splits on whitespace so words are never cut in half.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const chunkTokens = options.chunkTokens ?? 800;
  const overlapTokens = options.overlapTokens ?? 150;

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const words = cleaned.split(" ");
  const maxChars = chunkTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentChars = 0;
  let chunkIndex = 0;

  const flush = () => {
    if (current.length === 0) return;
    const content = current.join(" ").trim();
    if (content) {
      chunks.push({
        content,
        chunkIndex: chunkIndex++,
        tokenCount: estimateTokens(content),
      });
    }
  };

  for (const word of words) {
    // +1 for the joining space.
    if (currentChars + word.length + 1 > maxChars && current.length > 0) {
      flush();
      // Build overlap tail from the end of the previous chunk.
      const tail: string[] = [];
      let tailChars = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const w = current[i];
        if (tailChars + w.length + 1 > overlapChars) break;
        tail.unshift(w);
        tailChars += w.length + 1;
      }
      current = tail;
      currentChars = tailChars;
    }
    current.push(word);
    currentChars += word.length + 1;
  }
  flush();

  return chunks;
}
