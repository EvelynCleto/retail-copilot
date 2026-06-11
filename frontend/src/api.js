const BASE_URL = "http://localhost:8000";

export async function sendMessage(message, history = [], generateTitle = false) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, generate_title: generateTitle }),
  });
  if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);
  return response.json();
}