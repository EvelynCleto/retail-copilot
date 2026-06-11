/**
 * DataChart — gráficos automáticos estilo Google.
 * Detecta o tipo de dado e escolhe o melhor gráfico:
 *   - Série temporal (meses)  → área + linha
 *   - Ranking (categorias, lojas, cores, produtos) → barras horizontais
 *   - Comparativo (r2023/r2024 por dimensão) → barras agrupadas
 */
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, ReferenceLine,
} from "recharts";

/* ── Paleta Linx ────────────────────────────────────────────────── */
const LINX        = "#F5691E";
const LINX_LIGHT  = "#FF9B68";
const BLUE        = "#3B82F6";
const BLUE_LIGHT  = "#93C5FD";
const GRAY        = "#94A3B8";

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

function fmtMoney(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 1_000_000) return `R$ ${(n/1_000_000).toFixed(1).replace(".",",")}M`;
  if (n >= 1_000)     return `R$ ${(n/1_000).toFixed(0)}k`;
  return `R$ ${n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

function fmtFull(v) {
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `R$ ${n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

/* ── Tooltip customizado ─────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"#fff", border:"1px solid #E5E8ED",
      borderRadius:10, padding:"10px 14px",
      boxShadow:"0 4px 16px rgba(0,0,0,0.10)",
      fontSize:12, fontFamily:"'Inter',sans-serif",
      minWidth:160,
    }}>
      <div style={{ fontWeight:600, color:"#0E1117", marginBottom:6 }}>
        {applyMap(String(label))}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:16,
          color: p.color, marginBottom:2 }}>
          <span style={{ color:"#6B7280", fontWeight:400 }}>{p.name}</span>
          <span style={{ fontWeight:600, color:"#0E1117" }}>
            {typeof p.value === "number" && p.value > 1000
              ? fmtFull(p.value)
              : p.value?.toLocaleString?.("pt-BR") ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Detector de tipo de gráfico ─────────────────────────────────── */
export function detectChartType(data) {
  if (!data?.length) return null;
  const cols = Object.keys(data[0]);
  const labelCol = cols[0];
  const valCols  = cols.slice(1);

  // Nenhuma coluna de valor numérica → sem gráfico
  const hasNumeric = valCols.some(c =>
    data.slice(0,3).every(r => !isNaN(Number(r[c])) && r[c] != null)
  );
  if (!hasNumeric) return null;

  // Série temporal
  if (/mes|data|periodo/i.test(labelCol)) return "area";

  // Comparativo (tem r2023 e r2024, ou p2023 e p2024, etc.)
  const has2023 = valCols.some(c => /2023/i.test(c));
  const has2024 = valCols.some(c => /2024/i.test(c));
  if (has2023 && has2024) return "grouped";

  // Ranking com 2–20 linhas
  if (data.length >= 2 && data.length <= 20) return "bar";

  return null;
}

/* ── Gráfico de área (série temporal) ───────────────────────────── */
function AreaChartView({ data }) {
  const cols    = Object.keys(data[0]);
  const labelCol = cols[0];
  const valCol   = cols.find(c => /receita|valor|total/i.test(c)) || cols[1];
  const countCol = cols.find(c => /unidade|quantidade|pedido/i.test(c));

  const chartData = data.map(row => ({
    label: applyMap(String(row[labelCol])),
    [valCol]: Number(row[valCol]),
    ...(countCol ? { [countCol]: Number(row[countCol]) } : {}),
  }));

  const hasCount = !!countCol;

  return (
    <div style={s.wrap}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top:10, right:20, left:10, bottom:0 }}>
          <defs>
            <linearGradient id="gradLinx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={LINX} stopOpacity={0.18}/>
              <stop offset="95%" stopColor={LINX} stopOpacity={0}/>
            </linearGradient>
            {hasCount && (
              <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={BLUE} stopOpacity={0.12}/>
                <stop offset="95%" stopColor={BLUE} stopOpacity={0}/>
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false}/>
          <XAxis dataKey="label" tick={{ fontSize:11, fill:"#9CA3AF", fontFamily:"Inter" }}
            axisLine={false} tickLine={false}/>
          <YAxis yAxisId="left" tickFormatter={fmtMoney}
            tick={{ fontSize:10, fill:"#9CA3AF", fontFamily:"Inter" }}
            axisLine={false} tickLine={false} width={52}/>
          {hasCount && (
            <YAxis yAxisId="right" orientation="right"
              tick={{ fontSize:10, fill:"#9CA3AF", fontFamily:"Inter" }}
              axisLine={false} tickLine={false} width={40}/>
          )}
          <Tooltip content={<CustomTooltip/>}/>
          <Area yAxisId="left" type="monotone" dataKey={valCol}
            name="Receita" stroke={LINX} strokeWidth={2.5}
            fill="url(#gradLinx)" dot={false} activeDot={{ r:4, fill:LINX }}/>
          {hasCount && (
            <Area yAxisId="right" type="monotone" dataKey={countCol}
              name="Unidades" stroke={BLUE} strokeWidth={1.8}
              fill="url(#gradBlue)" dot={false} activeDot={{ r:4, fill:BLUE }}
              strokeDasharray="4 2"/>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Gráfico de barras horizontais (ranking) ─────────────────────── */
function BarChartView({ data }) {
  const cols    = Object.keys(data[0]);
  const labelCol = cols[0];
  const valCol   = cols.find(c => /receita|valor|total/i.test(c)) || cols[1];

  const chartData = [...data]
    .sort((a,b) => Number(a[valCol]) - Number(b[valCol]))  // menor embaixo
    .map(row => ({
      label: applyMap(String(row[labelCol])),
      value: Number(row[valCol]),
    }));

  const maxVal = Math.max(...chartData.map(d => d.value));

  return (
    <div style={s.wrap}>
      <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 42)}>
        <BarChart data={chartData} layout="vertical"
          margin={{ top:4, right:24, left:4, bottom:4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" horizontal={false}/>
          <XAxis type="number" tickFormatter={fmtMoney}
            tick={{ fontSize:10, fill:"#9CA3AF", fontFamily:"Inter" }}
            axisLine={false} tickLine={false}/>
          <YAxis type="category" dataKey="label" width={72}
            tick={{ fontSize:12, fill:"#374151", fontFamily:"Inter", fontWeight:500 }}
            axisLine={false} tickLine={false}/>
          <Tooltip content={<CustomTooltip/>} cursor={{ fill:"#F8FAFC" }}/>
          <Bar dataKey="value" name="Receita" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {chartData.map((entry, i) => (
              <Cell key={i}
                fill={entry.value === maxVal ? LINX : LINX_LIGHT}
                opacity={entry.value === maxVal ? 1 : 0.55 + (i / chartData.length) * 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Gráfico de barras agrupadas (comparativo) ───────────────────── */
function GroupedBarView({ data }) {
  const cols    = Object.keys(data[0]);
  const labelCol = cols[0];
  const col2023  = cols.find(c => /2023/.test(c));
  const col2024  = cols.find(c => /2024/.test(c));
  if (!col2023 || !col2024) return null;

  const chartData = data.map(row => ({
    label: applyMap(String(row[labelCol])),
    "2023": Number(row[col2023]),
    "2024": Number(row[col2024]),
  }));

  return (
    <div style={s.wrap}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top:10, right:20, left:10, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false}/>
          <XAxis dataKey="label" tick={{ fontSize:11, fill:"#9CA3AF", fontFamily:"Inter" }}
            axisLine={false} tickLine={false}/>
          <YAxis tickFormatter={fmtMoney}
            tick={{ fontSize:10, fill:"#9CA3AF", fontFamily:"Inter" }}
            axisLine={false} tickLine={false} width={52}/>
          <Tooltip content={<CustomTooltip/>} cursor={{ fill:"#F8FAFC" }}/>
          <Legend wrapperStyle={{ fontSize:11, fontFamily:"Inter", paddingTop:8 }}/>
          <Bar dataKey="2023" name="2023" fill={BLUE_LIGHT} radius={[3,3,0,0]} maxBarSize={22}/>
          <Bar dataKey="2024" name="2024" fill={LINX}       radius={[3,3,0,0]} maxBarSize={22}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Export principal ────────────────────────────────────────────── */
export default function DataChart({ data }) {
  const type = detectChartType(data);
  if (!type) return null;
  if (type === "area")    return <AreaChartView    data={data}/>;
  if (type === "bar")     return <BarChartView     data={data}/>;
  if (type === "grouped") return <GroupedBarView   data={data}/>;
  return null;
}

const s = {
  wrap: {
    background:"var(--surface)", borderRadius:12,
    border:"1px solid var(--border)", padding:"16px 8px 8px",
    marginBottom:8, boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
  },
};
