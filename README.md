<div align="center">

<img src="https://img.shields.io/badge/Linx-F5691E?style=flat&logoColor=white" alt="Linx"/>
<img src="https://img.shields.io/badge/Claude_Sonnet_4.6-8A2BE2?style=flat&logoColor=white" alt="Claude"/>
<img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI"/>
<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black" alt="React"/>
<img src="https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white" alt="SQLite"/>

# Retail Insights

**Copiloto executivo de análise de vendas no varejo**

Faça qualquer pergunta em português e receba respostas precisas com dados reais — tabelas, KPIs e análises estratégicas geradas em segundos.

[▶ Ver demo em vídeo](https://drive.google.com/file/d/18fyTsnBbzrt9c9gpdxqASp2-ZeGxcO0U/view?usp=sharing) · [🚀 Acessar o sistema](https://retail-copilot-five.vercel.app/)

</div>

---

## O que é

Retail Insights é um chatbot **text-to-SQL com camada analítica** desenvolvido para o desafio Applied AI Product Specialist da Linx. O sistema vai além de queries simples: ele detecta a intenção da pergunta e escolhe o caminho certo — dados do banco, análise executiva ou briefing determinístico.

```
Você → "Qual loja teve o maior faturamento?"

RI   → Loja A
        R$ 45.383.244,35
        Representa 30,8% da receita total do período.
```

```
Você → "Há concentração excessiva em alguma loja?"

RI   → Sim. A operação está concentrada.
        Loja A responde por 30,8% da receita total (R$ 45,4 mi).
        Loja A + Loja B = 57,5% do faturamento.
        O nível de dependência é alto para uma rede de 5 unidades.
```

---

## Demo

| | |
|---|---|
| 🎥 **Vídeo de demonstração** | [Assistir no Google Drive](https://drive.google.com/file/d/18fyTsnBbzrt9c9gpdxqASp2-ZeGxcO0U/view?usp=sharing) |
| 🌐 **Sistema em produção** | [retail-copilot-five.vercel.app](https://retail-copilot-five.vercel.app/) |

---

## Validação — 6 perguntas obrigatórias

Todos os valores batem com o dicionário de dados do desafio.

| # | Pergunta | Valor esperado | Status |
|---|---|---|---|
| Q1 | Receita total em 2024 | R$ 73.067.913,20 | ✅ |
| Q2 | Top 5 categorias em 2023 | CALÇA · VESTIDO · CASACO · CAMISA · SAIA | ✅ |
| Q3 | Comparativo 2023 × 2024 | R$ 74.341.926,79 → R$ 73.067.913,20 (−1,7%) | ✅ |
| Q4 | Loja com maior faturamento | Loja A — R$ 45.383.244,35 | ✅ |
| Q5 | Unidades vendidas por mês em 2024 | 12 linhas · total 43.368 unidades | ✅ |
| Q6 | Ticket médio por pedido | R$ 2.961,58 | ✅ |

```bash
cd backend && python test_eval.py
# Resultado esperado: 6/6 perguntas aprovadas
```

---

## Arquitetura — 3 caminhos para responder

A decisão central de design foi separar a intenção da pergunta antes de processar.

```
Pergunta do usuário
       │
       ▼
 Detector de intenção
       │
   ┌───┴──────────────────┐
   │                      │                      │
   ▼                      ▼                      ▼
CEO determinístico   Análise estratégica    Pipeline SQL
17 queries fixas     Dados hardcoded        LLM → SQL
Zero LLM             + LLM raciocina        → banco
Zero alucinação      Julgamento executivo   → resposta
```

**Por quê?** "Qual a receita de 2024" e "há riscos no negócio" parecem perguntas similares, mas são fundamentalmente diferentes. A primeira tem resposta objetiva no banco. A segunda precisa de julgamento. Forçar tudo pelo mesmo pipeline produzia respostas mecânicas para perguntas que pediam análise.

```
┌─────────────────────────────────────────────────────────┐
│  Navegador — React 19 + Vite 8                          │
│  ConversationSidebar · MessageBubble · RankingTable      │
│  KpiCards · ChatActions · SqlBlock                      │
└───────────────────────────┬─────────────────────────────┘
                            │ SSE (streaming)
┌───────────────────────────▼─────────────────────────────┐
│  FastAPI — Python 3.11                                  │
│                                                         │
│  main.py → detector de intenção                         │
│    ├── CEO determinístico (17 queries fixas)            │
│    ├── Análise estratégica (SYSTEM_PROMPT_STRATEGIC)    │
│    └── Pipeline SQL                                     │
│         ├── llm.py → generate_sql() + rewrite()        │
│         │           ThreadPoolExecutor (paralelo)       │
│         ├── guardrails.py → validate_sql()             │
│         ├── database.py → execute_query()              │
│         └── llm.py → generate_answer() [streaming]    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  vendas.db (SQLite)                                     │
│  90.559 linhas · 5 lojas · 5 categorias · 1.768 produtos│
│  18.635 clientes · 2023-01-02 a 2024-12-31             │
└─────────────────────────────────────────────────────────┘
```

---

## Stack

| Camada | Tecnologia | Decisão |
|---|---|---|
| Backend | Python 3.11 + FastAPI | `sqlite3` nativo, `StreamingResponse` para SSE |
| LLM | Claude Sonnet 4.6 | Melhor precisão em SQL + português com custo controlado |
| Banco | SQLite (`vendas.db`) | Sem servidor, leitura direta, 90k linhas |
| Frontend | React 19 + Vite 8 | Setup mínimo, componentes focados |
| Deploy | Render (backend) + Vercel (frontend) | Free tier, CI/CD automático via git |

---

## Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| Chat conversacional | Contexto de múltiplas trocas, memória dentro da sessão |
| Streaming em tempo real | Tokens aparecem conforme são gerados, cursor piscando |
| Análise de CEO | Responde perguntas estratégicas com dados reais e julgamento |
| Briefing executivo | Relatório completo gerado de forma determinística, sem LLM |
| Tabelas premium | Medalhas 🥇🥈🥉, barras de proporção, zebra striping |
| Cards de KPI | Comparativo 2023 × 2024 com sparkline e variação |
| Guardrail de segurança | Bloqueia INSERT/UPDATE/DELETE antes de chegar ao banco |
| Exportar conversa | Download `.txt`, `.pdf` profissional, copiar texto |
| Ver SQL | Expansão discreta de como cada número foi calculado |
| Sugestões contextuais | Chips baseados no tópico atual da conversa |
| Identidade Linx | Design system `#F5691E` com dark sidebar `#0E1117` |

---

## Instalação local

### Pré-requisitos

```
Python 3.11+   Node.js 18+   Chave Anthropic API
```

### 1 · Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Adicione: ANTHROPIC_API_KEY=sk-ant-...

uvicorn main:app --reload
# → http://localhost:8000
```

### 2 · Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Chave da API Anthropic |
| `VITE_API_URL` | Produção | URL do backend (ex: `https://retail-copilot-api.onrender.com`) |

---

## Decisões de design

### Guardrail antes de executar o SQL

Todo SQL gerado pelo LLM passa por validação Python antes de tocar o banco — deve começar com `SELECT`, sem palavras de escrita, sem múltiplos statements. Em vez de confiar que o modelo sempre gera SQL seguro, o sistema garante isso no código.

### Dois prompts LLM com responsabilidade única

O primeiro gera SQL. O segundo verbaliza a resposta. Misturar os dois aumenta a taxa de erro: o LLM fica dividido entre "gerar SQL correto" e "soar natural em português". Com prompts separados, cada um é especialista no que faz.

### SQL e reformulação em paralelo

`generate_sql_and_rewrite_parallel()` usa `ThreadPoolExecutor(max_workers=2)`. Sonnet gera o SQL enquanto Haiku reformula o título da conversa — economia de ~600–900ms por request.

### Contexto estratégico hardcoded

As perguntas de CEO (riscos, oportunidades, concentração) não usam o banco — usam um bloco de dados reais embutido no `SYSTEM_PROMPT_STRATEGIC`. O LLM raciocina sobre fatos exatos, sem risco de query errada ou dado inventado.

---

## Estrutura do projeto

```
retail-insights/
├── backend/
│   ├── main.py           # FastAPI, SSE streaming, detector de intenção
│   ├── llm.py            # Claude API: SQL, answer, title, rewrite
│   ├── database.py       # SQLite executor
│   ├── guardrails.py     # Validação SELECT-only
│   ├── prompt.py         # System prompts + contexto estratégico
│   ├── test_eval.py      # Validação das 6 perguntas obrigatórias
│   ├── requirements.txt
│   ├── .env.example
│   └── vendas.db         # SQLite — 90.559 linhas, 2023–2024
│
└── frontend/
    ├── src/
    │   ├── App.jsx                    # Estado, conversas, streaming
    │   ├── api.js                     # SSE consumer
    │   ├── index.css                  # Design system Linx
    │   └── components/
    │       ├── ConversationSidebar.jsx
    │       ├── MessageBubble.jsx
    │       ├── RankingTable.jsx
    │       ├── KpiCards.jsx
    │       ├── ChatActions.jsx
    │       └── SqlBlock.jsx
    ├── package.json
    └── vite.config.js
```

---

## O que evoluiria com mais tempo

- **Gráficos automáticos** para séries temporais — um gráfico de linha mostra sazonalidade em segundos, muito mais impactante do que 12 linhas de tabela
- **Memória de conversa persistente** — hoje o contexto é comprimido a cada troca; com persistência real o copiloto lembraria o que você estava investigando
- **Multi-tenant** — cada varejista com seu próprio banco, sem alterar código
- **Eval em CI** — as 6 perguntas rodam a cada push para garantir regressão zero

---

<div align="center">

Desenvolvido por **Evelyn Cleto** para o desafio Applied AI Product Specialist — Linx

</div>