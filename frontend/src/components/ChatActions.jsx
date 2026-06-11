/**
 * ChatActions — menu ⋯ elegante para exportar (PDF/TXT) e copiar conversa.
 * Aparece no header quando há mensagens.
 */
import { useState, useRef, useEffect } from "react";

/* ── Markdown → HTML (para PDF) ─────────────────────────────────── */
function mdToHtml(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^# (.+)$/gm,  '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^- (.+)$/gm,  '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><span class="num">$1.</span> $2</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

/* ── Formatters ──────────────────────────────────────────────────── */
function buildTxt(title, messages) {
  const date = new Date().toLocaleDateString("pt-BR", { dateStyle:"long" });
  const sep  = "─".repeat(56);
  const lines = [
    "RETAIL INSIGHTS  ·  powered by Linx",
    `Conversa: ${title}`,
    `Data: ${date}`,
    "═".repeat(56),
    "",
  ];
  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`Você`, `  ${msg.content}`, "");
    } else {
      lines.push("Retail Insights");
      // Remover marcadores markdown para texto plano
      const plain = msg.content
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/^#+\s/gm, "")
        .replace(/^[-*]\s/gm, "  • ")
        .replace(/^(\d+)\.\s/gm, "  $1. ");
      lines.push(plain, "");
    }
    lines.push(sep, "");
  }
  lines.push("Retail Insights · Linx · Dados 2023–2024");
  return lines.join("\n");
}

function buildHtml(title, messages) {
  const date = new Date().toLocaleDateString("pt-BR", {
    day:"2-digit", month:"long", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  });

  const msgBlocks = messages.map(msg => {
    if (msg.role === "user") {
      const safe = msg.content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `
        <div class="message user-wrap">
          <div class="user-bubble">${safe}</div>
          <div class="msg-label user-label">Você</div>
        </div>`;
    }
    return `
      <div class="message asst-wrap">
        <div class="asst-avatar">RI</div>
        <div class="asst-content">
          <div class="asst-bubble"><p>${mdToHtml(msg.content)}</p></div>
          <div class="msg-label">Retail Insights</div>
        </div>
      </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Retail Insights</title>
<style>
/* ── Reset ─────────────────────────────────────────────── */
*{box-sizing:border-box;margin:0;padding:0}
/* ── Page ─────────────────────────────────────────────── */
html{background:#F5F6F8}
body{
  font-family:-apple-system,'Inter','Segoe UI',sans-serif;
  font-size:13px;line-height:1.7;color:#0E1117;
  background:#F5F6F8;min-height:100vh;
  padding:0 0 60px;
  -webkit-font-smoothing:antialiased;
}
/* ── Header ───────────────────────────────────────────── */
.page-header{
  background:#fff;border-bottom:1px solid #E5E8ED;
  padding:0;position:sticky;top:0;z-index:10;
  box-shadow:0 1px 8px rgba(0,0,0,0.06);
}
.header-inner{
  max-width:780px;margin:0 auto;
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 24px;
}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{
  width:34px;height:34px;border-radius:9px;
  background:#FFF2EB;border:1px solid #FDE8D8;
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:900;color:#F5691E;letter-spacing:.05em;
}
.brand-text{display:flex;flex-direction:column;gap:1px}
.brand-name{font-size:14px;font-weight:700;color:#0E1117;letter-spacing:-0.01em}
.brand-sub{font-size:10px;color:#9CA3AF;font-weight:500}
.header-accent{
  height:2px;
  background:linear-gradient(90deg,transparent 0%,#F5691E 30%,#FF9F5A 70%,transparent 100%);
  opacity:.8;
}
/* ── Meta bar ─────────────────────────────────────────── */
.meta-bar{
  background:#FAFBFC;border-bottom:1px solid #E5E8ED;
  padding:10px 0;
}
.meta-inner{
  max-width:780px;margin:0 auto;padding:0 24px;
  display:flex;align-items:center;justify-content:space-between;
}
.conv-title{font-size:15px;font-weight:700;color:#0E1117;letter-spacing:-0.015em}
.conv-date{font-size:11px;color:#9CA3AF}
/* ── Feed ─────────────────────────────────────────────── */
.feed{max-width:780px;margin:0 auto;padding:28px 24px}
/* ── Messages ─────────────────────────────────────────── */
.message{margin-bottom:18px;display:flex;gap:10px;align-items:flex-start}
/* User */
.user-wrap{flex-direction:row-reverse;align-items:flex-end}
.user-bubble{
  background:#1B3A6B;color:#DCE7F5;
  padding:10px 16px;border-radius:14px 14px 3px 14px;
  max-width:65%;font-size:13px;line-height:1.55;
  box-shadow:0 1px 4px rgba(0,0,0,0.12);
}
/* Assistant */
.asst-wrap{align-items:flex-start}
.asst-avatar{
  width:28px;height:28px;border-radius:8px;flex-shrink:0;margin-top:2px;
  background:#0E1117;color:#F5691E;
  display:flex;align-items:center;justify-content:center;
  font-size:8px;font-weight:900;letter-spacing:.07em;
  box-shadow:0 1px 4px rgba(0,0,0,0.2);
}
.asst-content{flex:1;min-width:0}
.asst-bubble{
  background:#fff;border:1px solid #E5E8ED;
  padding:13px 17px;border-radius:3px 13px 13px 13px;
  font-size:13.5px;line-height:1.72;color:#0E1117;
  box-shadow:0 1px 3px rgba(0,0,0,0.05);
  overflow:hidden;
}
/* Label */
.msg-label{font-size:10px;color:#9CA3AF;margin-top:4px;font-weight:500}
.user-label{text-align:right;margin-right:2px}
/* Markdown */
.asst-bubble h1{font-size:14.5px;font-weight:700;margin:0 0 10px;
  padding-bottom:7px;border-bottom:2px solid #0E1117;letter-spacing:-0.01em}
.asst-bubble h2{font-size:12.5px;font-weight:700;margin:13px 0 5px;
  padding-bottom:4px;border-bottom:1px solid #EEF0F4}
.asst-bubble h3{font-size:10px;font-weight:800;text-transform:uppercase;
  letter-spacing:.1em;color:#6B7280;margin:11px 0 4px}
.asst-bubble ul{margin:5px 0 8px;padding-left:16px}
.asst-bubble li{margin:3px 0;line-height:1.65}
.asst-bubble .num{font-weight:700;color:#0E1117}
.asst-bubble hr{border:none;border-top:1px solid #EEF0F4;margin:9px 0}
.asst-bubble strong{font-weight:700;color:#0E1117}
.asst-bubble p{margin:0 0 7px}
/* ── Footer ───────────────────────────────────────────── */
.page-footer{
  max-width:780px;margin:32px auto 0;padding:16px 24px 0;
  border-top:1px solid #E5E8ED;
  display:flex;align-items:center;justify-content:space-between;
}
.footer-brand{font-size:11px;font-weight:600;color:#9CA3AF}
.footer-note{font-size:10px;color:#C5CBD4}
/* ── Print ────────────────────────────────────────────── */
@media print{
  body{background:#fff;padding:0}
  html{background:#fff}
  .page-header{position:relative;box-shadow:none}
  .asst-bubble,.user-bubble{break-inside:avoid;box-shadow:none}
  .message{break-inside:avoid}
}
</style>
</head>
<body>

<div class="page-header">
  <div class="header-inner">
    <div class="brand">
      <div class="brand-icon">RI</div>
      <div class="brand-text">
        <span class="brand-name">Retail Insights</span>
        <span class="brand-sub">powered by Linx</span>
      </div>
    </div>
    <span style="font-size:11px;color:#9CA3AF">Exportado em ${date}</span>
  </div>
  <div class="header-accent"></div>
</div>

<div class="meta-bar">
  <div class="meta-inner">
    <span class="conv-title">${title}</span>
    <span class="conv-date">${date}</span>
  </div>
</div>

<div class="feed">
${msgBlocks}
</div>

<div class="page-footer">
  <span class="footer-brand">Retail Insights · Linx</span>
  <span class="footer-note">Dados referentes ao período 2023–2024</span>
</div>

</body>
</html>`;
}

/* ── Dropdown menu ───────────────────────────────────────────────── */
function ActionsMenu({ title, messages, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const [txtDone, setTxtDone] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const downloadTxt = () => {
    const blob = new Blob([buildTxt(title, messages)], { type:"text/plain;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `retail-insights-${title.toLowerCase().replace(/\s+/g,"-")}.txt`,
    });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTxtDone(true); setTimeout(() => setTxtDone(false), 2000);
    onClose();
  };

  const openPdf = () => {
    const html = buildHtml(title, messages);
    const blob = new Blob([html], { type:"text/html;charset=utf-8" });
    const win  = window.open(URL.createObjectURL(blob), "_blank");
    if (win) setTimeout(() => win.print(), 800);
    onClose();
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildTxt(title, messages));
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {}
    onClose();
  };

  return (
    <div ref={ref} style={m.wrap}>
      <div style={m.label}>Exportar conversa</div>
      <button style={m.item} onClick={downloadTxt}>
        <TxtIcon /> <span>Baixar como .txt</span>
        {txtDone && <span style={m.check}>✓</span>}
      </button>
      <button style={m.item} onClick={openPdf}>
        <PdfIcon /> <span>Baixar como PDF</span>
      </button>
      <div style={m.sep}/>
      <button style={m.item} onClick={copyText}>
        <CopyIcon /> <span>{copied ? "Copiado!" : "Copiar texto"}</span>
        {copied && <span style={m.check}>✓</span>}
      </button>
    </div>
  );
}

const m = {
  wrap:  {
    position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:9999,
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,0.12)",
    minWidth:196, overflow:"hidden", padding:"4px 0",
  },
  label: {
    fontSize:9.5, fontWeight:800, color:"var(--text-muted)",
    textTransform:"uppercase", letterSpacing:"0.1em",
    padding:"8px 14px 5px",
  },
  item: {
    display:"flex", alignItems:"center", gap:9, width:"100%",
    padding:"8px 14px", background:"none", border:"none",
    fontSize:12.5, color:"var(--text-primary)", cursor:"pointer",
    fontFamily:"inherit", textAlign:"left",
    transition:"background .1s",
  },
  sep:   { height:1, background:"var(--border-subtle)", margin:"4px 0" },
  check: { marginLeft:"auto", fontSize:11, color:"var(--green)", fontWeight:700 },
};

/* ── Main component ──────────────────────────────────────────────── */
export default function ChatActions({ title, messages }) {
  const [open, setOpen] = useState(false);
  if (!messages || messages.length < 2) return null;

  return (
    <div style={s.wrap}>
      <button style={s.trigger} onClick={() => setOpen(o => !o)} title="Exportar conversa">
        <DotsIcon />
      </button>
      {open && <ActionsMenu title={title} messages={messages} onClose={() => setOpen(false)} />}
    </div>
  );
}

const s = {
  wrap:    { position:"relative" },
  trigger: {
    display:"flex", alignItems:"center", justifyContent:"center",
    width:30, height:30,
    background:"none", border:"1px solid var(--border)",
    borderRadius:8, cursor:"pointer",
    color:"var(--text-secondary)",
    transition:"background .12s, border-color .12s",
  },
};

/* ── Icons ───────────────────────────────────────────────────────── */
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="5"  r="1.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
  </svg>
);
const TxtIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8"/>
    <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="8" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const PdfIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3zm0 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
);
