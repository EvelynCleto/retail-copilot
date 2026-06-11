const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://retail-copilot-api.onrender.com");

export async function sendMessage(
  message,
  history = [],
  generateTitle = false
) {
  try {
    const response = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
        generate_title: generateTitle,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Erro ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    throw error;
  }
}