import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import ConversationSidebar from "./components/ConversationSidebar";
import MessageBubble from "./components/MessageBubble";
import ChatActions from "./components/ChatActions";
import { sendMessage } from "./api";
import "./index.css";

const BASE = [
  "Resumo executivo do período.",
  "2023 vs 2024: quem saiu na frente?",
  "Qual loja liderou em faturamento?",
  "Top 5 categorias de 2023.",
  "Qual foi o pior mês em vendas?",
  "Qual o ticket médio por pedido?",
];
// Sugestões contextuais baseadas no ÚLTIMO assunto discutido
const CTX = {
  categoria: [
    "E a segunda colocada?",
    "Qual categoria mais cresceu em 2024?",
    "Qual categoria teve maior queda?",
    "Compare categorias 2023 x 2024.",
  ],
  loja: [
    "E a segunda colocada?",
    "Compare todas as lojas.",
    "Qual loja cresceu mais?",
    "Ticket médio por loja.",
  ],
  produto: [
    "E o segundo produto?",
    "Top 10 produtos mais vendidos.",
    "Produto líder por categoria.",
    "Produto com maior crescimento.",
  ],
  mes: [
    "Ver todos os meses de 2024.",
    "Qual foi o pior mês?",
    "Compare com os meses de 2023.",
    "Qual mês teve mais pedidos?",
  ],
  ano: [
    "O que mais cresceu em 2024?",
    "O que mais caiu em 2024?",
    "Loja com maior crescimento.",
    "Categoria com maior queda.",
  ],
  resumo: [
    "Quais os pontos de atenção?",
    "Onde estão as oportunidades?",
    "Quais categorias caíram?",
    "Quais lojas precisam de atenção?",
  ],
  receita: [
    "E em 2023, qual foi a receita?",
    "Qual mês teve mais receita?",
    "Receita por categoria.",
    "Receita por loja.",
  ],
  ticket: [
    "Ticket médio por loja.",
    "Ticket médio por categoria.",
    "Ticket médio em 2023.",
    "Como o ticket evoluiu de 2023 para 2024?",
  ],
};
const PHASES = [
  ["Analisando...", 0],
  ["Consultando os dados...", 950],
  ["Preparando resposta...", 2500],
];

function topic(q) {
  const s = (q || "").toLowerCase();
  if (/ticket|médio|média/.test(s)) return "ticket";
  if (/receita|faturamento|vendeu|vendas/.test(s)) return "receita";
  if (/categori|vestido|calç|casaco|camisa|saia/.test(s)) return "categoria";
  if (/loja [abcde]|lojas|onde|filial/.test(s)) return "loja";
  if (/produto|item|mochila|camiseta/.test(s)) return "produto";
  if (/mês|meses|mensal|janeiro|fevereiro|novembro/.test(s)) return "mes";
  if (/2023|2024|comparar|compare|ano|biênio/.test(s)) return "ano";
  if (/resumo|ceo|executivo|destaque|overview/.test(s)) return "resumo";
  return null;
}
function getChips(used, msgs) {
  if (!msgs.length) return BASE.slice(0, 5);
  // Usar ÚLTIMA mensagem do usuário para contexto
  const lastUser = [...msgs].reverse().find(m => m.role === "user");
  // Também verificar ÚLTIMA resposta da IA para melhorar contexto
  const lastAsst = [...msgs].reverse().find(m => m.role === "assistant");
  const lastContent = (lastUser?.content || "") + " " + (lastAsst?.content?.slice(0,200) || "");
  const t = topic(lastContent);
  const ctx = t ? (CTX[t] || []) : [];
  // Combinar sugestões contextuais + base, sem repetir usadas
  const pool = [...ctx, ...BASE];
  return [...new Set(pool)].filter(s => !used.has(s)).slice(0, 4);
}

let _id = 0;
const mkC = (t = "Nova conversa") => ({ id: ++_id, title: t, messages: [], pinned: false, titleLocked: false });

export default function App() {
  const [convs, setConvs]     = useState(() => [mkC()]);
  const [active, setActive]   = useState(1);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase]     = useState("");
  const [sidebar, setSidebar] = useState(true);
  const [used, setUsed]       = useState(new Set());
  const [chipList, setChipList] = useState(BASE.slice(0, 5));

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const ptimers   = useRef([]);

  const conv = convs.find(c => c.id === active) || convs[0];
  const msgs = conv?.messages || [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  useEffect(() => {
    if (msgs.length > 0) {
      setChipList(getChips(used, msgs));
      // Após 4 mensagens, colapsar automaticamente
      if (msgs.length >= 4) setChipsVisible(false);
    }
  }, [msgs]);

  const startPhases = () => {
    ptimers.current.forEach(clearTimeout);
    ptimers.current = PHASES.map(([t, d]) => setTimeout(() => setPhase(t), d));
  };
  const stopPhases = () => { ptimers.current.forEach(clearTimeout); setPhase(""); };

  const upd = (id, fn) => setConvs(p => p.map(c => c.id === id ? fn(c) : c));
  const apiHist = () => msgs.map(m => ({ role: m.role, content: m.content }));

  const send = useCallback(async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    const isFirst = msgs.length === 0;
    setInput("");
    setUsed(p => new Set([...p, q]));
    upd(active, c => ({ ...c, messages: [...c.messages, { role: "user", content: q, displayContent: q }] }));
    setLoading(true);
    startPhases();

    try {
      const data = await sendMessage(q, apiHist(), isFirst);
      upd(active, c => ({
        ...c,
        title: (!c.titleLocked && data.conversation_title) ? data.conversation_title : c.title,
        messages: [
          ...c.messages.map(m =>
            m.role === "user" && m.content === q
              ? { ...m, displayContent: q }  // SEMPRE mostrar texto original do usuário
              : m
          ),
          { role: "assistant", content: data.answer, sql: data.sql,
            kpis: data.kpis, table: data.table, error: data.error },
        ],
      }));
    } catch {
      upd(active, c => ({
        ...c,
        messages: [...c.messages, {
          role: "assistant",
          content: "**Não foi possível conectar ao servidor.**\n\nVerifique se o backend está rodando em localhost:8000.",
          error: true,
        }],
      }));
    } finally {
      stopPhases();
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, msgs, active]);

  const newChat = () => {
    const c = mkC();
    setConvs(p => [c, ...p]);
    setActive(c.id);
    setUsed(new Set());
    setChipList(BASE.slice(0, 5));
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const delChat = id => setConvs(p => {
    const f = p.filter(c => c.id !== id);
    if (id === active) { const next = f[0] || mkC(); if (!f.length) { setActive(next.id); return [next]; } setActive(f[0].id); }
    return f.length ? f : [mkC()];
  });
  const renameChat = (id, t) => setConvs(p => p.map(c => c.id === id ? { ...c, title: t, titleLocked: true } : c));
  const pinChat    = id      => setConvs(p => p.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));

  const isEmpty   = msgs.length === 0;
  const showChips = !isEmpty && !loading;

  return (
    <div style={s.root}>
      <ConversationSidebar
        open={sidebar} conversations={convs} activeId={active}
        onSelect={id => { setActive(id); setUsed(new Set()); }}
        onNew={newChat} onToggle={() => setSidebar(o => !o)}
        onRename={renameChat} onDelete={delChat} onPin={pinChat}
      />
      <div style={{ ...s.area, marginLeft: sidebar ? 252 : 0 }}>
        <Header sidebar={sidebar} onToggle={() => setSidebar(o => !o)}
          title={conv?.title || "Nova conversa"} onCEO={() => send("Resumo executivo")}
          messages={msgs} />
        <main style={s.main}>
          {isEmpty
            ? <Empty onSelect={send} loading={loading} />
            : <div style={s.feed}>
                {msgs.map((m, i) => (
                  <MessageBubble key={`${active}-${i}`} message={m} isNew={i === msgs.length - 1} />
                ))}
                {loading && <Thinking phase={phase} />}
                <div ref={bottomRef} />
              </div>
          }
        </main>
        <Footer ref={inputRef} input={input} setInput={setInput}
          onSend={send} loading={loading}
          chips={showChips && !input.trim() ? chipList : []}
          chipsVisible={chipsVisible}
          onToggleChips={() => setChipsVisible(v => !v)}
          hasChips={showChips && chipList.length > 0}
          isEmpty={isEmpty} />
      </div>
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────────────── */
function Header({ sidebar, onToggle, title, onCEO, messages = [] }) {
  return (
    <header style={hd.wrap}>
      <div style={hd.inner}>
        <div style={hd.left}>
          {!sidebar && (
            <button style={hd.iconBtn} onClick={onToggle} aria-label="Abrir menu">
              <MenuIcon />
            </button>
          )}
          <span style={hd.title}>{title}</span>
        </div>
        <div style={hd.right}>
          <button style={hd.ceo} onClick={onCEO}>
            <BriefingIcon /> Briefing CEO
          </button>
          {messages.length >= 2 && (
            <ChatActions title={title} messages={messages} />
          )}
          <span style={hd.divider} />
          <span style={hd.dot} />
          <span style={hd.status}>Banco ativo</span>
        </div>
      </div>
      {/* Linha de acento laranja Linx */}
      <div style={hd.accent} />
    </header>
  );
}
const hd = {
  wrap:   { background:"var(--surface)", borderBottom:"1px solid var(--border)", flexShrink:0, zIndex:20 },
  inner:  { padding:"0 22px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between" },
  left:   { display:"flex", alignItems:"center", gap:10 },
  iconBtn:{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)",
            padding:5, borderRadius:7, display:"flex", alignItems:"center" },
  title:  { fontSize:13.5, fontWeight:600, color:"var(--text-primary)", letterSpacing:"-0.01em" },
  right:  { display:"flex", alignItems:"center", gap:9 },
  ceo:    { display:"flex", alignItems:"center", gap:6,
            background:"var(--linx-soft)", border:"1px solid var(--linx-muted)",
            borderRadius:8, padding:"5px 12px",
            fontSize:11.5, fontWeight:600, color:"var(--linx-deep)",
            cursor:"pointer", fontFamily:"inherit",
            transition:"background .13s" },
  divider:{ width:1, height:16, background:"var(--border)" },
  dot:    { width:7, height:7, borderRadius:"50%", background:"#22C55E",
            boxShadow:"0 0 0 2px rgba(34,197,94,.2)" },
  status: { fontSize:11, color:"var(--text-secondary)", fontWeight:500 },
  accent: { height:2,
            background:"linear-gradient(90deg, transparent 0%, var(--linx) 30%, #FF9F5A 70%, transparent 100%)",
            opacity:0.8 },
};

/* ── Empty state ─────────────────────────────────────────────────── */
function Empty({ onSelect, loading }) {
  return (
    <div style={em.wrap}>
      <div style={em.hero}>
        <div style={em.logoWrap}>
          {/* Ícone Linx-inspired */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="9" height="9" rx="2" fill="var(--linx)" opacity=".9"/>
            <rect x="13" y="2" width="9" height="9" rx="2" fill="var(--linx)" opacity=".55"/>
            <rect x="2" y="13" width="9" height="9" rx="2" fill="var(--linx)" opacity=".55"/>
            <rect x="13" y="13" width="9" height="9" rx="2" fill="var(--linx)" opacity=".25"/>
          </svg>
        </div>
        <h1 style={em.h1}>Retail Insights</h1>
        <p style={em.p}>Faça qualquer pergunta sobre as vendas de 2023–2024. Busco direto no banco.</p>
      </div>
      <p style={em.label}>Perguntas frequentes</p>
      <div className="egrid" style={em.grid}>
        {BASE.map((sg, i) => (
          <button key={sg} className="ecard"
            style={{ ...em.card, animationDelay: `${i * 50}ms` }}
            onClick={() => onSelect(sg)} disabled={loading}>
            <span style={em.arrow}>↗</span>
            <span>{sg}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const em = {
  wrap:    { maxWidth: 520, margin: "18px auto 0" },
  hero:    { textAlign: "center", marginBottom: 26 },
  logoWrap:{ width:52, height:52, borderRadius:14, background:"var(--linx-soft)",
             border:"1px solid var(--linx-muted)", display:"flex", alignItems:"center",
             justifyContent:"center", margin:"0 auto 16px" },
  h1:      { fontSize:19, fontWeight:700, color:"var(--text-primary)", margin:"0 0 7px",
             letterSpacing:"-0.025em", lineHeight:1.25 },
  p:       { fontSize:13, color:"var(--text-secondary)", margin:0, lineHeight:1.65 },
  label:   { fontSize:9.5, fontWeight:800, color:"var(--text-muted)", textTransform:"uppercase",
             letterSpacing:"0.1em", marginBottom:8 },
  grid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 },
  card:    { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10,
             padding:"10px 13px", fontSize:12.5, color:"var(--text-secondary)", cursor:"pointer",
             textAlign:"left", fontFamily:"inherit", lineHeight:1.45,
             display:"flex", alignItems:"flex-start", gap:7,
             boxShadow:"var(--shadow-xs)",
             opacity:0, animation:"fadeUp .25s var(--ease) forwards" },
  arrow:   { color:"var(--text-disabled)", fontSize:10, flexShrink:0, marginTop:1 },
};

/* ── Thinking ────────────────────────────────────────────────────── */
function Thinking({ phase }) {
  return (
    <div style={th.row}>
      <div style={th.av}><span style={th.ri}>RI</span></div>
      <div style={th.bub}>
        <span style={th.ph}>{phase || "Analisando..."}</span>
        <span style={th.dots}>
          {[0,1,2].map(i => <span key={i} className={`dot${i}`} style={th.dot} />)}
        </span>
      </div>
    </div>
  );
}
const th = {
  row:  { display:"flex", gap:8, marginBottom:12, alignItems:"flex-start" },
  av:   { width:26, height:26, borderRadius:8, background:"var(--sidebar)",
          display:"flex", alignItems:"center", justifyContent:"center",
          flexShrink:0, boxShadow:"var(--shadow-sm)" },
  ri:   { color:"var(--linx)", fontSize:8, fontWeight:900, letterSpacing:"0.07em" },
  bub:  { background:"var(--surface)", border:"1px solid var(--border)", padding:"8px 14px",
          borderRadius:"3px 12px 12px 12px", display:"flex", alignItems:"center",
          gap:10, boxShadow:"var(--shadow-xs)" },
  ph:   { fontSize:11.5, color:"var(--text-muted)", fontStyle:"italic" },
  dots: { display:"flex", gap:3, alignItems:"center" },
  dot:  { display:"inline-block", width:4, height:4, borderRadius:"50%", background:"#D1D5DB" },
};

/* ── Footer / Input ──────────────────────────────────────────────── */
const Footer = forwardRef(function Footer(
  { input, setInput, onSend, loading, chips, chipsVisible, onToggleChips, hasChips, isEmpty }, ref
) {
  const key = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } };
  return (
    <footer style={{ ...ft.foot, ...(isEmpty ? ft.empty : {}) }}>
      {/* Barra de sugestões com toggle */}
      {hasChips && !isEmpty && (
        <div style={ft.chipsWrap}>
          <div style={ft.chipsHeader}>
            <span style={ft.chipsLabel}>Sugestões</span>
            <button style={ft.chipsToggle} onClick={onToggleChips} title={chipsVisible ? "Ocultar sugestões" : "Mostrar sugestões"}>
              {chipsVisible ? "−" : "+"}
            </button>
          </div>
          {chipsVisible && chips.length > 0 && (
            <div style={ft.chips}>
              {chips.map((chip, i) => (
                <button key={chip} style={{...ft.chip, animationDelay:`${i*35}ms`}}
                  className="suggestion-chip"
                  onClick={() => onSend(chip)} disabled={loading}>
                  <span style={ft.chipArrow}>→</span>
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={ft.row}>
        <textarea ref={ref} className="ri-textarea" style={ft.ta}
          value={input} rows={1}
          onChange={e => setInput(e.target.value)}
          onKeyDown={key} disabled={loading}
          placeholder="Pergunte qualquer coisa sobre o negócio..." />
        <button
          className="send-btn"
          style={{ ...ft.send, ...(loading || !input.trim() ? ft.off : ft.on) }}
          onClick={() => onSend()} disabled={loading || !input.trim()}>
          <ArrowUp active={!loading && !!input.trim()} />
        </button>
      </div>
      <p style={ft.hint}>Enter para enviar · Shift+Enter nova linha</p>
    </footer>
  );
});
const ft = {
  foot:  { background:"var(--surface)", borderTop:"1px solid var(--border)",
           padding:"8px 22px 13px", flexShrink:0 },
  empty: { background:"transparent", borderTop:"none" },
  chipsWrap:   { maxWidth:760, margin:"0 auto 6px" },
  chipsHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 },
  chipsLabel:  { fontSize:9.5, fontWeight:700, color:"var(--text-disabled)",
                 textTransform:"uppercase", letterSpacing:"0.1em" },
  chipsToggle: { background:"none", border:"none", cursor:"pointer",
                 fontSize:14, color:"var(--text-muted)", fontFamily:"inherit",
                 padding:"0 4px", lineHeight:1, fontWeight:400,
                 transition:"color .12s" },
  chips: { display:"flex", gap:5, flexWrap:"wrap" },
  chip:  { display:"inline-flex", alignItems:"center", gap:5,
           background:"var(--surface)", border:"1px solid var(--border)",
           borderRadius:20, padding:"4px 12px 4px 9px",
           fontSize:11.5, color:"var(--text-secondary)", cursor:"pointer",
           fontFamily:"inherit", whiteSpace:"nowrap",
           transition:"border-color .13s, color .13s, background .13s",
           opacity:0, animation:"fadeUp .2s var(--ease) forwards" },
  chipArrow:{ fontSize:9, color:"var(--linx)", flexShrink:0, opacity:0.7 },
  row:   { maxWidth:760, margin:"0 auto", display:"flex", gap:8, alignItems:"flex-end" },
  ta:    { flex:1, border:"1px solid var(--border)", borderRadius:14,
           padding:"10px 17px", fontSize:13.5, fontFamily:"inherit",
           resize:"none", lineHeight:1.55, color:"var(--text-primary)",
           background:"var(--bg)",
           transition:"border-color .15s, background .15s, box-shadow .15s" },
  send:  { width:38, height:38, borderRadius:11, border:"none", cursor:"pointer",
           display:"flex", alignItems:"center", justifyContent:"center",
           flexShrink:0, transition:"background 0.15s ease, box-shadow 0.15s ease" },
  on:    { background:"var(--linx)", boxShadow:"0 2px 10px rgba(245,105,30,.35)" },
  off:   { background:"var(--border)", cursor:"not-allowed" },
  hint:  { maxWidth:760, margin:"4px auto 0", fontSize:10, color:"var(--text-disabled)", textAlign:"center" },
};

/* ── Icons ───────────────────────────────────────────────────────── */
const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const BriefingIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const ArrowUp = ({ active }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M12 20V4M4 12l8-8 8 8"
      stroke={active ? "#fff" : "var(--text-muted)"} strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ── Layout styles ───────────────────────────────────────────────── */
const s = {
  root: { display:"flex", height:"100vh", background:"var(--bg)",
          fontFamily:"'Inter',sans-serif", overflow:"hidden" },
  area: { flex:1, display:"flex", flexDirection:"column", minWidth:0,
          transition:"margin-left .2s var(--ease)" },
  main: { flex:1, overflowY:"auto", padding:"14px 22px 8px" },
  feed: { maxWidth:760, margin:"0 auto" },
};
