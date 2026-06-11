/**
 * RankingTable — tabela premium estilo Apple/Google.
 * Regras de design:
 * - Hierarquia clara: label leve, valor pesado
 * - Números alinhados à direita em monospace
 * - Barras proporcionais apenas para a coluna principal (receita)
 * - Total SOMENTE em séries temporais (meses) — nunca em rankings de categorias/lojas
 * - Pct nunca entra no total
 * - Zebra striping sutil
 */

const DMAP = { CALCA:"CALÇA", MACACAO:"MACACÃO", CALCAO:"CALÇÃO", SUETER:"SUÉTER" };
const MES  = { "01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril","05":"Maio",
               "06":"Junho","07":"Julho","08":"Agosto","09":"Setembro",
               "10":"Outubro","11":"Novembro","12":"Dezembro" };
const MEDALS = ["🥇","🥈","🥉"];

function applyMap(v) {
  if (typeof v !== "string") return v;
  for (const [k, d] of Object.entries(DMAP)) {
    v = v.replace(new RegExp(`\\b${k}\\b`, "g"), d);
  }
  // Converter YYYY-MM → "Mês" ou "Mês YYYY"
  return v.replace(/^(\d{4})-(\d{2})$/, (_, y, m) =>
    MES[m] ? (y === "2024" ? MES[m] : `${MES[m]} ${y}`) : `${m}/${y}`
  );
}

// Detectores de tipo por nome de coluna
const isMoney  = k => /receita|valor|total|ticket|preco/i.test(k);
const isCount  = k => /unidade|quantidade|pedido|cliente/i.test(k);
const isPct    = k => /pct|percent|particip|share/i.test(k);
const isSeries = k => /mes|data|periodo/i.test(k);
const isNum    = (rows, col) => rows.slice(0, 3).every(r => !isNaN(Number(r[col])));

function fmtVal(v, col) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return applyMap(String(v));
  if (isMoney(col))  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  if (isCount(col))  return n.toLocaleString("pt-BR");
  if (isPct(col))    return `${n.toFixed(1).replace(".", ",")}%`;
  // Coluna numérica desconhecida — se < 100 e parece pct, formatar como tal
  if (Math.abs(n) < 100 && String(v).includes(".")) return `${n.toFixed(1).replace(".", ",")}%`;
  return n.toLocaleString("pt-BR");
}

function fmtHeader(col) {
  const labels = {
    receita: "Receita", pct: "Participação", unidades: "Unidades",
    pedidos: "Pedidos", clientes: "Clientes", ticket: "Ticket Médio",
    mes: "Mês", loja: "Loja", categoria: "Categoria", produto: "Produto",
    cor: "Cor", tamanho: "Tamanho", colecao: "Coleção", uf: "UF",
    var: "Variação", r2023: "2023", r2024: "2024", p2023: "2023", p2024: "2024",
    t2023: "Ticket 2023", t2024: "Ticket 2024",
  };
  return labels[col.toLowerCase()] || col.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function RankingTable({ data }) {
  if (!data?.length) return null;

  const cols       = Object.keys(data[0]);
  const labelCol   = cols[0];
  const valCols    = cols.slice(1);
  const isTimeSeries = isSeries(labelCol);

  // Barra: somente coluna de receita (mais significativa)
  const barCol = valCols.find(c => isMoney(c));
  const maxVal = barCol ? Math.max(...data.map(r => Math.abs(Number(r[barCol]) || 0))) : 0;

  // Total: APENAS em séries temporais e APENAS para receita e contagens (nunca pct)
  const showTotal = isTimeSeries;
  const totals = showTotal
    ? valCols.reduce((acc, c) => {
        if (isNum(data, c) && (isMoney(c) || isCount(c)) && !isPct(c)) {
          acc[c] = data.reduce((s, r) => s + (Number(r[c]) || 0), 0);
        }
        return acc;
      }, {})
    : {};

  return (
    <div style={s.wrap}>
      <table style={s.table}>
        <thead>
          <tr style={s.headRow}>
            {!isTimeSeries && (
              <th style={{ ...s.th, width: 36, textAlign: "center" }}>#</th>
            )}
            <th style={{ ...s.th, textAlign: "left" }}>
              {fmtHeader(labelCol)}
            </th>
            {valCols.map(col => (
              <th key={col} style={{ ...s.th, textAlign: "right" }}>
                {fmtHeader(col)}
              </th>
            ))}
            {barCol && <th style={{ ...s.th, width: 72 }} />}
          </tr>
        </thead>

        <tbody>
          {data.map((row, i) => {
            const isTop = i < 3 && !isTimeSeries;
            const barPct = barCol && maxVal > 0
              ? (Math.abs(Number(row[barCol]) || 0) / maxVal) * 100
              : 0;
            const label = applyMap(String(row[labelCol] ?? ""));

            return (
              <tr
                key={i}
                className="rt-row"
                style={i % 2 === 0 ? s.rowEven : s.rowOdd}
              >
                {/* Coluna de ranking */}
                {!isTimeSeries && (
                  <td style={{ ...s.td, textAlign: "center", paddingRight: 0, width: 36 }}>
                    {isTop
                      ? <span style={{ fontSize: 15 }}>{MEDALS[i]}</span>
                      : <span style={s.rank}>{i + 1}</span>
                    }
                  </td>
                )}

                {/* Label principal */}
                <td style={{
                  ...s.td,
                  fontWeight: isTop ? 600 : 400,
                  color: isTop ? "var(--text-primary)" : "var(--text-secondary)",
                }}>
                  {label}
                </td>

                {/* Colunas de valor */}
                {valCols.map(col => (
                  <td key={col} style={{
                    ...s.td,
                    textAlign: "right",
                    fontFamily: (isMoney(col) || isCount(col))
                      ? "'JetBrains Mono', monospace" : "inherit",
                    fontSize: 12.5,
                    color: isTop ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: isTop && isMoney(col) ? 600 : 400,
                  }}>
                    {fmtVal(row[col], col)}
                  </td>
                ))}

                {/* Barra de proporção — só receita */}
                {barCol && (
                  <td style={s.barCell}>
                    <div style={s.barBg}>
                      <div style={{
                        ...s.barFill,
                        width: `${barPct.toFixed(1)}%`,
                        opacity: isTop ? 0.85 : 0.4,
                      }} />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}

          {/* Linha de total — apenas séries temporais */}
          {showTotal && Object.keys(totals).length > 0 && (
            <tr style={s.totalRow}>
              <td style={{ ...s.td, ...s.totalCell, fontWeight: 700, color: "var(--text-primary)" }}>
                Total
              </td>
              {valCols.map(col => (
                <td key={col} style={{
                  ...s.td, ...s.totalCell,
                  textAlign: "right",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}>
                  {totals[col] != null ? fmtVal(totals[col], col) : ""}
                </td>
              ))}
              {barCol && <td style={{ ...s.td, ...s.totalCell }} />}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Styles — clean, Apple-grade ─────────────────────────────────── */
const s = {
  wrap: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    marginBottom: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
  },
  headRow: {
    background: "#F8FAFC",
    borderBottom: "1px solid var(--border)",
  },
  th: {
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    userSelect: "none",
    background: "#F8FAFC",
  },
  td: {
    padding: "10px 16px",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
    whiteSpace: "nowrap",
    fontSize: 13,
  },
  rank: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: 6,
    background: "#F1F3F5",
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: 600,
  },
  rowEven: { background: "#FFFFFF" },
  rowOdd:  { background: "#FAFBFC" },
  barCell: { padding: "10px 14px 10px 8px", width: 70 },
  barBg:   { height: 4, borderRadius: 2, background: "#F0F2F5", overflow: "hidden" },
  barFill: {
    height: "100%",
    borderRadius: 2,
    background: "var(--linx)",
    transition: "width 0.5s ease",
  },
  totalRow: { background: "#F8FAFC" },
  totalCell: {
    borderTop: "1.5px solid var(--border)",
    borderBottom: "none",
    paddingTop: 11,
    paddingBottom: 11,
  },
};
