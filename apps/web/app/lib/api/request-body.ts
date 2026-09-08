export const DEFAULT_REQUEST_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

export class RequestBodyTooLargeError extends Error {
  readonly actualBytes: number | null;
  readonly limitBytes: number;

  constructor(limitBytes: number, actualBytes: number | null = null) {
    super(`Request body must not exceed ${limitBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
    this.limitBytes = limitBytes;
    this.actualBytes = actualBytes;
  }
}

const textDecoder = new TextDecoder();

const getContentLength = (headers: Headers): number | null => {
  const contentLength = headers.get("content-length");
  if (!contentLength) {
    return null;
  }

  const parsedContentLength = Number(contentLength);
  if (!Number.isSafeInteger(parsedContentLength) || parsedContentLength < 0) {
    return null;
  }

  return parsedContentLength;
};

const assertBodySize = (actualBytes: number, limitBytes: number): void => {
  if (actualBytes > limitBytes) {
    throw new RequestBodyTooLargeError(limitBytes, actualBytes);
  }
};

/**
 * Read a request body as bytes, counting while reading. `Content-Length` is checked first when
 * present, but the byte count is what enforces the limit: the header can be absent or lie.
 */
export const readRequestBodyBytesWithLimit = async (
  request: Request,
  limitBytes: number = DEFAULT_REQUEST_BODY_LIMIT_BYTES
): Promise<Uint8Array> => {
  const contentLength = getContentLength(request.headers);
  if (contentLength !== null) {
    assertBodySize(contentLength, limitBytes);
  }

  if (!request.body) {
    return new Uint8Array(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    receivedBytes += value.byteLength;
    if (receivedBytes > limitBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError(limitBytes, receivedBytes);
    }

    chunks.push(value);
  }

  if (chunks.length === 1) {
    return chunks[0];
  }

  const body = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
};

export const readRequestBodyWithLimit = async (
  request: Request,
  limitBytes: number = DEFAULT_REQUEST_BODY_LIMIT_BYTES
): Promise<string> => {
  const body = await readRequestBodyBytesWithLimit(request, limitBytes);
  return body.byteLength === 0 ? "" : textDecoder.decode(body);
};

export const parseJsonBodyWithLimit = async <TJson = unknown>(
  request: Request,
  limitBytes: number = DEFAULT_REQUEST_BODY_LIMIT_BYTES
): Promise<TJson> => JSON.parse(await readRequestBodyWithLimit(request, limitBytes)) as TJson;
