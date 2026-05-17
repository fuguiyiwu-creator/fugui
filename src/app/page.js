"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [configOk, setConfigOk] = useState(false);
  const [env, setEnv] = useState("prod");
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 15;

  // 筛选条件
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "",
    keyword: "",
  });

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      setEnv(d.env);
      setConfigOk(d.hasClientId && d.hasSecret && d.hasTin);
    });
  }, []);

  async function loadDocs(pageNo = 1) {
    setLoading(true);
    setError("");
    setPage(pageNo);
    try {
      const body = { pageSize, pageNo };
      if (filters.dateFrom) {
        body.dateFrom = filters.dateFrom;
        body.dateTo = filters.dateTo || new Date().toISOString().split("T")[0];
      }
      if (filters.status) body.status = filters.status;
      if (filters.keyword) body.keyword = filters.keyword;

      const r = await fetch("/api/documents/recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.error) return setError(d.error);
      setDocs(d);
      setTotalPages(d.metadata?.totalPages || 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // 格式化金额
  const fmt = (v) => v != null ? `MYR ${Number(v).toLocaleString("en", { minimumFractionDigits: 2 })}` : "-";

  // 格式化日期
  const fmtDate = (dt) => dt ? new Date(dt).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur"
  }) : "-";

  const statusColor = (s) => {
    switch (s) {
      case "Valid": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Submitted": return "bg-amber-50 text-amber-700 border-amber-200";
      case "Invalid": return "bg-red-50 text-red-700 border-red-200";
      case "Cancelled": return "bg-gray-50 text-gray-500 border-gray-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  const statusLabel = (s) => {
    switch (s) {
      case "Valid": return "有效";
      case "Submitted": return "待验证";
      case "Invalid": return "无效";
      case "Cancelled": return "已取消";
      default: return s;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              <span className="text-blue-600">富贵</span> MyInvois
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">马来西亚 LHDN 电子发票管理系统</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              configOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {env === "prod" ? "● PRODUCTION" : "● SANDBOX"}
            </span>
            {!configOk && (
              <span className="text-xs text-red-500">未配置</span>
            )}
          </div>
        </div>

        {/* 筛选区域 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">开始日期</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">结束日期</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">状态</label>
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition bg-white">
                <option value="">全部状态</option>
                <option value="Valid">有效</option>
                <option value="Submitted">待验证</option>
                <option value="Invalid">无效</option>
                <option value="Cancelled">已取消</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">关键词搜索</label>
              <input value={filters.keyword} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
                placeholder="发票号 / TIN / 名称" />
            </div>
            <div className="flex items-end">
              <button onClick={() => loadDocs(1)} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl py-2.5 text-sm font-medium transition shadow-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>查询中...</>
                ) : "🔍 查询"}
              </button>
            </div>
          </div>
        </div>

        {/* 错误 */}
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 数据表格 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 表头 */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">发票管理</h2>
            {docs && (
              <span className="text-xs text-gray-400">
                共 {docs.metadata?.totalCount || 0} 条记录
              </span>
            )}
          </div>

          {!docs && !loading && (
            <div className="py-20 text-center text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm">点击「查询」加载发票列表</p>
            </div>
          )}

          {loading && !docs && (
            <div className="py-20 text-center text-gray-400">
              <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm">加载中...</p>
            </div>
          )}

          {docs && docs.result?.length > 0 && (
            <>
              {/* 表格 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3.5">方向</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">UUID</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">Date & Time</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">e-Invoice Code</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">Buyer</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">Supplier</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">Total Amount</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {docs.result.map((doc, i) => {
                      // 判断方向：TIN 匹配判断
                      const isSent = doc.issuerTIN === doc.supplierTIN;
                      return (
                        <tr key={i} className="hover:bg-blue-50/30 transition text-sm">
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              isSent ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                            }`}>
                              {isSent ? "↑ 发出" : "↓ 接收"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <code className="text-xs text-gray-400 font-mono">{doc.uuid?.substring(0, 14)}...</code>
                          </td>
                          <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap text-xs">
                            {fmtDate(doc.dateTimeReceived || doc.dateTimeIssued)}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-gray-800">
                            {doc.internalId || doc.codeNumber || "-"}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-gray-800">{doc.buyerName || doc.receiverName || "-"}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{doc.buyerTIN || doc.receiverTIN || ""}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-gray-800">{doc.supplierName || "-"}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{doc.supplierTIN || ""}</div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-gray-800 whitespace-nowrap">
                            {fmt(doc.totalPayableAmount || doc.total)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColor(doc.status)}`}>
                              {statusLabel(doc.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  第 {page} / {totalPages} 页
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => loadDocs(1)} disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    首页
                  </button>
                  <button onClick={() => loadDocs(page - 1)} disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    上一页
                  </button>
                  {/* 页码按钮 */}
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (page <= 4) {
                      p = i + 1;
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <button key={p} onClick={() => loadDocs(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                          p === page
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                        }`}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => loadDocs(page + 1)} disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    下一页
                  </button>
                  <button onClick={() => loadDocs(totalPages)} disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    末页
                  </button>
                </div>
              </div>
            </>
          )}

          {docs && docs.result?.length === 0 && (
            <div className="py-20 text-center text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">暂无数据，试试调整筛选条件</p>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="mt-6 text-center text-xs text-gray-400">
          MyInvois · {env === "prod" ? "Production" : "Sandbox"}
        </div>
      </div>
    </div>
  );
}
