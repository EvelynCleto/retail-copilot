import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import KpiCards from "./KpiCards";
import RankingTable from "./RankingTable";
import SqlBlock from "./SqlBlock";

/* ── Copy button ───────────────────────────────────────────────── */
function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  const go = async () => {
    try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }
    catch {}
  };
  return (
    <button onClick={go} style={ac.btn} title="Copiar resposta">
      {ok
        ? <><CheckIco /><span style={{ color:"var(--green)" }}>Copiado</span></>
        : <><CopyIco /><span>Copiar</span></>
      }
    </button>
  );
}
const ac = {
  btn: { display:"inline-flex", alignItems:"center", gap:4,
         background:"none", border:"none", cursor:"pointer",
         fontSize:11, color:"var(--text-muted)", fontFamily:"inherit", padding:"2px 0" },
};

/* ── Insight extractor ─────────────────────────────────────────── */
function getInsight(content) {
  const lines = content.split("\n")
    .map(l => l.replace(/^[*#\-\s\d\.]+/, "").trim())
    .filter(l => l.length > 18 && l.length < 180 && !l.match(/^R\$/) && !l.includes("|"));
  const last = lines[lines.length - 1] || "";
  return last.length > 18 ? last : null;
}

/* ── Markdown components ───────────────────────────────────────── */
const MD = {
  h1: ({ c }) => <h1 style={md.h1}>{c}</h1>,
  h2: ({ children }) => <h2 style={md.h2}>{children}</h2>,
  h3: ({ children }) => <h3 style={md.h3}>{children}</h3>,
  h4: ({ children }) => <h4 style={md.h4}>{children}</h4>,
  p:  ({ children }) => <p  style={md.p }>{children}</p>,
  ul: ({ children }) => <ul style={md.ul}>{children}</ul>,
  ol: ({ children }) => <ol style={md.ol}>{children}</ol>,
  li: ({ children }) => <li style={md.li}>{children}</li>,
  strong:    ({ children }) => <strong style={md.strong}>{children}</strong>,
  em:        ({ children }) => <em style={md.em}>{children}</em>,
  code:      ({ children }) => <code style={md.code}>{children}</code>,
  hr:        ()             => <hr style={md.hr}/>,
  blockquote:({ children }) => <blockquote style={md.bq}>{children}</blockquote>,
  table:({ children }) => <div style={md.tWrap}><table style={md.t}>{children}</table></div>,
  thead:({ children }) => <thead style={md.thead}>{children}</thead>,
  th:   ({ children }) => <th style={md.th}>{children}</th>,
  td:   ({ children }) => <td style={md.td}>{children}</td>,
  tr:   ({ children }) => <tr className="md-tr">{children}</tr>,
};
// Fix h1 to use children prop
MD.h1 = ({ children }) => <h1 style={md.h1}>{children}</h1>;

/* ── Component ─────────────────────────────────────────────────── */
export default function MessageBubble({ message, isNew }) {
  if (message.role === "user") {
    const display = message.displayContent || message.content;
    return (
      <div style={s.userRow} className={isNew ? "msg-new" : ""}>
        <div style={s.userBub} title={display !== message.content ? message.content : undefined}>
          {display}
        </div>
      </div>
    );
  }

  const hasTable = message.table && message.table.length >= 2;
  const hasKpis  = message.kpis && message.kpis.length > 0;
  const insight  = hasTable ? getInsight(message.content) : null;

  return (
    <div style={s.asstRow} className={isNew ? "msg-new" : ""}>
      <div style={s.av}>RI</div>
      <div style={s.body}>

        {hasKpis && <KpiCards kpis={message.kpis} />}

        {hasTable
          ? <RankingTable data={message.table} insight={insight || undefined} />
          : (
            <div style={{ ...s.bubble, ...(message.error ? s.err : {}) }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
                {message.content}
              </ReactMarkdown>
            </div>
          )
        }

        <div style={s.actions}>
          <CopyBtn text={message.content} />
          {message.sql && <SqlBlock sql={message.sql} />}
        </div>
      </div>
    </div>
  );
}

/* ── Layout styles ─────────────────────────────────────────────── */
const s = {
  userRow: { display:"flex", justifyContent:"flex-end", marginBottom:8 },
  userBub: {
    background:"#1B3A6B", color:"#DCE7F5",
    padding:"9px 16px", borderRadius:"15px 15px 3px 15px",
    maxWidth:"60%", fontSize:13, lineHeight:1.55,
    boxShadow:"0 1px 3px rgba(0,0,0,0.12)",
  },
  asstRow: { display:"flex", alignItems:"flex-start", gap:8, marginBottom:14 },
  av: {
    width:27, height:27, borderRadius:8,
    background:"var(--sidebar)", color:"var(--linx)",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:8, fontWeight:900, flexShrink:0, marginTop:2,
    letterSpacing:"0.07em", boxShadow:"var(--shadow-sm)",
  },
  body:   { flex:1, minWidth:0 },
  bubble: {
    background:"var(--surface)", border:"1px solid var(--border)",
    padding:"12px 17px", borderRadius:"3px 13px 13px 13px",
    fontSize:13.5, lineHeight:1.72, color:"var(--text-primary)",
    boxShadow:"var(--shadow-xs)", overflowX:"auto", marginBottom:4,
  },
  err:    { borderColor:"#FCA5A5", background:"#FFF8F8" },
  actions:{ display:"flex", alignItems:"center", gap:12, marginTop:4 },
};

/* ── Markdown styles ───────────────────────────────────────────── */
const md = {
  p:     { margin:"0 0 7px", lineHeight:1.72 },
  h1:    { fontSize:14.5, fontWeight:700, color:"var(--text-primary)", margin:"0 0 11px",
           letterSpacing:"-0.015em", paddingBottom:8, borderBottom:"2px solid var(--text-primary)" },
  h2:    { fontSize:12.5, fontWeight:700, color:"var(--text-primary)", margin:"13px 0 5px",
           paddingBottom:4, borderBottom:"1px solid var(--border-subtle)" },
  h3:    { fontSize:10, fontWeight:800, color:"var(--text-secondary)", margin:"11px 0 4px",
           textTransform:"uppercase", letterSpacing:"0.1em" },
  h4:    { fontSize:12.5, fontWeight:600, color:"var(--text-secondary)", margin:"9px 0 3px" },
  ul:    { margin:"0 0 7px", paddingLeft:14 },
  ol:    { margin:"0 0 7px", paddingLeft:14 },
  li:    { margin:"3px 0", lineHeight:1.65 },
  strong:{ fontWeight:700, color:"var(--text-primary)" },
  em:    { fontStyle:"normal", color:"var(--text-secondary)" },
  code:  { fontFamily:"'JetBrains Mono',monospace", fontSize:11,
           background:"#F4F6F9", padding:"1px 5px", borderRadius:4, color:"#0369A1" },
  hr:    { border:"none", borderTop:"1px solid var(--border-subtle)", margin:"9px 0" },
  bq:    { borderLeft:"3px solid var(--linx)", padding:"7px 12px",
           margin:"7px 0", color:"var(--text-secondary)", background:"var(--linx-soft)",
           borderRadius:"0 7px 7px 0" },
  tWrap: { overflowX:"auto", margin:"8px 0 10px", borderRadius:10,
           border:"1px solid var(--border)", boxShadow:"var(--shadow-xs)" },
  t:     { width:"100%", borderCollapse:"collapse", fontSize:12 },
  thead: { background:"#F8FAFC" },
  th:    { padding:"7px 13px", textAlign:"left", fontWeight:700, color:"var(--text-secondary)",
           fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em",
           borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" },
  td:    { padding:"7px 13px", color:"var(--text-primary)",
           borderBottom:"1px solid var(--border-subtle)", whiteSpace:"nowrap" },
};

/* ── Inline icons ──────────────────────────────────────────────── */
const CopyIco  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="#C5CBD4" strokeWidth="1.8"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="#C5CBD4" strokeWidth="1.8"/></svg>;
const CheckIco = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
