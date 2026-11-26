// 賽前預測：每場還沒開打的比賽，用和 App 相同的模型算出主隊勝率（0–100 整數），存在 pred.json。
// 已開打的比賽沿用 pred.json 裡的舊預測、不重算，App 才能對照「賽前有沒有猜中」。
// 預測獨立放在 pred.json，其他只改 data.json 的更新流程不會把它洗掉。
// 用法：node predict.mjs data.json（在 data.json 寫好之後、commit 之前執行，並把 pred.json 一起 commit）
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = process.argv[2] || "data.json";
const PRED = "pred.json";
const d = JSON.parse(readFileSync(file, "utf8"));
let old = {};
if (existsSync(PRED)) { try { old = JSON.parse(readFileSync(PRED, "utf8")).P || {}; } catch (e) { old = {}; } }

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

const now = Number(process.env.PREDICT_NOW) || Date.now();
const P = {};
// 舊預測：保留開賽時間在 10 天內的（已開打的就此固定）
for (const [k, v] of Object.entries(old)) { const t = Date.parse(k.split("|")[2]); if (Number.isInteger(v) && v >= 0 && v <= 100 && t > now - 10 * 864e5) P[k] = v }
// 未開打的比賽：用最新資料重算（開打前都可以更新）
let fresh = 0;
for (const g of G) {
  if (g.done || g.t <= now) continue;
  P[`${g.h}|${g.a}|${g.ts}`] = Math.round(homeProb(g) * 100); fresh++;
}
writeFileSync(PRED, JSON.stringify({ updated: new Date(now).toISOString(), P }, null, 1) + "\n");
console.log(`pred.json：未開打 ${fresh} 場已寫入預測，共 ${Object.keys(P).length} 筆`);
