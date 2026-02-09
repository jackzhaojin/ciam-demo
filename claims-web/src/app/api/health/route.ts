export async function GET() {
  return Response.json({
    status: "UP",
    version: process.env.APP_VERSION || "unknown",
  });
}
