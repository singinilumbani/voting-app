export function GET() {
  return Response.json({
    status: "ok",
    buildTime: process.env.NEXT_BUILD_ID ?? "development",
  });
}
