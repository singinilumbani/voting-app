import type { Request } from 'express';

export const HOST_SESSION_COOKIE = 'host_session';

export function readHostSessionCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name !== HOST_SESSION_COOKIE) {
      continue;
    }
    try {
      return decodeURIComponent(valueParts.join('='));
    } catch (error) {
      if (error instanceof URIError) {
        return undefined;
      }
      throw error;
    }
  }
  return undefined;
}
