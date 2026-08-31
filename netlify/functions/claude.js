// Serverless function that proxies requests to the Anthropic API.
// The real API key lives only here, as a Netlify environment variable
// (ANTHROPIC_API_KEY) — it is never sent to the browser.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY environment variable");
    return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on this Netlify site" }) };
  }

  try {
    const { messages, max_tokens } = JSON.parse(event.body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: max_tokens || 1024,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error", response.status, JSON.stringify(data));
      return { statusCode: response.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("Function crashed:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
