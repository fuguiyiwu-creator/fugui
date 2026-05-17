import { NextResponse } from "next/server";

const IDENTITY_URLS = {
  sandbox: "https://preprod-api.myinvois.hasil.gov.my",
  prod: "https://api.myinvois.hasil.gov.my",
};

export async function POST() {
  const clientId = process.env.MYINVOIS_CLIENT_ID;
  const secret = process.env.MYINVOIS_CLIENT_SECRET;
  const env = process.env.MYINVOIS_ENV || "sandbox";

  if (!clientId || !secret) {
    return NextResponse.json(
      { error: "Client ID / Secret 未配置" },
      { status: 400 }
    );
  }

  try {
    const r = await fetch(`${IDENTITY_URLS[env]}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        grant_type: "client_credentials",
        scope: "InvoicingAPI",
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json(
        { error: `认证失败: ${err}` },
        { status: r.status }
      );
    }

    const data = await r.json();
    return NextResponse.json({
      access_token: data.access_token?.substring(0, 20) + "...",
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
      ok: true,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
