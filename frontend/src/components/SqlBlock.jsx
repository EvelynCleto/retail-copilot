import { useState } from "react";
export default function SqlBlock({ sql }) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;
  return (
    <span style={s.wrap}>
      <button
        className="sql-btn"
        style={s.btn}
        onClick={() => setOpen(o => !o)}
        title="Ver a consulta executada no banco">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="var(--text-disabled)" strokeWidth="1.8"/>
          <path d="M12 8v1M12 11.5v4.5" stroke="var(--text-disabled)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span>Ver fonte</span>
      </button>
      {open && (
        <div style={s.panel}>
          <pre style={s.pre}>{sql}</pre>
        </div>
      )}
    </span>
  );
}
const s = {
  wrap:  { display:"inline-flex", flexDirection:"column", gap:4 },
  btn:   {
    display:"inline-flex", alignItems:"center", gap:5,
    background:"none", border:"none", cursor:"pointer",
    fontSize:11, color:"var(--text-muted)", fontFamily:"inherit", padding:"4px 0",
    transition:"color 0.13s",
  },
  panel: { marginTop:4, borderRadius:9, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)" },
  pre:   {
    margin:0, padding:"11px 14px", background:"var(--sidebar)", color:"var(--linx)",
    fontSize:11, fontFamily:"'JetBrains Mono',monospace",
    overflowX:"auto", lineHeight:1.65, whiteSpace:"pre-wrap", wordBreak:"break-word",
  },
};
