/** Extract a user-visible error message from an axios/API failure (including blob responses). */
export async function getApiErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (!err || typeof err !== 'object' || !('response' in err)) {
    return fallback;
  }

  const response = (err as { response?: { data?: unknown } }).response;
  const data = response?.data;

  if (!data) {
    return fallback;
  }

  if (typeof data === 'object' && data !== null && 'error' in data) {
    const message = (data as { error?: string }).error;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      if (!text.trim()) {
        return fallback;
      }

      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        return parsed.error || parsed.message || text;
      } catch {
        return text;
      }
    } catch {
      return fallback;
    }
  }

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  return fallback;
}
