````md
# Retail Insights

<p align="center">

# AI-Powered Retail Analytics Copilot

Built for the **Linx Applied AI Product Specialist Challenge**

Transform natural language questions into executive insights using **Claude + FastAPI + React + SQLite**.

<br>

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-orange)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)

</p>

---

# 🚀 Live Demo

### Web application

> **https://retail-copilot-five.vercel.app/**

No installation required.

Simply open the link and start asking questions in Portuguese.

### Example questions

- Qual loja teve o maior faturamento?
- Quais categorias mais venderam em 2024?
- Qual foi o ticket médio por pedido?
- Faça um resumo executivo do período
- Gere um briefing para o CEO

---

# ✨ Overview

Retail Insights allows business users to explore retail sales data conversationally.

The system:

- Converts questions into SQL using Claude
- Executes queries against SQLite
- Applies SQL guardrails
- Returns executive answers in Portuguese
- Generates KPI cards and ranking tables
- Produces deterministic CEO briefings

---

# 🎯 Features

## Conversational analytics

Ask questions in natural language.

---

## Executive briefing

Deterministic CEO summary built without LLM hallucinations.

---

## KPI cards

Visual comparison between 2023 and 2024.

---

## Ranking tables

Top products, categories and stores.

---

## SQL transparency

Expandable section showing how every answer was calculated.

---

## Conversation management

- Rename conversations
- Pin conversations
- Delete conversations

---

## Export

- TXT
- PDF
- Copy to clipboard

---

# 🏗 Architecture

```text
                React + Vite
                       │
                       ▼
                  FastAPI API
                       │
                       ▼
               Claude Sonnet 4.6
                       │
                       ▼
                 SQL Guardrails
                       │
                       ▼
                     SQLite
````

---

# ⚙ Tech Stack

| Layer      | Technology        |
| ---------- | ----------------- |
| Frontend   | React + Vite      |
| Backend    | FastAPI           |
| LLM        | Claude Sonnet 4.6 |
| Database   | SQLite            |
| Markdown   | react-markdown    |
| Styling    | CSS               |
| Deployment | Vercel + Render   |

---

# 📊 Dataset

| Metric     |     Value |
| ---------- | --------: |
| Rows       |    90,559 |
| Stores     |         5 |
| Categories |         5 |
| Products   |     1,768 |
| Customers  |    18,635 |
| Period     | 2023–2024 |

---

# 🧠 Design Decisions

## Split prompts

Two independent prompts:

1. SQL generation
2. Executive answer generation

This separation improves maintainability and reduces hallucinations.

---

## Parallel execution

SQL generation and title generation run simultaneously using ThreadPoolExecutor.

This saves approximately **600–900 ms** per request.

---

## SQL guardrails

Only SELECT statements are allowed.

Blocked operations:

* INSERT
* UPDATE
* DELETE
* DROP

---

## Deterministic CEO briefing

The **Briefing CEO** feature bypasses the LLM and executes predefined SQLite queries directly.

This guarantees consistency and eliminates hallucinations.

---

# ✅ Validation

Six mandatory questions are automatically tested.

```bash
cd backend

python test_eval.py
```

Expected result:

```text
6/6 tests passed
```

---

# 📂 Project Structure

```text
retail-insights
│
├── backend
│   ├── main.py
│   ├── llm.py
│   ├── database.py
│   ├── guardrails.py
│   ├── prompt.py
│   ├── test_eval.py
│   ├── requirements.txt
│   └── vendas.db
│
└── frontend
    ├── src
    ├── components
    ├── package.json
    └── vite.config.js
```

---

# 🔧 Running Locally

## Backend

```bash
cd backend

python -m venv .venv

pip install -r requirements.txt

uvicorn main:app --reload
```

---

## Frontend

```bash
cd frontend

npm install

npm run dev
```

---

# 🔐 Environment Variables

| Variable          | Required |
| ----------------- | -------- |
| ANTHROPIC_API_KEY | ✅        |

---

# 📈 Future Improvements

* Streaming responses
* Query cache
* Interactive charts
* CI evaluation suite
* Persistent conversations
* Multi-tenant support
* Upload custom databases

---

# 👩‍💻 Author

### Evelyn Cleto

Built for the **Linx Applied AI Product Specialist Challenge**.

---

## ⭐ Try it

### https://retail-copilot-five.vercel.app/

If you found this project interesting, feel free to give it a ⭐.

```
```
