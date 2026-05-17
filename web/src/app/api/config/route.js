import { NextResponse } from "next/server";

// 服务端保存配置（环境变量）
export async function GET() {
  return NextResponse.json({
    env: process.env.MYINVOIS_ENV || "sandbox",
    hasClientId: !!process.env.MYINVOIS_CLIENT_ID,
    hasSecret: !!process.env.MYINVOIS_CLIENT_SECRET,
    hasTin: !!process.env.MYINVOIS_TIN,
  });
}

export async function POST(req) {
  const body = await req.json();
  // 仅验证，不持久化（Vercel 用环境变量）
  const { clientId, clientSecret, tin, env } = body;
  return NextResponse.json({
    ok: true,
    message: "请在 Vercel Dashboard → Project Settings → Environment Variables 设置",
    required: ["MYINVOIS_CLIENT_ID", "MYINVOIS_CLIENT_SECRET", "MYINVOIS_TIN"],
  });
}
