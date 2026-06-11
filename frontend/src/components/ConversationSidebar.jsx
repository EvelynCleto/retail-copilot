import { useState, useEffect, useRef } from "react";

/* ─── Icons ──────────────────────────────────────────────────────── */
const PlusIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
const ChevL     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const BubbleIco = ({ active }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={active ? "#F5691E" : "#6B7280"} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const EditIco  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
const PinIco   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 6h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const TrashIco = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;

/* ─── Dropdown ───────────────────────────────────────────────────── */
function Menu({ conv, onRename, onPin, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} style={mn.wrap} onMouseDown={e => e.stopPropagation()}>
      <button style={mn.item} onClick={() => { onRename(); onClose(); }}><EditIco /> Renomear</button>
      <button style={mn.item} onClick={() => { onPin(); onClose(); }}><PinIco /> {conv.pinned ? "Desafixar" : "Fixar no topo"}</button>
      <div style={mn.sep} />
      <button style={{ ...mn.item, ...mn.danger }} onClick={() => { onDelete(); onClose(); }}><TrashIco /> Excluir</button>
    </div>
  );
}
const mn = {
  wrap:   { position:"absolute", top:"calc(100% + 3px)", right:4, zIndex:9999,
            background:"#1C2535", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, boxShadow:"0 10px 32px rgba(0,0,0,0.4)",
            minWidth:156, overflow:"hidden", padding:"3px 0" },
  item:   { display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 14px",
            background:"none", border:"none", color:"#C1C9D6", fontSize:12.5,
            fontFamily:"inherit", cursor:"pointer", textAlign:"left" },
  danger: { color:"#F87171" },
  sep:    { height:1, background:"rgba(255,255,255,0.07)", margin:"3px 0" },
};

/* ─── ConvItem ───────────────────────────────────────────────────── */
function ConvItem({ conv, active, onSelect, onRename, onPin, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(conv.title);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(conv.title); }, [conv.title]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const commit = () => { if (draft.trim()) onRename(draft.trim()); setEditing(false); };

  if (editing) {
    return (
      <div style={{ padding:"3px 8px" }}>
        <input ref={inputRef} style={ci.editInput}
          value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key==="Enter") commit(); if (e.key==="Escape") setEditing(false); }}
        />
      </div>
    );
  }

  return (
    <div style={{ position:"relative" }} className="conv-item-wrap">
      <button
        className={`conv-btn ${active ? "conv-active" : ""}`}
        style={ci.btn}
        onClick={onSelect}
      >
        <BubbleIco active={active} />
        <span style={{ ...ci.label, color: active ? "#FFFFFF" : "#9CA3AF" }}
          title={conv.title}>
          {conv.pinned && <span style={{ fontSize:9, marginRight:3 }}>📌</span>}
          {conv.title}
        </span>
        <button className="conv-dot-btn" style={ci.dot}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(o => !o); }}
          title="Opções">···</button>
      </button>
      {menuOpen && (
        <Menu conv={conv}
          onRename={() => setEditing(true)}
          onPin={onPin}
          onDelete={onDelete}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
const ci = {
  btn: { width:"100%", display:"flex", alignItems:"center", gap:7,
         padding:"7px 9px", borderRadius:8, border:"none",
         background:"transparent", cursor:"pointer",
         color:"#9CA3AF", fontSize:12.5,
         fontFamily:"inherit", textAlign:"left" },
  label: { flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  dot:   { background:"none", border:"none", cursor:"pointer",
           color:"#6B7280", fontSize:16, padding:"0 2px",
           lineHeight:0.8, flexShrink:0, opacity:0,
           letterSpacing:"1px", transition:"opacity .12s" },
  editInput: { width:"100%", padding:"5px 8px",
               background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.22)",
               borderRadius:6, color:"#E2E8F0", fontSize:12.5,
               fontFamily:"inherit", outline:"none" },
};

/* ─── Sidebar ────────────────────────────────────────────────────── */
export default function ConversationSidebar({
  open, conversations, activeId,
  onSelect, onNew, onToggle, onRename, onDelete, onPin,
}) {
  const pinned   = conversations.filter(c => c.pinned);
  const unpinned = conversations.filter(c => !c.pinned);

  return (
    <div style={{ ...sb.root, transform: open ? "translateX(0)" : "translateX(-252px)" }}>
      {/* Header */}
      <div style={sb.header}>
        <div style={sb.brand}>
          <div style={sb.logoBox}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="9" height="9" rx="2" fill="#F5691E" opacity=".9"/>
              <rect x="13" y="2" width="9" height="9" rx="2" fill="#F5691E" opacity=".55"/>
              <rect x="2" y="13" width="9" height="9" rx="2" fill="#F5691E" opacity=".55"/>
              <rect x="13" y="13" width="9" height="9" rx="2" fill="#F5691E" opacity=".25"/>
            </svg>
          </div>
          <span style={sb.brandName}>Retail Insights</span>
        </div>
        <button style={sb.toggleBtn} onClick={onToggle} title="Fechar menu">
          <ChevL />
        </button>
      </div>

      {/* Nova conversa */}
      <button style={sb.newBtn} onClick={onNew}>
        <PlusIcon /> Nova conversa
      </button>

      {/* Lista */}
      <div style={sb.list}>
        {pinned.length > 0 && (
          <>
            <div style={sb.groupLabel}>Fixadas</div>
            {pinned.map(c => (
              <ConvItem key={c.id} conv={c} active={c.id === activeId}
                onSelect={() => onSelect(c.id)} onRename={t => onRename(c.id, t)}
                onPin={() => onPin(c.id)} onDelete={() => onDelete(c.id)} />
            ))}
          </>
        )}
        <div style={sb.groupLabel}>{pinned.length > 0 ? "Conversas" : "Histórico"}</div>
        {unpinned.map(c => (
          <ConvItem key={c.id} conv={c} active={c.id === activeId}
            onSelect={() => onSelect(c.id)} onRename={t => onRename(c.id, t)}
            onPin={() => onPin(c.id)} onDelete={() => onDelete(c.id)} />
        ))}
      </div>

      {/* Footer com metadados */}
      <div style={sb.footer}>
        <div style={sb.footTop}>
          <span style={sb.footDot} />
          <span style={sb.footStatus}>Banco ativo</span>
        </div>
        <div style={sb.footMeta}>
          <div style={sb.footRow}><span style={sb.footKey}>Período</span><span style={sb.footVal}>2023 – 2024</span></div>
          <div style={sb.footRow}><span style={sb.footKey}>Registros</span><span style={sb.footVal}>90.559</span></div>
          <div style={sb.footRow}><span style={sb.footKey}>Lojas</span><span style={sb.footVal}>A, B, C, D, E</span></div>
          <div style={sb.footRow}><span style={sb.footKey}>Categorias</span><span style={sb.footVal}>5 · 1.768 produtos</span></div>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const sb = {
  root:      { position:"fixed", top:0, left:0, bottom:0, width:252,
               background:"#0E1117", display:"flex", flexDirection:"column",
               borderRight:"1px solid rgba(255,255,255,0.06)",
               transition:"transform .2s cubic-bezier(.25,.1,.25,1)", zIndex:100 },
  header:    { display:"flex", alignItems:"center", justifyContent:"space-between",
               padding:"14px 12px 8px", flexShrink:0 },
  brand:     { display:"flex", alignItems:"center", gap:10 },
  logoBox:   { width:32, height:32, borderRadius:9, background:"rgba(245,105,30,.15)",
               border:"1px solid rgba(245,105,30,.25)", display:"flex",
               alignItems:"center", justifyContent:"center" },
  brandName: { color:"#E8ECF1", fontWeight:600, fontSize:13.5, letterSpacing:"-0.01em" },
  toggleBtn: { background:"none", border:"none", cursor:"pointer",
               color:"#4B5563", padding:4, borderRadius:5, display:"flex", alignItems:"center" },
  newBtn:    { margin:"4px 10px 10px", padding:"8px 12px",
               background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)",
               borderRadius:9, cursor:"pointer", display:"flex", alignItems:"center", gap:7,
               color:"#C1C9D6", fontSize:12.5, fontFamily:"inherit", flexShrink:0 },
  list:      { flex:1, overflowY:"auto", padding:"0 6px" },
  groupLabel:{ fontSize:9.5, fontWeight:800, color:"#374151",
               textTransform:"uppercase", letterSpacing:"0.1em", padding:"6px 7px 3px" },
  footer:    { padding:"11px 12px 13px", borderTop:"1px solid rgba(255,255,255,0.06)", flexShrink:0 },
  footTop:   { display:"flex", alignItems:"center", gap:6, marginBottom:9 },
  footDot:   { width:6, height:6, borderRadius:"50%", background:"#22C55E",
               boxShadow:"0 0 0 2px rgba(34,197,94,.2)", flexShrink:0 },
  footStatus:{ color:"#6B7280", fontSize:11, fontWeight:500 },
  footMeta:  { display:"flex", flexDirection:"column", gap:4 },
  footRow:   { display:"flex", justifyContent:"space-between", alignItems:"center" },
  footKey:   { fontSize:10, color:"#4B5563", fontWeight:500 },
  footVal:   { fontSize:10, color:"#6B7280" },
};

const css = `
  /* Conversa ativa: branco legível sobre fundo escuro */
  .conv-active { background: rgba(255,255,255,0.10) !important; }
  .conv-active span { color: #FFFFFF !important; }

  /* Hover nas conversas */
  .conv-btn:not(.conv-active):hover { background: rgba(255,255,255,0.05) !important; }

  /* Botão ··· aparece no hover do item */
  .conv-item-wrap:hover .conv-dot-btn { opacity: 1 !important; }

  /* Footer hover */
  .conv-btn:hover .conv-dot-btn { opacity: 1 !important; }
`;
