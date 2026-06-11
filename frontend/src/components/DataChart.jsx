/**
 * DataChart — gráficos automáticos estilo Google.
 * Tabela fica escondida por padrão, expande ao clicar "Ver números".
 */
import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import RankingTable from "./RankingTable";

/* ── Paleta ─────────────────────────────────────────────────────── */
const LINX       = "#F5691E";
const LINX_LIGHT = "#FFBFA0";
const BLUE       = "#93C5FD";
const BLUE_DARK  = "#3B82F6";

/* ── Helpers ─────────────────────────────────────────────────────── */
const DMAP = { CALCA:"CALÇA", MACACAO:"MACACÃO", CALCAO:"CALÇÃO", SUETER:"SUÉTER" };
const MES  = { "01":"Jan","02":"Fev","03":"Mar","04":"Abr","05":"Mai","06":"Jun",
               "07":"Jul","08":"Ago","09":"Set","10":"Out","11":"Nov","12":"Dez" };

function applyMap(v) {
  if (typeof v !== "string") return v;
  for (const [k,d] of Object.entries(DMAP)) v = v.replace(new RegExp(`\\b${k}\\b`,"g"), d);
  return v.replace(/^(\d{4})-(\d{2})$/, (_,y,m) =>
    MES[m] ? (y === "2024" ? MES[m] : `${MES[m]} '${y.slice(2)}`) : `${m}/${y}`
  );
}

function fmtShort(v) {
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 1_000_000) return `R$\u00A0${(n/1_000_000).toFixed(1).replace(".",",")}M`;
  if (n >= 1_000)     return `R$\u00A0${(n/1_000).toFixed(0)}k`;
  return n.toLocaleString("pt-BR");
}

function fmtFull(v, isMoney) {
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (isMoney) return `R$\u00A0${n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  return n.toLocaleString("pt-BR");
}

/* ── Tooltip customizado ─────────────────────────────────────────── */
function Tip({ active, payload, label, moneyKeys = [] }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"#fff", border:"1px solid #E5E8ED", borderRadius:10,
      padding:"10px 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.10)",
      fontSize:12, fontFamily:"'Inter',sans-serif", minWidth:170,
    }}>
      <div style={{ fontWeight:600, color:"#0E1117", marginBottom:7, fontSize:12.5 }}>
        {applyMap(String(label))}
      </div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between",
          gap:20, marginBottom:3 }}>
          <span style={{ color:"#9CA3AF" }}>{p.name}</span>
          <span style={{ fontWeight:600, color:"#0E1117" }}>
            {fmtFull(p.value, moneyKeys.includes(p.dataKey))}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Detector ────────────────────────────────────────────────────── */
export function detectChartType(data) {
  if (!data?.length) return null;
  const cols = Object.keys(data[0]);
  const labelCol = cols[0];
  const valCols  = cols.slice(1);
  const hasNum = valCols.some(c => data.slice(0,3).every(r => !isNaN(Number(r[c])) && r[c] != null));
  if (!hasNum) return null;
  if (/mes|data|periodo/i.test(labelCol)) return "area";
  const has2023 = valCols.some(c => /2023/i.test(c));
  const has2024 = valCols.some(c => /2024/i.test(c));
  if (has2023 && has2024) return "grouped";
  if (data.length >= 2 && data.length <= 25) return "bar";
  return null;
}

/* ── Gráfico de área ─────────────────────────────────────────────── */
function AreaView({ data }) {
  const cols    = Object.keys(data[0]);
  const labelCol = cols[0];
  const moneyCol = cols.find(c => /receita|valor|total/i.test(c));
  const countCol = cols.find(c => /unidade|quantidade|pedido/i.test(c));
  const mainCol  = moneyCol || cols[1];
  const moneyKeys = moneyCol ? [moneyCol] : [];

  const d = data.map(r => ({
    label: applyMap(String(r[labelCol])),
    [mainCol]: Number(r[mainCol]),
    ...(countCol && countCol !== mainCol ? { [countCol]: Number(r[countCol]) } : {}),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={d} margin={{ top:10, right:16, left:0, bottom:0 }}>
        <defs>
          <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={LINX} stopOpacity={0.18}/>
            <stop offset="95%" stopColor={LINX} stopOpacity={0}/>
          </linearGradient>
          {countCol && countCol !== mainCol && (
            <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={BLUE_DARK} stopOpacity={0.12}/>
              <stop offset="95%" stopColor={BLUE_DARK} stopOpacity={0}/>
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false}/>
        <XAxis dataKey="label" tick={{ fontSize:11, fill:"#9CA3AF", fontFamily:"Inter" }}
          axisLine={false} tickLine={false}/>
        <YAxis tickFormatter={fmtShort} yAxisId="l"
          tick={{ fontSize:10, fill:"#C5CBD4", fontFamily:"Inter" }}
          axisLine={false} tickLine={false} width={56}/>
        {countCol && countCol !== mainCol && (
          <YAxis yAxisId="r" orientation="right"
            tick={{ fontSize:10, fill:"#C5CBD4", fontFamily:"Inter" }}
            axisLine={false} tickLine={false} width={40}/>
        )}
        <Tooltip content={<Tip moneyKeys={moneyKeys}/>}/>
        <Area yAxisId="l" type="monotone" dataKey={mainCol}
          name={moneyCol ? "Receita" : mainCol}
          stroke={LINX} strokeWidth={2.5} fill="url(#gL)"
          dot={false} activeDot={{ r:5, fill:LINX, strokeWidth:0 }}/>
        {countCol && countCol !== mainCol && (
          <Area yAxisId="r" type="monotone" dataKey={countCol}
            name="Unidades" stroke={BLUE_DARK} strokeWidth={1.8}
            fill="url(#gB)" strokeDasharray="4 2"
            dot={false} activeDot={{ r:4, fill:BLUE_DARK, strokeWidth:0 }}/>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Barras horizontais ──────────────────────────────────────────── */
function BarView({ data }) {
  const cols     = Object.keys(data[0]);
  const labelCol = cols[0];
  const valCol   = cols.find(c => /receita|valor|total/i.test(c)) || cols[1];
  const moneyKeys = [valCol];

  const d = [...data]
    .sort((a,b) => Number(a[valCol]) - Number(b[valCol]))
    .map(r => ({ label: applyMap(String(r[labelCol])), value: Number(r[valCol]) }));

  const maxVal = Math.max(...d.map(x => x.value));

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, d.length * 44)}>
      <BarChart data={d} layout="vertical" margin={{ top:4, right:20, left:8, bottom:4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" horizontal={false}/>
        <XAxis type="number" tickFormatter={fmtShort}
          tick={{ fontSize:10, fill:"#C5CBD4", fontFamily:"Inter" }}
          axisLine={false} tickLine={false}/>
        <YAxis type="category" dataKey="label" width={68}
          tick={{ fontSize:12, fill:"#374151", fontFamily:"Inter", fontWeight:500 }}
          axisLine={false} tickLine={false}/>
        <Tooltip content={<Tip moneyKeys={moneyKeys}/>} cursor={{ fill:"#F9FAFB" }}/>
        <Bar dataKey="value" name="Receita" radius={[0,5,5,0]} maxBarSize={26}>
          {d.map((e,i) => (
            <Cell key={i}
              fill={e.value === maxVal ? LINX : LINX_LIGHT}
              opacity={e.value === maxVal ? 1 : 0.5 + (i/d.length)*0.4}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Barras agrupadas ────────────────────────────────────────────── */
function GroupedView({ data }) {
  const cols    = Object.keys(data[0]);
  const labelCol = cols[0];
  const c23 = cols.find(c => /2023/.test(c));
  const c24 = cols.find(c => /2024/.test(c));
  if (!c23 || !c24) return null;

  const d = data.map(r => ({
    label: applyMap(String(r[labelCol])),
    "2023": Number(r[c23]),
    "2024": Number(r[c24]),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={d} margin={{ top:10, right:16, left:0, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false}/>
        <XAxis dataKey="label" tick={{ fontSize:11, fill:"#9CA3AF", fontFamily:"Inter" }}
          axisLine={false} tickLine={false}/>
        <YAxis tickFormatter={fmtShort}
          tick={{ fontSize:10, fill:"#C5CBD4", fontFamily:"Inter" }}
          axisLine={false} tickLine={false} width={52}/>
        <Tooltip content={<Tip moneyKeys={["2023","2024"]}/>} cursor={{ fill:"#F9FAFB" }}/>
        <Legend wrapperStyle={{ fontSize:11, fontFamily:"Inter", paddingTop:10 }}/>
        <Bar dataKey="2023" name="2023" fill={BLUE} radius={[3,3,0,0]} maxBarSize={24}/>
        <Bar dataKey="2024" name="2024" fill={LINX} radius={[3,3,0,0]} maxBarSize={24}/>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Componente principal ────────────────────────────────────────── */
export default function DataChart({ data }) {
  const [showTable, setShowTable] = useState(false);
  const type = detectChartType(data);
  if (!type) return null;

  return (
    <div style={s.wrap}>
      {/* Gráfico */}
      <div style={s.chart}>
        {type === "area"    && <AreaView    data={data}/>}
        {type === "bar"     && <BarView     data={data}/>}
        {type === "grouped" && <GroupedView data={data}/>}
      </div>

      {/* Botão discreto "Ver números" */}
      <div style={s.footer}>
        <button style={s.toggle} onClick={() => setShowTable(v => !v)}>
          {showTable
            ? <><ChevUp/> Ocultar tabela</>
            : <><ChevDown/> Ver números</>
          }
        </button>
      </div>

      {/* Tabela colapsável */}
      {showTable && (
        <div style={s.tableWrap}>
          <RankingTable data={data}/>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap:      { background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)",
               boxShadow:"0 1px 6px rgba(0,0,0,0.06)", marginBottom:8, overflow:"hidden" },
  chart:     { padding:"16px 8px 4px" },
  footer:    { display:"flex", justifyContent:"center", padding:"4px 0 8px" },
  toggle:    { display:"inline-flex", alignItems:"center", gap:5, background:"none", border:"none",
               cursor:"pointer", fontSize:11.5, color:"var(--text-muted)", fontFamily:"inherit",
               padding:"4px 12px", borderRadius:20,
               transition:"color .13s, background .13s" },
  tableWrap: { borderTop:"1px solid var(--border-subtle)" },
};

const ChevDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
