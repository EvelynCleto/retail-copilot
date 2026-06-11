// Em produção usa a URL do Render; em desenvolvimento usa localhost
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * sendMessage — consome o endpoint SSE do backend.
 *
 * Eventos recebidos:
 *   { type: "status", text: "..." }  → status intermediário (ex: "Consultando banco...")
 *   { type: "token",  text: "..." }  → fragmento de texto da resposta em tempo real
 *   { type: "done",   ...payload }   → resposta completa + metadados (sql, table, kpis...)
 *
 * Callbacks:
 *   onStatus(text)   → chamado a cada evento de status
 *   onToken(text)    → chamado a cada token recebido (para streaming na UI)
 */
export async function sendMessage(
  message,
  history = [],
  generateTitle = false,
  { onStatus, onToken } = {}
) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, generate_title: generateTitle }),
  });

  if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // linha incompleta fica para a próxima iteração

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));

        if (event.type === "status" && onStatus) {
          onStatus(event.text);

        } else if (event.type === "token" && onToken) {
          onToken(event.text);

        } else if (event.type === "done") {
          return event; // payload final com answer, sql, table, kpis...
        }
      } catch {
        // ignorar linhas malformadas
      }
    }
  }

  throw new Error("Stream encerrado sem evento 'done'.");
}