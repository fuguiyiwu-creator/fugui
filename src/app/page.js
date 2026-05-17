"use client";
import { useState, useEffect } from "react";

const STATUS_MAP = { 1: "待验证", 2: "有效", 3: "无效", 4: "已取消" };

export default function Home() {
  const [tab, setTab] = useState("submit");
  const [env, setEnv] = useState("sandbox");
  const [configOk, setConfigOk] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tinInfo, setTinInfo] = useState(null);
  const [tinInput, setTinInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [pollId, setPollId] = useState("");
  const [pollResult, setPollResult] = useState(null);

  // ── 表单数据 ──
  const [form, setForm] = useState({
    supplierTin: "",
    supplierName: "",
    buyerTin: "",
    buyerName: "",
    invoiceNo: `SB-${Date.now()}`,
    issueDate: new Date().toISOString().split("T")[0],
    lines: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0.08 }],
  });

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      setEnv(d.env);
      setConfigOk(d.hasClientId && d.hasSecret && d.hasTin);
    });
  }, []);

  // ── 测试 Token ──
  async function testToken() {
    setError(""); setTokenInfo(null);
    const r = await fetch("/api/token", { method: "POST" });
    const d = await r.json();
    if (d.error) return setError(d.error);
    setTokenInfo(d);
  }

  // ── 验证 TIN ──
  async function verifyTin() {
    setError(""); setTinInfo(null);
    const r = await fetch("/api/verify-tin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tin: tinInput }),
    });
    const d = await r.json();
    if (d.error) return setError(d.error);
    setTinInfo(d);
  }

  // ── 提交发票 ──
  async function submitInvoice() {
    setError(""); setResult(null); setSubmitting(true);
    try {
      const r = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.error) return setError(d.error);
      setResult(d);
      setPollId(d.submissionUID || "");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 轮询状态 ──
  async function pollStatus() {
    if (!pollId) return;
    setError(""); setPollResult(null);
    const r = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: pollId }),
    });
    const d = await r.json();
    if (d.error) return setError(d.error);
    setPollResult(d);
  }

  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { description: "", quantity: 1, unitPrice: 0, taxRate: 0.08 }] }));
  }

  function updLine(i, field, val) {
    const lines = [...form.lines];
    lines[i][field] = val;
    setForm(f => ({ ...f, lines }));
  }

  function delLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  // ── 渲染 ──
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">富贵 MyInvois</h1>
          <p className="text-sm text-gray-500">LHDN 电子发票自动提交系统</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${configOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {env.toUpperCase()} {configOk ? "已配置" : "未配置"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {[
          { k: "submit", label: "📄 提交发票" },
          { k: "tools", label: "🔧 检测工具" },
          { k: "status", label: "📊 查询状态" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition
              ${tab === t.k ? "bg-white border border-b-white -mb-px text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Error */}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 whitespace-pre-wrap">{error}</div>}

      {/* Tab: Submit */}
      {tab === "submit" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">供应商 TIN *</label>
              <input value={form.supplierTin} onChange={e => setForm(f => ({ ...f, supplierTin: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="C1234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">供应商名称 *</label>
              <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="供应商公司 Sdn Bhd" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">购买方 TIN *（你的 TIN）</label>
              <input value={form.buyerTin} onChange={e => setForm(f => ({ ...f, buyerTin: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">购买方名称</label>
              <input value={form.buyerName} onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发票号</label>
              <input value={form.invoiceNo} onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开票日期</label>
              <input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">发票行</label>
              <button onClick={addLine} className="text-xs text-blue-600 hover:text-blue-800">+ 添加行</button>
            </div>
            <div className="space-y-2">
              {form.lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={line.description} onChange={e => updLine(i, "description", e.target.value)}
                    className="flex-1 border rounded px-2 py-1.5 text-sm" placeholder="描述" />
                  <input type="number" value={line.quantity} onChange={e => updLine(i, "quantity", +e.target.value)}
                    className="w-16 border rounded px-2 py-1.5 text-sm" placeholder="数量" />
                  <input type="number" step="0.01" value={line.unitPrice} onChange={e => updLine(i, "unitPrice", +e.target.value)}
                    className="w-24 border rounded px-2 py-1.5 text-sm" placeholder="单价" />
                  <input type="number" step="0.01" value={line.taxRate} onChange={e => updLine(i, "taxRate", +e.target.value)}
                    className="w-20 border rounded px-2 py-1.5 text-sm" placeholder="税率" />
                  <span className="text-xs text-gray-400 self-center w-16 px-1">
                    ¥{(line.quantity * line.unitPrice * (1 + line.taxRate)).toFixed(2)}
                  </span>
                  {form.lines.length > 1 && (
                    <button onClick={() => delLine(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={submitInvoice} disabled={submitting || !configOk}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg py-2.5 font-medium transition">
            {submitting ? "提交中..." : "提交到 MyInvois"}
          </button>

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
              <p className="font-medium text-green-700 mb-1">✅ 提交成功</p>
              <p className="text-gray-600">Submission ID: {result.submissionUID}</p>
              {result.acceptedDocuments?.map(d => (
                <p key={d.uuid} className="text-gray-500 text-xs mt-1">
                  📄 {d.internalId} → {d.uuid}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Tools */}
      {tab === "tools" && (
        <div className="space-y-4">
          {/* Token Test */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-medium mb-3">🔑 Token 测试</h3>
            <button onClick={testToken} className="bg-gray-800 hover:bg-gray-900 text-white rounded-lg px-4 py-2 text-sm">
              获取 Token
            </button>
            {tokenInfo && (
              <div className="mt-3 p-3 bg-gray-50 rounded text-sm space-y-1">
                <p><span className="text-gray-500">Token:</span> <code className="text-xs">{tokenInfo.access_token}</code></p>
                <p><span className="text-gray-500">有效期:</span> {tokenInfo.expires_in}s</p>
                <p><span className="text-gray-500">Scope:</span> {tokenInfo.scope}</p>
              </div>
            )}
          </div>

          {/* TIN Verify */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-medium mb-3">✅ 验证 TIN</h3>
            <div className="flex gap-2">
              <input value={tinInput} onChange={e => setTinInput(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="输入 TIN (如 C1234567890)" />
              <button onClick={verifyTin} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm">
                验证
              </button>
            </div>
            {tinInfo && (
              <div className="mt-3 p-3 bg-green-50 rounded text-sm">
                <p className="text-green-700 font-medium">✅ 有效</p>
                <p className="text-gray-600 mt-1">TIN: {tinInfo.tin} | 名称: {tinInfo.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Status */}
      {tab === "status" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="font-medium">📊 查询提交状态</h3>
          <div className="flex gap-2">
            <input value={pollId} onChange={e => setPollId(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Submission UUID" />
            <button onClick={pollStatus} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm">
              查询
            </button>
          </div>
          {pollResult && (
            <div className="p-4 bg-gray-50 rounded-lg text-sm">
              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(pollResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400">
        MyInvois SDK v1.0 · {env === "sandbox" ? "Sandbox" : "Production"} · {configOk ? "已配置" : "请在 Vercel 环境变量中配置 MYINVOIS_CLIENT_ID / MYINVOIS_CLIENT_SECRET / MYINVOIS_TIN"}
      </div>
    </div>
  );
}
