// 檢查 data.json 格式，避免壞資料讓 App 打不開。用法：node scripts/validate-data.mjs docs/data.json
import { readFileSync } from "node:fs";
const TEAMS = "ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS".split(" ");
const file = process.argv[2] || "docs/data.json";
const d = JSON.parse(readFileSync(file, "utf8"));
const err = [];
if (isNaN(Date.parse(d.updated))) err.push("updated 不是有效時間");
for (const t of TEAMS) {
  const r = d.REC?.[t];
  if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isInteger)) err.push(`REC.${t} 應為 [勝, 敗]`);
  if (!(t in (d.I || {}))) err.push(`I.${t} 缺少（無資料請設 null）`);
  else if (d.I[t] !== null) d.I[t].forEach((p, i) => {
    if (p.length !== 5 || !["O", "D"].includes(p[1]) || !["S", "T", "R"].includes(p[4]) || !(p[3] === "季" || /^\d{1,2}\/\d{1,2}$/.test(p[3])))
      err.push(`I.${t}[${i}] 格式錯誤：${JSON.stringify(p)}`);
  });
}
(d.G || []).forEach((g, i) => {
  if (!TEAMS.includes(g[0]) || !TEAMS.includes(g[1]) || isNaN(Date.parse(g[2])) || !(g.length === 3 || (g.length === 5 && Number.isInteger(g[3]) && Number.isInteger(g[4]))))
    err.push(`G[${i}] 格式錯誤：${JSON.stringify(g)}`);
});
if (!(d.G || []).some(g => g.length === 3)) err.push("G 裡沒有未開打的比賽");
(d.NEWS || []).forEach((n, i) => {
  for (const k of ["k", "h", "p", "s"]) if (typeof n[k] !== "string" || !n[k]) err.push(`NEWS[${i}].${k} 缺少`);
  if (!Array.isArray(n.teams) || !n.teams.every(t => TEAMS.includes(t))) err.push(`NEWS[${i}].teams 錯誤`);
  if (!Array.isArray(n.d) || !n.d.length) err.push(`NEWS[${i}].d 缺少`);
});
if (err.length) { console.error("資料有誤：\n- " + err.join("\n- ")); process.exit(1); }
console.log(`OK：${d.G.length} 場比賽、${d.NEWS.length} 則新聞，更新於 ${d.updated}`);
