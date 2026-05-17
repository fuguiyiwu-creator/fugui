import { NextResponse } from "next/server";

const API_URLS = {
  sandbox: "https://preprod-api.myinvois.hasil.gov.my",
  prod: "https://api.myinvois.hasil.gov.my",
};

async function getToken() {
  const clientId = process.env.MYINVOIS_CLIENT_ID;
  const secret = process.env.MYINVOIS_CLIENT_SECRET;
  const env = process.env.MYINVOIS_ENV || "prod";
  const r = await fetch(`${API_URLS[env]}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      grant_type: "client_credentials",
      scope: "InvoicingAPI",
    }),
  });
  const data = await r.json();
  return { token: data.access_token, env };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { token, env } = await getToken();

    // Build query params
    const params = new URLSearchParams();
    if (body.status) params.append("status", body.status);
    if (body.dateFrom) params.append("dateFrom", body.dateFrom);
    if (body.dateTo) params.append("dateTo", body.dateTo);
    if (body.tin) params.append("tin", body.tin);
    if (body.pageSize) params.append("pageSize", body.pageSize);
    if (body.pageNo) params.append("pageNo", body.pageNo);
    if (body.direction) params.append("direction", body.direction); // sender/receiver

    const qs = params.toString();
    const url = `${API_URLS[env]}/api/v1.0/documents/search${qs ? "?" + qs : ""}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: err.substring(0, 500) }, { status: r.status });
    }

    const data = await r.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
