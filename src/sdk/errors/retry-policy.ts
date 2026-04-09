export const BASE_BACKOFF_MS = 1000;
export const MAX_BACKOFF_MS = 30_000;

export async function backoff(attempt: number): Promise<void> {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 500;
  await new Promise((resolve) => setTimeout(resolve, delay));
}
