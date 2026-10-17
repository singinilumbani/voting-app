const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input));
  return toHex(new Uint8Array(digest));
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return toHex(new Uint8Array(signature));
}

export async function hashIp(secret: string, ip: string): Promise<string> {
  return hmacHex(secret, `ip:${ip}`);
}

export async function hashFingerprint(secret: string, fingerprint: string): Promise<string> {
  return hmacHex(secret, `fp:${fingerprint}`);
}
