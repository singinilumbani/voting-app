const publicIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

export function parsePollPublicId(value: string): string | undefined {
  const input = value.trim();
  if (!input) return undefined;
  if (publicIdPattern.test(input)) return input;

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(input)
    ? input
    : `https://${input}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }

  const match = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{1,128})\/?$/);
  return match?.[1];
}
