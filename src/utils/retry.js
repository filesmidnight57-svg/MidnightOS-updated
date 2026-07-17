function isRetryable(error) {
  const status = error?.response?.status || error?.status;
  if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
  return !status || status === 408 || status === 429 || status >= 500 || /timeout|network|econnreset|temporar/i.test(error?.message || '');
}
async function retry(operation, options = {}) {
  const attempts = options.attempts || 3; const wait = options.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) { try { return await operation(attempt); } catch (caught) { error = caught; if (attempt === attempts || !isRetryable(caught)) break; await wait(250 * (2 ** (attempt - 1))); } }
  throw error;
}
module.exports = { isRetryable, retry };
