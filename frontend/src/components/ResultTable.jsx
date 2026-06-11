export default function ResultTable({ data }) {
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

  const fmt = (val) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") {
      // Monetário: valores grandes
      if (Math.abs(val) >= 1000) {
        return val.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      return val.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return String(val);
  };

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={styles.th}>
                {h.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
              {headers.map((h) => (
                <td key={h} style={styles.td}>
                  {fmt(row[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 0 && (
        <div style={styles.count}>{data.length} linha{data.length !== 1 ? "s" : ""}</div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    marginTop: "10px",
    overflowX: "auto",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    fontFamily: "'Inter', sans-serif",
  },
  th: {
    background: "#f8fafc",
    padding: "8px 14px",
    textAlign: "left",
    fontWeight: "600",
    color: "#475569",
    textTransform: "uppercase",
    fontSize: "11px",
    letterSpacing: "0.04em",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 14px",
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
  },
  rowEven: { background: "#ffffff" },
  rowOdd:  { background: "#fafbfc" },
  count: {
    padding: "6px 14px",
    fontSize: "11px",
    color: "#94a3b8",
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
    textAlign: "right",
  },
};
