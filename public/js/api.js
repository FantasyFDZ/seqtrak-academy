// 和本地服务通信：普通 JSON 请求 + SSE 流式对话。

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('连不上本地服务，确认它还在运行', 'OFFLINE', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 没有响应体 */
  }
  if (!res.ok) throw new ApiError(data?.error || `请求失败 (${res.status})`, data?.code || 'ERROR', res.status);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),

  /**
   * 流式对话。onEvent 会依次收到：
   *   { engine, fallback } → { status:'thinking' }? → { delta }… → { done } 或 { error, code }
   * 返回一个可以中止的 controller。
   */
  chat({ engine, messages, contextText, format, onEvent }) {
    const controller = new AbortController();
    (async () => {
      let res;
      try {
        res = await fetch('/api/coach/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ engine, messages, contextText, format }), // format：'plan' = 排一份计划（列表），不按点评的格式答
          signal: controller.signal,
        });
      } catch (e) {
        if (e.name !== 'AbortError') onEvent({ error: '连不上本地服务，确认它还在运行', code: 'OFFLINE' });
        return;
      }
      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch {
          /* ignore */
        }
        onEvent({ error: data?.error || `请求失败 (${res.status})`, code: data?.code || 'ERROR' });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            for (const line of block.split('\n')) {
              if (!line.startsWith('data:')) continue;
              try {
                onEvent(JSON.parse(line.slice(5)));
              } catch {
                /* 忽略坏行 */
              }
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') onEvent({ error: '回答中断了', code: 'STREAM' });
      }
    })();
    return controller;
  },
};
