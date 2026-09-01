// Serverless function that proxies requests to the Google Gemini API.
// The real API key lives only here, as a Netlify environment variable
// (GEMINI_API_KEY) — it is never sent to the browser.
//
// This accepts the SAME request shape the frontend already sends
// (Anthropic-style messages), converts it to Gemini's format, and
// converts the Gemini response back to the shape the frontend expects
// — so index.html does not need to change at all.

const MODEL = "gemini-2.5-flash";

function toGeminiContents(messages) {
  return messages.map((m) => {
    const parts = [];
    const content = m.content;
    if (typeof content === "string") {
      parts.push({ text: content });
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "text") {
          parts.push({ text: block.text });
        } else if (block.type === "image") {
          parts.push({
            inlineData: {
              mimeType: block.source.media_type,
              data: block.source.data,
            },
          });
        }
      }
    }
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY environment variable");
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY is not set on this Netlify site" }) };
  }

  try {
    const { messages, max_tokens } = JSON.parse(event.body);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: toGeminiContents(messages),
          generationConfig: { maxOutputTokens: max_tokens || 1024 },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error", response.status, JSON.stringify(data));
      return { statusCode: response.status, body: JSON.stringify(data) };
    }

    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text || "").join("\n");

    // Return in the same shape the frontend already parses (Anthropic-style).
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: [{ type: "text", text }] }),
    };
  } catch (err) {
    console.error("Function crashed:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
