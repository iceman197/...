const express = require("express");
const helmet = require("helmet");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "ICEMAN BOT SUPER LAB",
    provider: process.env.AI_PROVIDER || "gemini",
    configured: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY)
    },
    execution: "external sandbox API"
  });
});

function safeText(value, max = 12000) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages.slice(-20) : [];
    const prompt = messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: safeText(m.content, 8000)
    })).filter(m => m.content);
    if (!prompt.length) return res.status(400).json({ error: "Enter a message first." });

    const provider = safeText(req.body.provider || process.env.AI_PROVIDER || "gemini", 40).toLowerCase();
    let responseText = "";
    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return res.status(503).json({ error: "Gemini is not configured. Add GEMINI_API_KEY in Render Environment." });
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const contents = prompt.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents })
      });
      const data = await r.json();
      if (!r.ok) return res.status(502).json({ error: data.error?.message || "Gemini request failed." });
      responseText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("\n");
    } else if (provider === "openai" || provider === "custom") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return res.status(503).json({ error: "OpenAI-compatible API is not configured. Add OPENAI_API_KEY in Render Environment." });
      const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model, messages: prompt })
      });
      const data = await r.json();
      if (!r.ok) return res.status(502).json({ error: data.error?.message || "OpenAI-compatible request failed." });
      responseText = data.choices?.[0]?.message?.content || "";
    } else if (provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(503).json({ error: "Anthropic is not configured. Add ANTHROPIC_API_KEY in Render Environment." });
      const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
      const system = prompt.filter(m => m.role === "assistant").map(m => m.content).join("\n");
      const userMessages = prompt.filter(m => m.role === "user").map(m => ({ role: "user", content: m.content }));
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1800, system, messages: userMessages })
      });
      const data = await r.json();
      if (!r.ok) return res.status(502).json({ error: data.error?.message || "Anthropic request failed." });
      responseText = (data.content || []).map(p => p.text || "").join("\n");
    } else {
      return res.status(400).json({ error: "Unsupported provider. Choose Gemini, OpenAI-compatible, or Anthropic." });
    }
    res.json({ text: responseText || "The provider returned an empty response." });
  } catch (err) {
    console.error("AI request failed:", err.message);
    res.status(500).json({ error: "AI request failed. Check provider settings and server logs." });
  }
});

app.post("/api/execute", async (req, res) => {
  try {
    const language = safeText(req.body.language, 30).toLowerCase();
    const code = safeText(req.body.code, 20000);
    const allowed = new Set(["javascript", "typescript", "python", "c", "cpp", "java", "go", "rust", "php", "ruby"]);
    if (!allowed.has(language)) return res.status(400).json({ error: "Language not supported by this practice runner." });
    if (!code.trim()) return res.status(400).json({ error: "Write some code first." });
    const api = (process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston").replace(/\/+$/, "");
    const versions = { javascript: "18.15.0", typescript: "5.0.3", python: "3.10.0", c: "10.2.0", cpp: "10.2.0", java: "15.0.2", go: "1.16.2", rust: "1.68.2", php: "8.2.3", ruby: "3.0.1" };
    const names = { javascript: "javascript", typescript: "typescript", python: "python", c: "c", cpp: "c++", java: "java", go: "go", rust: "rust", php: "php", ruby: "ruby" };
    const r = await fetch(`${api}/execute`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: names[language], version: versions[language], files: [{ name: ({javascript:"main.js",typescript:"main.ts",python:"main.py",c:"main.c",cpp:"main.cpp",java:"Main.java",go:"main.go",rust:"main.rs",php:"main.php",ruby:"main.rb"})[language], content: code }], stdin: safeText(req.body.stdin, 4000) })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.message || "Execution service failed." });
    res.json({ output: data.run?.output || data.compile?.output || "", stderr: data.run?.stderr || data.compile?.stderr || "", code: data.run?.code ?? data.compile?.code ?? null });
  } catch (err) {
    console.error("Execution request failed:", err.message);
    res.status(502).json({ error: "The external code runner could not be reached." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`ICEMAN BOT SUPER LAB listening on ${PORT}`));
