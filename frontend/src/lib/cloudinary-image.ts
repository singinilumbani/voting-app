export function withCloudinaryCandidateTransform(
  source: string,
  width: number,
): string {
  if (!source.includes("res.cloudinary.com/") || !source.includes("/upload/")) {
    return source;
  }
  if (/\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(source)) {
    return source;
  }
  return source.replace(
    "/upload/",
    `/upload/f_auto,q_auto,w_${Math.max(64, width)}/`,
  );
}
