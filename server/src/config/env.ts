export const defaultClientOrigin = 'http://localhost:5173';

export function getClientOrigin(): string {
  return process.env.CLIENT_ORIGIN || defaultClientOrigin;
}

export function getPort(): number {
  const rawPort = process.env.PORT || '5000';
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}
