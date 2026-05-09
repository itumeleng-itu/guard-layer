import { createSseFrameParser, parseSseJson } from './sseParse';
import type { SseEvent, SseEventType, StreamCheckBody } from '../types/guardLayer';

/**
 * Reads a Server-Sent Events stream produced by a POST request. The browser
 * EventSource only supports GET, so the dashboard hand-rolls SSE consumption
 * over fetch + ReadableStream to match the middleware contract at
 * POST /api/transaction/check/stream.
 */
export async function consumePostSse(
  url: string,
  body: StreamCheckBody,
  onEvent: (evt: SseEvent) => void,
  opts: { signal?: AbortSignal } = {}
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Stream request failed (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }

  const parser = createSseFrameParser(({ event, data }) => {
    const payload = parseSseJson<Record<string, unknown>>(data);
    if (!payload || typeof payload !== 'object') return;
    // Cast through unknown at the network boundary: the middleware emits
    // well-known event names and shapes that match the discriminated union
    // in types/guardLayer.ts, but TypeScript cannot prove that here.
    const evt = { type: event as SseEventType, payload } as unknown as SseEvent;
    onEvent(evt);
  });

  try {
    while (true) {
      const { value, done } = await reader.read();
      parser.push(value, { done });
      if (done) break;
    }
  } finally {
    parser.reset();
  }
}
