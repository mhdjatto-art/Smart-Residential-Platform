/**
 * Run a promise with a hard timeout. Throws if not resolved in `ms`.
 * Used to keep parallel DB queries (Promise.all) from blocking a request
 * forever when one upstream stalls.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  name: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) waiting for ${name}`)), ms);
  });
  return Promise.race([
    promise.finally(() => { if (timer) clearTimeout(timer); }),
    timeout,
  ]) as Promise<T>;
}
