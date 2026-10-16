export interface PredictResult {
  risk: string;
  message: string;
  disclaimer: string;
}

interface RequestOptions {
  timeoutMs?: number;
  retryDelayMs?: number;
  attempts?: number;
  startupTimeoutMs?: number;
}

export async function waitForServer(baseUrl: string, timeoutMs = 90000, retryDelayMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(15000, deadline - Date.now()));
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: controller.signal, cache: 'no-store' });
      if (response.ok) {
        const health = await response.json();
        if (health.model_ready === true && health.inference_mode === 'tensorflow') return;
        if (health.model_ready === true && health.model_loading === false) {
          throw new Error('The analysis model could not start. Please try again later.');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'The analysis model could not start. Please try again later.') throw error;
      // Network errors and host error pages are transient during startup.
    } finally {
      clearTimeout(timer);
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(retryDelayMs, remaining)));
  }
  throw new Error('The server is still starting or is unavailable. Please try again shortly.');
}

export async function predictImage(
  baseUrl: string,
  file: File,
  { timeoutMs = 45000, retryDelayMs = 5000, attempts = 2, startupTimeoutMs = 90000 }: RequestOptions = {},
): Promise<PredictResult> {
  await waitForServer(baseUrl, startupTimeoutMs, retryDelayMs);
  const form = new FormData();
  form.append('image', file);
  const transientStatuses = [502, 503, 504];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let retryDelay = retryDelayMs;
    try {
      const response = await fetch(`${baseUrl}/api/v1/predict`, {
        method: 'POST', body: form, signal: controller.signal,
      });
      // Hosts can return HTML error pages while a sleeping service starts.
      const text = await response.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          retryDelay = Math.min(retryAfter * 1000, 10000);
        }
        if (!transientStatuses.includes(response.status) || attempt === attempts) {
          const detail = data && typeof data === 'object' && 'detail' in data
            && typeof data.detail === 'string' ? data.detail : null;
          const requestId = response.headers.get('X-Request-ID');
          throw new Error(`${detail ?? 'The server could not complete the analysis. Please try again shortly.'} (HTTP ${response.status}${requestId ? `, reference ${requestId}` : ''})`);
        }
      } else {
        if (!data || typeof data !== 'object'
          || !('risk' in data) || !['higher', 'lower'].includes(String(data.risk))
          || !('message' in data) || typeof data.message !== 'string'
          || !('disclaimer' in data) || typeof data.disclaimer !== 'string') {
          throw new Error('The server returned an unexpected response. Please try again.');
        }
        return data as PredictResult;
      }
    } catch (error) {
      const timedOut = controller.signal.aborted;
      const networkFailure = error instanceof TypeError;
      if ((!timedOut && !networkFailure) || attempt === attempts) {
        if (timedOut) throw new Error('The server took too long to respond. Please try again shortly.');
        if (networkFailure) throw new Error('Unable to reach the server. Check your connection and try again.');
        throw error;
      }
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
  throw new Error('Unable to complete the analysis. Please try again.');
}
