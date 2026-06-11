# Retail Insights

**Copiloto executivo de análise de vendas no varejo**, desenvolvido para a Linx como resposta ao desafio Applied AI Product Specialist.

O sistema recebe perguntas em português, gera SQL via LLM, executa no banco SQLite e devolve respostas executivas estruturadas — com tabelas, cards de KPI e insights visuais.

---

## Demo rápido

```
Você:  Qual loja teve o maior faturamento?

RI:    Loja A
       R$ 45.383.244,35
       Representa 30,8% da receita total do período.
```

```
Você:  Quais as 5 categorias que mais venderam em 2023?

RI:    🥇 CALÇA   — R$ 25.210.215,10 · 33,9%
       🥈 VESTIDO — R$ 17.178.522,10 · 23,1%
       🥉 CASACO  — R$ 13.248.183,30 · 17,8%
       4. CAMISA  — R$  9.701.588,80 · 13,0%
       5. SAIA    — R$  9.003.417,49 · 12,1%
```

---

## Pré-requisitos

| Requisito | Versão mínima |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| Chave Anthropic | [console.anthropic.com](https://console.anthropic.com) |

---

## Instalação e execução

### 1 · Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edite .env e adicione: ANTHROPIC_API_KEY=sk-ant-...

uvicorn main:app --reload
# → http://localhost:8000
```

### 2 · Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Abra **http://localhost:5173** no navegador.

---

## Validação automática — 6 perguntas obrigatórias

Com o backend rodando:

```bash
cd backend
python test_eval.py
```

Resultado esperado: **6/6 perguntas aprovadas**.

As 6 perguntas validadas e seus valores esperados:

| # | Pergunta | Valor esperado |
|---|---|---|
| Q1 | Receita total em 2024 | R$ 73.067.913,20 |
| Q2 | Top 5 categorias em 2023 | CALÇA, VESTIDO, CASACO, CAMISA, SAIA |
| Q3 | Comparativo 2023 × 2024 | R$ 74.341.926,79 → R$ 73.067.913,20 (-1,7%) |
| Q4 | Loja com maior faturamento | Loja A — R$ 45.383.244,35 |
| Q5 | Unidades vendidas por mês em 2024 | 12 linhas, total 43.368 unidades |
| Q6 | Ticket médio por pedido | R$ 2.961,58 |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                          Navegador                              │
│                                                                 │
│   React + Vite                                                  │
│   ConversationSidebar · MessageBubble · RankingTable            │
│   KpiCards · ChatActions · SqlBlock                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP POST /chat
┌───────────────────────────▼─────────────────────────────────────┐
│                      FastAPI (Python)                           │
│                                                                 │
│   main.py ─── split_questions() ─── CEO determinístico         │
│      │                                                          │
│      ├── llm.py ── generate_sql()  ──┐  paralelo               │
│      │            rewrite_question() ─┘  ThreadPoolExecutor    │
│      │                                                          │
│      ├── guardrails.py ── validate_sql() (SELECT-only)         │
│      ├── database.py ─── execute_query() (SQLite)              │
│      └── llm.py ────── generate_answer()                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     vendas.db (SQLite)                          │
│   90.559 linhas · 5 lojas · 5 categorias · 1.768 produtos      │
│   18.635 clientes · período: 2023-01-02 a 2024-12-31            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack técnica

| Camada | Tecnologia | Versão | Decisão |
|---|---|---|---|
| Backend | Python + FastAPI | 3.11 / 0.115 | `sqlite3` nativo, async, setup mínimo |
| LLM | Claude Sonnet 4.6 (Anthropic) | `claude-sonnet-4-6` | Melhor precisão SQL + custo em português |
| Banco | SQLite (`vendas.db`) | — | Sem servidor, leitura direta, 90k linhas |
| Frontend | React + Vite | 19 / 8 | Sem framework pesado, componentes focados |
| Markdown | react-markdown + remark-gfm | — | Renderização de tabelas e listas da IA |

---

## Decisões de design

### Dois prompts LLM separados

O primeiro prompt tem responsabilidade única: **gerar SQL válido**. O segundo tem outra: **verbalizar a resposta em português executivo**. Misturar os dois aumenta a taxa de erro e dificulta manutenção.

```
Pergunta → [SQL Prompt] → SQL → banco → rows → [Answer Prompt] → resposta
```

### SQL e reformulação em paralelo

`generate_sql_and_rewrite_parallel()` usa `ThreadPoolExecutor(max_workers=2)` para rodar geração de SQL e reformulação de título em paralelo. Economia de ~600–900ms por request.

### Guardrail antes de executar

Todo SQL gerado passa por validação antes de tocar o banco:
- Deve começar com `SELECT`
- Sem palavras-chave de escrita (`INSERT`, `UPDATE`, `DELETE`, `DROP`, etc.)
- Sem múltiplos statements

### CEO determinístico

O botão "Briefing CEO" nunca passa pelo LLM. Executa 17 queries SQLite fixas e monta o briefing com Python puro — zero chance de falha ou alucinação.

### Schema + exemplos concretos no prompt SQL

O `SYSTEM_PROMPT_SQL` inclui:
- Schema completo com tipos e valores possíveis
- Mapeamento linguagem → SQL (ex: "qual loja liderou" → `GROUP BY loja ... LIMIT 1`)
- Os dois erros mais comuns documentados explicitamente: `SUM(receita * quantidade)` (errado) e `AVG(receita)` para ticket médio (errado)
- Aliases obrigatórios para evitar nomes inventados pelo LLM
- SQL correto para cada uma das 6 perguntas com o resultado esperado como comentário

### Resposta da pergunta original preservada

A reformulação da pergunta via LLM é usada **apenas** para o título automático da conversa na sidebar. A bolha do usuário sempre exibe o texto exatamente como digitado.

---

## Funcionalidades do produto

| Funcionalidade | Descrição |
|---|---|
| **Chat conversacional** | Contexto de múltiplas trocas, memória dentro da sessão |
| **Sidebar de histórico** | Conversas nomeadas automaticamente, fixar, renomear, excluir |
| **Tabelas de ranking** | Medalhas 🥇🥈🥉, barras de proporção, totalizador, zebra striping |
| **Cards de KPI** | Comparativo 2023 × 2024 com sparkline e delta badge |
| **Briefing CEO** | Resumo executivo determinístico, nunca falha |
| **Exportar conversa** | Download `.txt`, `.pdf` (layout profissional), copiar texto |
| **Ver SQL** | Expansão discreta de como cada resposta foi calculada |
| **Sugestões contextuais** | Chips baseados no tópico atual da conversa |
| **Identidade Linx** | Design system com laranja `#F5691E` e dark sidebar `#0E1117` |

---

## Estrutura do projeto

```
retail-insights/
│
├── backend/
│   ├── main.py           # FastAPI, endpoint POST /chat, CEO determinístico
│   ├── llm.py            # Claude API: SQL, answer, title, rewrite (paralelo)
│   ├── database.py       # SQLite executor
│   ├── guardrails.py     # Validação SELECT-only
│   ├── prompt.py         # SYSTEM_PROMPT_SQL + SYSTEM_PROMPT_ANSWER + DISPLAY_MAP
│   ├── test_eval.py      # Validação das 6 perguntas obrigatórias
│   ├── requirements.txt
│   ├── .env.example
│   └── vendas.db         # SQLite — 90.559 linhas, 2023–2024
│
└── frontend/
    ├── src/
    │   ├── App.jsx                    # Orquestrador: estado, conversas, send
    │   ├── api.js                     # fetch POST /chat
    │   ├── index.css                  # Design system (CSS vars Linx)
    │   ├── main.jsx
    │   └── components/
    │       ├── ConversationSidebar.jsx  # Sidebar com menu hover (renomear/fixar/excluir)
    │       ├── MessageBubble.jsx        # Renderização de mensagens com Markdown
    │       ├── RankingTable.jsx         # Tabela premium: medalhas, barras, totalizador
    │       ├── KpiCards.jsx             # Cards 2023×2024 com sparkline
    │       ├── ChatActions.jsx          # Menu ⋯: exportar TXT/PDF, copiar
    │       └── SqlBlock.jsx             # "Como foi calculado" expansível
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Chave da API Anthropic |

---

## O que evoluiria com mais tempo

- **Streaming** das respostas para UX mais responsiva (Claude suporta via SSE)
- **Cache de queries** idênticas para reduzir latência e custo de API
- **Gráficos interativos** automáticos para séries temporais (Recharts/Chart.js)
- **Eval em CI** usando as 6 perguntas como suite de testes automatizada
- **Persistência de histórico** no backend (hoje é só memória de sessão no frontend)
- **Multi-tenant** para múltiplos varejistas com seus próprios bancos
- **Upload de arquivo** para permitir análise de qualquer `vendas.db`
