// 寫入賽前預測 P：每場還沒開打的比賽，用和 App 相同的模型算出主隊勝率（0–100 整數）。
// 已開打的比賽沿用上一版 data.json 裡的預測，不重新計算，這樣 App 才能對照「賽前有沒有猜中」。
// 用法：node predict.mjs data.json（在 git 專案裡執行；上一版預測從 git HEAD 的 data.json 讀取）
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const file = process.argv[2] || "data.json";
const d = JSON.parse(readFileSync(file, "utf8"));
let prevP = {};
try { prevP = JSON.parse(execSync(`git show HEAD:${file}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).P || {}; } catch (e) {}
for (const [k, v] of Object.entries(d.P || {})) if (!(k in prevP)) prevP[k] = v;

// ---- 以下模型與 basketball-win-king/www/app.js 相同 ----
const REC = d.REC, I = d.I;
const G = d.G.map(([h, a, t, hs, as], i) => ({ id: i, h, a, ts: t, t: Date.parse(t), hs, as, done: hs != null }));
const HOME = 2.5, SIG = 12.5, W = { S: 5, T: 2.5, R: .75 };
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + .3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)) }
const phi = z => .5 * (1 + erf(z / Math.SQRT2));
function daysUntil(ret, at) { if (ret === "季") return 999; const [m, dd] = ret.split("/").map(Number); const y0 = new Date(at).getUTCFullYear(); let x = Date.UTC(y0, m - 1, dd); if (x - at < -60 * 864e5) x = Date.UTC(y0 + 1, m - 1, dd); return (x - at) / 864e5 }
function pcost(p, at) { const [, s, , ret, tier] = p; let f = 1; if (s === "D") f *= .5; if (daysUntil(ret, at) > 30) f *= .5; return W[tier] * f }
function injCost(t, at) { if (!I[t]) return 0; let c = 0; I[t].forEach(p => { c += pcost(p, at) }); return -Math.min(12, c) }
function sPts(t) { const [w, l] = REC[t]; return ((w + 4) / (w + l + 8) - .5) * 30 }
function recent(t, b) { const gs = G.filter(g => g.done && g.t < b && (g.h === t || g.a === t)).sort((x, y) => y.t - x.t).slice(0, 5); let m = 0; gs.forEach(g => { const o = g.h === t ? g.hs : g.as, p = g.h === t ? g.as : g.hs; m += o - p }); return { n: gs.length, avg: gs.length ? m / gs.length : 0 } }
const b2b = (t, at) => G.some(g => (g.h === t || g.a === t) && at - g.t > 8 * 36e5 && at - g.t < 32 * 36e5);
function h2h(h, a, b) { const gs = G.filter(g => g.done && g.t < b && ((g.h === h && g.a === a) || (g.h === a && g.a === h))); let hw = 0; gs.forEach(g => { if ((g.h === h ? g.hs : g.as) > (g.h === h ? g.as : g.hs)) hw++ }); const n = gs.length; return !n ? 0 : hw === n ? 1 : hw === 0 ? -1 : (2 * hw - n) / n * .5 }
function homeProb(g) { const { h, a, t } = g; const rh = recent(h, t), ra = recent(a, t);
  const m = .7 * (sPts(h) - sPts(a)) + HOME + Math.max(-2.5, Math.min(2.5, .3 * (rh.avg - ra.avg) * Math.min(rh.n, ra.n) / 5)) + injCost(h, t) - injCost(a, t) + (b2b(h, t) ? -1.5 : 0) - (b2b(a, t) ? -1.5 : 0) + h2h(h, a, t);
  return phi(m / SIG) }
// ---- 模型結束 ----

const now = Number(process.env.PREDICT_NOW) || Date.now(), P = {};
let fresh = 0, kept = 0;
for (const g of G) {
  const key = `${g.h}|${g.a}|${g.ts}`;
  if (!g.done && g.t > now) { P[key] = Math.round(homeProb(g) * 100); fresh++ }
  else if (key in prevP) { P[key] = prevP[key]; kept++ }
}
d.P = P;
writeFileSync(file, JSON.stringify(d, null, 1) + "\n");
console.log(`賽前預測：新算 ${fresh} 場、沿用 ${kept} 場`);
