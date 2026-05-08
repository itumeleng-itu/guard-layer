/**
 * Incremental parser for Server-Sent Events delivered over a fetch byte stream.
 * Buffers partial frames between chunks and invokes onFrame once per complete
 * SSE message (terminated by a blank line). Default event name is "message"
 * to match the WHATWG SSE spec when the server omits an event: line.
 */

export interface SseFrame {
  event: string;
  data: string;
}

export interface SseParser {
  push(chunk: Uint8Array | undefined, opts?: { done?: boolean }): void;
  reset(): void;
}

export function createSseFrameParser(onFrame: (frame: SseFrame) => void): SseParser {
  let carry = '';
  const decoder = new TextDecoder();

  const flushBlocks = (text: string): string => {
    // Normalize CRLF to LF so block splitting handles either line ending.
    const normalized = text.replace(/\r\n/g, '\n');
    const blocks = normalized.split('\n\n');
    const incomplete = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      let eventName = 'message';
      const dataParts: string[] = [];
      for (const rawLine of block.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() || 'message';
        } else if (line.startsWith('data:')) {
          // SSE spec: a single leading space after "data:" is stripped.
          const rest = line.slice(5);
          dataParts.push(rest.startsWith(' ') ? rest.slice(1) : rest);
        }
      }
      onFrame({ event: eventName, data: dataParts.join('\n') });
    }
    return incomplete;
  };

  return {
    push(chunk, opts = {}) {
      if (chunk && chunk.length) {
        carry += decoder.decode(chunk, { stream: !opts.done });
      } else if (opts.done) {
        carry += decoder.decode(new Uint8Array(), { stream: false });
      }
      carry = flushBlocks(carry);
    },
    reset() {
      carry = '';
    },
  };
}

/**
 * Parse the JSON body emitted on a `data:` line. Returns null on empty input
 * or invalid JSON so callers can decide whether to log or silently skip.
 */
export function parseSseJson<T = unknown>(data: string): T | null {
  const trimmed = data.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}
