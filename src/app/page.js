"use client";
import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "myinvois_cache";
const USER_TIN = "C60122406100";

const BADGE = {
  Valid: { label: "有效", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  Submitted: { label: "待验证", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  Invalid: { label: "无效", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  Cancelled: { label: "已取消", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

export default function Home() {
  const [ready, setReady] = useState(false);
  const [env, setEnv] = useState("prod");
  const [docs, setDocs] = useState([]);
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [stats, setStats] = useState({ cache: 0, fresh: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const cache = useRef([]);
  const PAGE_SIZE = 15;

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      setEnv(d.env);
      setReady(d.hasClientId && d.hasSecret && d.hasTin);
    });
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { docs: d, syncTime } = JSON.parse(saved);
        cache.current = d || [];
        setDocs(d || []);
        setLastSync(syncTime);
      }
    } catch {}
  }, []);

  // 本地筛选
  const filtered = docs.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${d.internalId||""} ${d.supplierName||""} ${d.supplierTIN||""} ${d.receiverName||""} ${d.receiverTIN||""} ${d.uuid||""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 方向
  const dir = (d) =>
    d.supplierTIN === USER_TIN ? "sent" :
    d.receiverTIN === USER_TIN || d.buyerTIN === USER_TIN ? "recv" : "other";

  async function sync() {
    setSyncing(true); setError("");
    const existing = cache.current;
    const known = new Set(existing.map(d => d.uuid));
    let fresh = 0, pn = 1, more = true;
    try {
      while (more) {
        const r = await fetch("/api/documents/recent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dateFrom: "2026-01-01", pageSize: 100, pageNo: pn }),
        });
        const data = await r.json();
        if (data.error) { setError(data.error); break; }
        if (!data.result?.length) break;
        for (const doc of data.result) {
          if (!known.has(doc.uuid)) { existing.push(doc); known.add(doc.uuid); fresh++; }
        }
        more = pn < (data.metadata?.totalPages || 1);
        pn++;
      }
      const all = [...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ docs: all, syncTime: new Date().toISOString() }));
      cache.current = all; setDocs(all); setLastSync(new Date().toISOString());
      setStats(s => ({ ...s, cache: all.length - fresh, fresh }));
      setPage(1);
    } catch (e) { setError(e.message); }
    finally { setSyncing(false); }
  }

  function clearCache() {
    cache.current = []; setDocs([]);
    localStorage.removeItem(STORAGE_KEY);
    setLastSync(null); setStats({ cache: 0, fresh: 0 });
  }

  const fm = (v) => v != null ? `MYR ${Number(v).toLocaleString("en", { minimumFractionDigits: 2 })}` : "-";
  const fd = (dt) => dt ? new Date(dt).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur"
  }) : "-";

  if (!ready) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center"><div className="w-3 h-3 bg-blue-500 rounded-full pulse-dot mx-auto mb-4" /><p className="text-slate-400 text-sm">连接中...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 selection:bg-blue-500/30">
      {/* 顶栏 */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-500/20">富</div>
            <span className="text-white font-semibold text-sm tracking-tight">MyInvois</span>
            <span className="text-[10px] text-slate-500 font-medium bg-slate-800 px-2 py-0.5 rounded-md">{env === "prod" ? "PRODUCTION" : "SANDBOX"}</span>
          </div>
          <div className="flex items-center gap-3">
            {lastSync && <span className="text-[11px] text-slate-500 hidden sm:block">上次 {(new Date(lastSync)).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
            <button onClick={sync} disabled={syncing}
              className="flex items-center gap-1.5 px-3.5 h-8 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white rounded-lg text-xs font-medium transition-all active:scale-95 shadow-lg shadow-blue-600/20">
              {syncing ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />同步</> : "↻ 同步"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 animate-fade-in">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "总发票", value: docs.length, color: "from-blue-500 to-indigo-600", shadow: "shadow-blue-500/10" },
            { label: "已发出", value: docs.filter(d => dir(d) === "sent").length, color: "from-emerald-500 to-teal-600", shadow: "shadow-emerald-500/10" },
            { label: "已接收", value: docs.filter(d => dir(d) === "recv").length, color: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/10" },
            { label: "有效", value: docs.filter(d => d.status === "Valid").length, color: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/10" },
          ].map((c, i) => (
            <div key={i} className={`glass rounded-2xl p-4 ${c.shadow} animate-fade-in`} style={{ animationDelay: `${i*50}ms` }}>
              <p className="text-[11px] text-slate-500 font-medium mb-1">{c.label}</p>
              <p className={`text-2xl font-bold bg-gradient-to-br ${c.color} text-transparent bg-clip-text`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* 错误提示 */}
        {error && <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}

        {/* 同步提示 */}
        {syncing && <div className="mb-4 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400 flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />正在同步数据...</div>}

        {/* 主表格卡片 */}
        <div className="glass rounded-2xl overflow-hidden">
          {/* 表头 */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold text-sm">发票</h2>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="搜索发票号/TIN/名称..." className="w-48 lg:w-64 h-8 pl-9 pr-3 bg-slate-800/50 border border-white/5 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition" />
              </div>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-8 px-3 bg-slate-800/50 border border-white/5 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition">
                <option value="">全部状态</option>
                {Object.entries(BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">{filtered.length} 条</span>
              {docs.length > 0 && (
                <button onClick={clearCache} className="text-[11px] text-slate-600 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-500/10">清除</button>
              )}
            </div>
          </div>

          {/* 空状态 */}
          {docs.length === 0 && (
            <div className="py-24 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-slate-500 text-sm">暂无发票数据</p>
              <button onClick={sync} disabled={syncing} className="mt-4 px-4 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition shadow-lg shadow-blue-600/20">↻ 同步发票</button>
            </div>
          )}

          {/* 表格 */}
          {docs.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      {["方向", "发票号", "日期", "购买方", "供应方", "金额", "状态"].map(h => (
                        <th key={h} className="text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3.5 first:pl-5 last:pr-5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((d, i) => {
                      const dr = dir(d);
                      return (
                        <tr key={d.uuid || i} className="border-b border-white/[0.02] row-hover transition-colors animate-fade-in" style={{ animationDelay: `${i*20}ms` }}>
                          <td className="px-4 first:pl-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                              dr === "sent" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              dr === "recv" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" :
                              "bg-slate-500/10 text-slate-400 border-slate-500/20"
                            }`}>
                              {dr === "sent" ? "↑ 发出" : dr === "recv" ? "↓ 接收" : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-slate-200 text-sm font-medium">{d.internalId || d.codeNumber || "-"}</div>
                            <div className="text-[10px] text-slate-600 font-mono mt-0.5">{d.uuid?.slice(0, 12)}...</div>
                          </td>
                          <td className="px-4 py-3.5 text-[13px] text-slate-400 whitespace-nowrap">{fd(d.dateTimeReceived || d.dateTimeIssued)}</td>
                          <td className="px-4 py-3.5">
                            <div className="text-slate-200 text-sm">{d.buyerName || d.receiverName || "-"}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{d.buyerTIN || d.receiverTIN || ""}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-slate-200 text-sm">{d.supplierName || "-"}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{d.supplierTIN || ""}</div>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-200 whitespace-nowrap tabular-nums">{fm(d.totalPayableAmount || d.total)}</td>
                          <td className="px-4 first:pl-5 last:pr-5 py-3.5">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium border ${(BADGE[d.status] || BADGE.Submitted).cls}`}>
                              {(BADGE[d.status] || BADGE.Submitted).label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="px-5 py-3.5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-slate-600">第 {page}/{totalPages} 页</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(1)} disabled={page <= 1} className="px-2.5 h-7 rounded-lg text-[11px] border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition">{"<<"}</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-2.5 h-7 rounded-lg text-[11px] border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition">{"<"}</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                    return <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-[11px] font-medium transition ${p === page ? "bg-blue-600 text-white shadow-sm" : "border border-white/5 text-slate-400 hover:text-white hover:bg-white/5"}`}>{p}</button>;
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2.5 h-7 rounded-lg text-[11px] border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition">{">"}</button>
                  <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-2.5 h-7 rounded-lg text-[11px] border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition">{">>"}</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 筛选无结果 */}
        {docs.length > 0 && filtered.length === 0 && (
          <div className="py-20 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p className="text-slate-500 text-sm">筛选无匹配结果</p>
            <button onClick={() => { setSearch(""); setStatusFilter(""); }} className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition">清除筛选</button>
          </div>
        )}

        <footer className="mt-8 text-center text-[11px] text-slate-700">MyInvois Management · {env === "prod" ? "Production" : "Sandbox"}</footer>
      </main>
    </div>
  );
}
