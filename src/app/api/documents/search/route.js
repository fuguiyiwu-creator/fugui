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
      client_id: clientId, client_secret: secret,
      grant_type: "client_credentials", scope: "InvoicingAPI",
    }),
  });
  const data = await r.json();
  return { token: data.access_token, env };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { token, env } = await getToken();

    const params = new URLSearchParams();

    // Search API 强制需要日期范围，默认最近7天
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (body.dateFrom) {
      params.append("submissionDateFrom", body.dateFrom + "T00:00:00Z");
      params.append("submissionDateTo", (body.dateTo || now.toISOString().split("T")[0]) + "T23:59:59Z");
    } else {
      // 默认近7天
      params.append("submissionDateFrom", sevenDaysAgo.toISOString());
      params.append("submissionDateTo", now.toISOString());
    }

    if (body.pageSize) params.append("pageSize", body.pageSize);
    if (body.pageNo) params.append("pageNo", body.pageNo);

    // 状态值映射
    const statusMap = { "1": "Submitted", "2": "Valid", "3": "Invalid", "4": "Cancelled" };
    if (body.status && statusMap[body.status]) params.append("status", statusMap[body.status]);

    // 方向
    if (body.direction) {
      const dir = body.direction === "sender" ? "Sent" : body.direction === "receiver" ? "Received" : body.direction;
      params.append("invoiceDirection", dir);
    }

    const qs = params.toString();
    const url = `${API_URLS[env]}/api/v1.0/documents/search${qs ? "?" + qs : ""}`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

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
