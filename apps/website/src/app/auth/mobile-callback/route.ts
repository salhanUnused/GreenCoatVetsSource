import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth landing page for the GreenCoatVets mobile app.
 * Supabase redirects here (HTTPS — already allowed for the website), then we
 * bounce into the native app via greencoatvets://auth/callback?code=...
 */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  const appUrl = `greencoatvets://auth/callback${search}`;
  const safeAppUrl = appUrl.replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GreenCoatVets</title>
  <meta http-equiv="refresh" content="0;url=${safeAppUrl}" />
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; background: #f7f8fa; color: #171c1f; }
    .box { text-align: center; padding: 24px; max-width: 320px; }
    a { color: #006c50; font-weight: 700; }
  </style>
</head>
<body>
  <div class="box">
    <p>Returning to the GreenCoatVets app…</p>
    <p><a href="${safeAppUrl}">Tap here if the app does not open</a></p>
  </div>
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
