function fmt(v, type) {
  if (v == null) return "—";
  const n = Number(v);
  if (type === "currency" || type === "currency_exact")
    return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  if (type === "number") return n.toLocaleString("pt-BR");
  return String(v);
}

function Spark({ v23, v24, up }) {
  const W=38, H=16, p=2;
  const mn=Math.min(v23,v24), mx=Math.max(v23,v24), rng=mx-mn||1;
  const pts=[v23,v24].map((v,i)=>`${(p+(i/1)*(W-p*2)).toFixed(1)},${(H-p-((v-mn)/rng)*(H-p*2)).toFixed(1)}`);
  const [x2,y2]=pts[1].split(",").map(Number);
  const c = up ? "var(--green)" : "var(--red)";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",flexShrink:0}}>
      <polyline points={pts.join(" ")} fill="none" stroke={c}
        strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
      <circle cx={x2} cy={y2} r="2.4" fill={c}/>
    </svg>
  );
}

function Delta({ pct }) {
  if (pct==null) return null;
  const up=pct>0, z=pct===0;
  return (
    <span style={{
      fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20,
      background: z?"#F1F5F9":up?"var(--green-soft)":"var(--red-soft)",
      color:      z?"#6B7280":up?"var(--green)":"var(--red)",
    }}>
      {z?"·":up?"↑":"↓"} {Math.abs(pct).toFixed(1).replace(".",",")}%
    </span>
  );
}

export default function KpiCards({ kpis }) {
  if (!kpis?.length || kpis[0]?.format==="summary") return null;
  return (
    <div style={s.grid}>
      {kpis.map((k,i) => {
        const up=(k.var_pct??0)>=0;
        return (
          <div key={i} style={s.card}>
            <div style={s.top}>
              <span style={s.lbl}>{k.label}</span>
              <Spark v23={k.value_2023} v24={k.value_2024} up={up}/>
            </div>
            <div style={s.period}>2024</div>
            <div style={s.val}>{fmt(k.value_2024, k.format)}</div>
            <div style={s.sep}/>
            <div style={s.bot}>
              <div>
                <div style={s.p23lbl}>2023</div>
                <div style={s.p23val}>{fmt(k.value_2023, k.format)}</div>
              </div>
              <Delta pct={k.var_pct}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const s = {
  grid:   { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",
            gap:7, marginBottom:8 },
  card:   { background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:11, padding:"11px 14px", boxShadow:"var(--shadow-xs)" },
  top:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 },
  lbl:    { fontSize:9, fontWeight:800, color:"var(--text-muted)",
            textTransform:"uppercase", letterSpacing:"0.11em" },
  period: { fontSize:9.5, color:"var(--text-muted)", fontWeight:600, marginBottom:1 },
  val:    { fontSize:12.5, fontWeight:700, color:"var(--text-primary)",
            fontFamily:"'JetBrains Mono',monospace",
            letterSpacing:"-0.01em", marginBottom:7, lineHeight:1.4 },
  sep:    { height:1, background:"var(--border-subtle)", marginBottom:7 },
  bot:    { display:"flex", alignItems:"center", justifyContent:"space-between", gap:4 },
  p23lbl: { fontSize:9, color:"var(--text-disabled)", fontWeight:700, letterSpacing:"0.08em" },
  p23val: { fontSize:10.5, color:"var(--text-muted)",
            fontFamily:"'JetBrains Mono',monospace",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:110 },
};
