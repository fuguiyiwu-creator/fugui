import { NextResponse } from "next/server";

const API_URLS = {
  sandbox: "https://preprod-api.myinvois.hasil.gov.my",
  prod: "https://api.myinvois.hasil.gov.my",
};

async function getToken() {
  const clientId = process.env.MYINVOIS_CLIENT_ID;
  const secret = process.env.MYINVOIS_CLIENT_SECRET;
  const env = process.env.MYINVOIS_ENV || "sandbox";

  const r = await fetch(`${API_URLS[env]}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
  });
  const data = await r.json();
  return { token: data.access_token, env };
}

export async function POST(req) {
  try {
    const { tin } = await req.json();
    if (!tin) {
      return NextResponse.json({ error: "请输入 TIN" }, { status: 400 });
    }

    const { token, env } = await getToken();
    const r = await fetch(`${API_URLS[env]}/api/v1.0/taxpayer/${tin}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json(
        { error: `验证失败: ${err.substring(0, 200)}` },
        { status: r.status }
      );
    }

    const data = await r.json();
    return NextResponse.json({ ok: true, name: data.name, tin, info: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
