const DMAP = { CALCA:"CALÇA", MACACAO:"MACACÃO", CALCAO:"CALÇÃO", SUETER:"SUÉTER" };
const MES  = {"01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril","05":"Maio",
              "06":"Junho","07":"Julho","08":"Agosto","09":"Setembro",
              "10":"Outubro","11":"Novembro","12":"Dezembro"};
const MDL  = ["🥇","🥈","🥉"];

function mapVal(v) {
  if (typeof v !== "string") return v;
  for (const [k,d] of Object.entries(DMAP)) v = v.replace(new RegExp(`\\b${k}\\b`,"g"), d);
  return v.replace(/^(\d{4})-(\d{2})$/, (_,y,m) =>
    MES[m] ? (y==="2024" ? MES[m] : `${MES[m]} ${y}`) : `${m}/${y}`
  );
}

function isMoney(k)  { return /receita|valor|total|ticket|preco/i.test(k); }
function isCount(k)  { return /unidade|quantidade|pedido|cliente/i.test(k); }
function isPct(k, v) {
  const byName = /pct|percent|particip|share/i.test(k);
  const n = Number(v);
  const byVal = !isNaN(n) && Math.abs(n) > 0 && Math.abs(n) <= 100 && !isMoney(k) && !isCount(k);
  return byName || byVal;
}
function isSummable(k, v) {
  // Só soma colunas de dinheiro ou contagem — NUNCA percentuais
  return (isMoney(k) || isCount(k)) && !isPct(k, v);
}
function isNum(rs, c) { return rs.slice(0,3).every(r => !isNaN(Number(r[c]))); }
function isSeries(c)  { return /mes|data|periodo/i.test(c); }

function fmtCell(v, money, count, pct) {
  if (v == null) return "—";
  const n = Number(v);
  if (!isNaN(n)) {
    if (money) return `R$ ${n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    if (count) return n.toLocaleString("pt-BR");
    if (pct)   return `${n.toFixed(1).replace(".",",")}%`;
    return n.toLocaleString("pt-BR");
  }
  return mapVal(String(v));
}

export default function RankingTable({ data }) {
  if (!data?.length) return null;

  const cols     = Object.keys(data[0]);
  const labelCol = cols[0];
  const valCols  = cols.slice(1);
  const series   = isSeries(labelCol);

  // Barra: usar coluna de money ou count (não pct)
  const barCol = valCols.find(c => isMoney(c)) || valCols.find(c => isCount(c) && !isPct(c, data[0]?.[c]));
  const maxVal = barCol ? Math.max(...data.map(r => Math.abs(Number(r[barCol])||0))) : 0;

  // Totais: APENAS colunas de dinheiro ou contagem — excluir pct
  const totals = valCols.reduce((a, c) => {
    const firstVal = data[0]?.[c];
    if (isNum(data, c) && isSummable(c, firstVal)) {
      a[c] = data.reduce((s,r) => s + (Number(r[c])||0), 0);
    }
    return a;
  }, {});
  const hasTotals = Object.keys(totals).length > 0;

  return (
    <div style={t.wrap}>
      <div style={t.scroll}>
        <table style={t.table}>
          <thead style={t.thead}>
            <tr>
              {!series && <th style={{...t.th, width:36, textAlign:"center"}}>#</th>}
              <th style={t.th}>{mapVal(labelCol.toUpperCase().replace(/_/g," "))}</th>
              {valCols.map(c => (
                <th key={c} style={{...t.th, textAlign:"right"}}>
                  {c.toUpperCase().replace(/_/g," ")}
                </th>
              ))}
              {barCol && <th style={{...t.th, width:80}}/>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const top3   = i < 3 && !series;
              const barVal = barCol && maxVal > 0 ? (Math.abs(Number(row[barCol])||0)/maxVal)*100 : 0;
              const lv     = mapVal(String(row[labelCol] ?? ""));

              return (
                <tr key={i} className="rt-row" style={i%2===0 ? t.even : t.odd}>
                  {!series && (
                    <td style={{...t.td, textAlign:"center", paddingRight:0}}>
                      {top3
                        ? <span style={{fontSize:15}}>{MDL[i]}</span>
                        : <span style={t.rank}>{i+1}</span>}
                    </td>
                  )}
                  <td style={{...t.td, fontWeight:top3?600:400,
                    color:top3?"var(--text-primary)":"#374151"}}>
                    {lv}
                  </td>
                  {valCols.map(c => (
                    <td key={c} style={{
                      ...t.td, textAlign:"right",
                      fontFamily:(isMoney(c)||isCount(c))?"'JetBrains Mono',monospace":"inherit",
                      fontSize:12.5,
                      color:top3?"var(--text-primary)":"#374151",
                    }}>
                      {fmtCell(row[c], isMoney(c), isCount(c), isPct(c, row[c]))}
                    </td>
                  ))}
                  {barCol && (
                    <td style={t.barTd}>
                      <div style={t.barBg}>
                        <div style={{
                          ...t.barFill,
                          width:`${barVal.toFixed(1)}%`,
                          background:"var(--linx)",
                          opacity:top3?0.85:(series?0.55:0.35),
                        }}/>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Total — apenas se há colunas somáveis (não pct) */}
            {hasTotals && (
              <tr style={t.totalRow}>
                {!series && <td style={{...t.td, ...t.totalTd}}/>}
                <td style={{...t.td, ...t.totalTd, fontWeight:700, color:"var(--text-primary)"}}>
                  Total
                </td>
                {valCols.map(c => (
                  <td key={c} style={{...t.td, ...t.totalTd, textAlign:"right",
                    fontFamily:"'JetBrains Mono',monospace", fontSize:12.5,
                    fontWeight:700, color:"var(--text-primary)"}}>
                    {totals[c] != null ? fmtCell(totals[c], isMoney(c), isCount(c), false) : ""}
                  </td>
                ))}
                {barCol && <td style={{...t.td, ...t.totalTd}}/>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const t = {
  wrap:     { borderRadius:12, border:"1px solid var(--border)", background:"var(--surface)",
              marginBottom:8, boxShadow:"var(--shadow-xs)", overflow:"hidden" },
  scroll:   { overflowX:"auto" },
  table:    { width:"100%", borderCollapse:"collapse", fontSize:12.5 },
  thead:    { background:"#F8FAFC" },
  th:       { padding:"9px 14px", background:"#F8FAFC", fontWeight:700,
              color:"var(--text-secondary)", fontSize:11, textTransform:"uppercase",
              letterSpacing:"0.07em", whiteSpace:"nowrap", textAlign:"left",
              borderBottom:"1px solid var(--border)" },
  td:       { padding:"8px 14px", color:"#374151",
              borderBottom:"1px solid var(--border-subtle)", whiteSpace:"nowrap" },
  rank:     { color:"var(--text-muted)", fontWeight:600, fontSize:11 },
  even:     { background:"var(--surface)" },
  odd:      { background:"var(--surface-raised)" },
  barTd:    { padding:"8px 12px 8px 6px", width:76 },
  barBg:    { height:4, borderRadius:2, background:"#EEF0F4", overflow:"hidden" },
  barFill:  { height:"100%", borderRadius:2, transition:"width .5s ease" },
  totalRow: { background:"#F8FAFC" },
  totalTd:  { borderTop:"1px solid var(--border)", borderBottom:"none", paddingTop:10 },
};
