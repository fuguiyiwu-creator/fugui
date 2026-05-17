"use client";
import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "myinvois_cache";
const USER_TIN = "C60122406100";

export default function Home() {
  const [configOk, setConfigOk] = useState(false);
  const [env, setEnv] = useState("prod");
  const [allDocs, setAllDocs] = useState([]);
  const [displayDocs, setDisplayDocs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [stats, setStats] = useState({ cached: 0, new: 0, total: 0 });
  const docsRef = useRef([]);
  const pageSize = 15;

  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", status: "", keyword: "" });
  const [showFilters, setShowFilters] = useState(false);

  // 初始化：读本地缓存
  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      setEnv(d.env);
      setConfigOk(d.hasClientId && d.hasSecret && d.hasTin);
    });
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const docs = data.docs || [];
        docsRef.current = docs;
        setAllDocs(docs);
        setLastSync(data.syncTime || null);
      }
    } catch {}
  }, []);

  // 应用筛选+分页
  useEffect(() => {
    let filtered = [...allDocs];
    if (filters.status) filtered = filtered.filter(d => d.status === filters.status);
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      filtered = filtered.filter(d =>
        (d.internalId || "").toLowerCase().includes(kw) ||
        (d.supplierName || "").toLowerCase().includes(kw) ||
        (d.supplierTIN || "").toLowerCase().includes(kw) ||
        (d.receiverName || "").toLowerCase().includes(kw) ||
        (d.receiverTIN || "").toLowerCase().includes(kw) ||
        (d.uuid || "").toLowerCase().includes(kw)
      );
    }
    const total = filtered.length;
    setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
    const start = (page - 1) * pageSize;
    setDisplayDocs(filtered.slice(start, start + pageSize));
  }, [allDocs, filters, page]);

  // 同步数据：从 2026-01-01 拉取，按 UUID 去重
  async function syncData() {
    setSyncing(true);
    setError("");
    let newCount = 0;
    const existing = docsRef.current;
    const existingUuids = new Set(existing.map(d => d.uuid));

    try {
      let pageNo = 1;
      let hasMore = true;

      while (hasMore) {
        const r = await fetch("/api/documents/recent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dateFrom: "2026-01-01",
            pageSize: 100,
            pageNo,
          }),
        });
        const data = await r.json();
        if (data.error) { setError(data.error); break; }
        if (!data.result?.length) break;

        for (const doc of data.result) {
          if (!existingUuids.has(doc.uuid)) {
            existing.push(doc);
            existingUuids.add(doc.uuid);
            newCount++;
          }
        }

        const total = data.metadata?.totalPages || 1;
        hasMore = pageNo < total;
        pageNo++;
      }

      const finalDocs = [...existing];
      const newData = { docs: finalDocs, syncTime: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      docsRef.current = finalDocs;
      setAllDocs(finalDocs);
      setLastSync(newData.syncTime);
      setStats({ cached: finalDocs.length - newCount, new: newCount, total: finalDocs.length });
      setPage(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  // 判断方向
  const getDirection = (doc) => {
    // 我方为供应商 → 发出；我方为接收方 → 接收
    if (doc.supplierTIN === USER_TIN) return "sent";
    if (doc.receiverTIN === USER_TIN || doc.buyerTIN === USER_TIN) return "received";
    if (doc.issuerTIN === USER_TIN) return "sent";
    return "unknown";
  };

  const fmt = (v) => v != null ? `MYR ${Number(v).toLocaleString("en", { minimumFractionDigits: 2 })}` : "-";
  const fmtDate = (dt) => dt ? new Date(dt).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur"
  }) : "-";
  const fmtTime = (ts) => ts ? new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur"
  }) : "";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              富
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">富贵 MyInvois</h1>
              <p className="text-xs text-gray-400">LHDN 电子发票管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="text-xs text-gray-400 hidden sm:block">
                上次同步 {fmtTime(lastSync)}
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
              configOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {env === "prod" ? "PROD" : "SANDBOX"}
            </span>
          </div>
        </div>

        {/* 操作栏 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100/80 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={syncData} disabled={syncing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-300 disabled:to-indigo-300 text-white rounded-xl text-sm font-medium shadow-sm transition-all active:scale-[0.97]">
              {syncing ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>同步中...</>
              ) : "🔄 同步发票"}
            </button>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition ${
                showFilters ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {showFilters ? "收起筛选 ▲" : "筛选 ▼"}
            </button>
            {stats.total > 0 && (
              <div className="text-xs text-gray-400 ml-auto">
                缓存 <span className="font-medium text-gray-600">{stats.cached}</span> 条 · 
                新增 <span className="font-medium text-blue-600">{stats.new}</span> 条 ·
                共 <span className="font-medium text-gray-800">{stats.total}</span> 条
              </div>
            )}
          </div>

          {/* 筛选面板 */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">开始日期</label>
                <input type="date" value={filters.dateFrom} onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">结束日期</label>
                <input type="date" value={filters.dateTo} onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">状态</label>
                <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition bg-white">
                  <option value="">全部</option>
                  <option value="Valid">有效</option>
                  <option value="Submitted">待验证</option>
                  <option value="Invalid">无效</option>
                  <option value="Cancelled">已取消</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">关键词</label>
                <input value={filters.keyword} onChange={e => { setFilters(f => ({ ...f, keyword: e.target.value })); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
                  placeholder="发票号 / TIN / 名称" />
              </div>
              <div className="flex items-end">
                <span className="text-xs text-gray-400 self-center">共 {allDocs.length} 条</span>
              </div>
            </div>
          )}
        </div>

        {/* 错误 */}
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {/* 同步提示 */}
        {syncing && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-700 shadow-sm flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            正在从 MyInvois 同步发票数据（从 2026-01-01 开始），跳过已缓存记录...
          </div>
        )}

        {/* 表格卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden backdrop-blur-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <span>📋</span> 发票管理
              {!loading && allDocs.length > 0 && (
                <span className="text-xs font-normal text-gray-400">（第 {page}/{totalPages} 页）</span>
              )}
            </h2>
            <button onClick={() => { docsRef.current = []; setAllDocs([]); localStorage.removeItem(STORAGE_KEY); setStats({ cached: 0, new: 0, total: 0 }); setLastSync(null); }}
              className="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1 rounded-lg hover:bg-red-50">
              清除缓存
            </button>
          </div>

          {allDocs.length === 0 && !syncing && (
            <div className="py-20 text-center text-gray-400">
              <div className="text-5xl mb-3 opacity-50">📋</div>
              <p className="text-sm">点击「同步发票」从 MyInvois 拉取数据</p>
              <p className="text-xs text-gray-300 mt-1.5">从 2026-01-01 开始，自动跳过已缓存的发票</p>
            </div>
          )}

          {displayDocs.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80">
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
                    {displayDocs.map((doc, i) => {
                      const dir = getDirection(doc);
                      return (
                        <tr key={doc.uuid || i} className="hover:bg-blue-50/40 transition-all text-sm group">
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              dir === "sent" ? "bg-sky-50 text-sky-600 border border-sky-200" :
                              dir === "received" ? "bg-violet-50 text-violet-600 border border-violet-200" :
                              "bg-gray-50 text-gray-400 border border-gray-200"
                            }`}>
                              {dir === "sent" ? "↑ 发出" : dir === "received" ? "↓ 接收" : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <code className="text-xs text-gray-400 font-mono group-hover:text-gray-600 transition">{doc.uuid?.substring(0, 14)}...</code>
                          </td>
                          <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap text-xs font-medium">
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
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-800 whitespace-nowrap tabular-nums">
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
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-gray-400">
                  共 {allDocs.length} 条 · {page}/{totalPages} 页
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(1)} disabled={page <= 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-gray-600">◀◀</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-gray-600">◀</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let p;
                    if (totalPages <= 5) p = i + 1;
                    else if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                          p === page ? "bg-blue-600 text-white shadow-sm" : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                        }`}>{p}</button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-gray-600">▶</button>
                  <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-gray-600">▶▶</button>
                </div>
              </div>
            </>
          )}

          {allDocs.length > 0 && displayDocs.length === 0 && !syncing && (
            <div className="py-16 text-center text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm">筛选条件无匹配结果</p>
              <button onClick={() => setFilters({ dateFrom: "", dateTo: "", status: "", keyword: "" })}
                className="mt-2 text-xs text-blue-500 hover:text-blue-700">清除筛选</button>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="mt-6 text-center text-xs text-gray-400">
          MyInvois · {env === "prod" ? "Production" : "Sandbox"} · 富贵
        </div>
      </div>
    </div>
  );
}
