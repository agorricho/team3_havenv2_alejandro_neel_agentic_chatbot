/**
 * Haven — v2 Multi-Prompt Routing Chat Backend
 * ==============================================
 * STAGED FILE: This is v2-chat.js — validate before renaming to chat.js.
 *
 * Architecture change from v1:
 *   v1: Single ~20K-token monolithic SYSTEM_PROMPT baked inline.
 *   v2: Lean core persona (~3K tokens) always loaded + topic classifier
 *       dynamically injects only the relevant KB module(s) (~3-6K tokens each).
 *       Total system prompt per request: ~6-12K tokens instead of ~20K+.
 *
 * Benefits:
 *   - Context window stays focused on the relevant subject matter
 *   - Prompt caching still works (core persona block is stable across turns)
 *   - Deeper answers because the model has more output headroom
 *   - Easier to update — edit one KB file, not the whole monolith
 *
 * v2.1 — Code Execution (server-side tool)
 *   - Adds Anthropic's code_execution server tool so Haven can run Python
 *     for any calculation, ROI projection, or financial math.
 *   - The API handles the sandbox lifecycle — no client-side tool_result
 *     round-trip needed. Claude decides when to execute code.
 *   - Streaming handler now emits {computing: true/false} SSE events
 *     so the frontend can show a progress indicator during execution.
 *
 * Deployment: Copy prompt files to /prompts/ in your Vercel repo root.
 *             Rename this file to api/chat.js to replace the original.
 */

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;
const MAX_TOKENS = 4096; // Bumped from 2048 for deeper responses
const MODEL = process.env.HAVEN_MODEL || "claude-sonnet-5-5";

// ---------------------------------------------------------------------------
// Prompt loading — read .md files from /prompts/ at cold-start, cache in memory
// ---------------------------------------------------------------------------
const PROMPTS_DIR = path.join(__dirname, "..", "prompts");

/** Read a prompt file and return its contents, or "" if missing. */
function loadPrompt(filename) {
  try {
    return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf-8");
  } catch {
    console.warn(`[Haven] Prompt file not found: ${filename}`);
    return "";
  }
}

// Core persona — always injected (stable, cacheable)
const CORE_PERSONA = loadPrompt("core-persona.md");

// Knowledge-base modules — injected on demand
const KB_MODULES = {
  market: loadPrompt("kb-market.md"),
  competitive: loadPrompt("kb-competitive.md"),
  architecture: loadPrompt("kb-architecture.md"),
  scenarios: loadPrompt("kb-scenarios.md"),
  readiness: loadPrompt("kb-readiness.md"),
  pilotTechstack: loadPrompt("kb-pilot-techstack.md"),
};

// ---------------------------------------------------------------------------
// Topic classifier — keyword-based routing
// ---------------------------------------------------------------------------

/** Keyword → module mapping. Order matters: first match wins per keyword. */
const TOPIC_RULES = [
  // Market opportunity & customer pain points
  {
    module: "market",
    keywords: [
      "market", "tam", "addressable", "opportunity", "pain point",
      "customer need", "spending", "furnishing spend", "wallet",
      "how big", "how large", "census", "movers", "moving",
      "birth", "divorce", "military", "pcs", "homebuyer",
      "first apartment", "empty nest", "downsiz", "life stage",
      "life event", "life transition", "unserved", "underserved",
      "wayfair revenue", "wayfair performance", "active customer",
      "aov", "average order", "customer base",
    ],
  },
  // Competitive landscape
  {
    module: "competitive",
    keywords: [
      "competitor", "competitive", "williams-sonoma", "wsm", "oliver",
      "otto", "ikea", "kreativ", "billie", "amazon", "alexa",
      "rufus", "pinterest", "restyle", "meta", "muse",
      "agentic commerce", "platform agent", "threat", "moat",
      "defensible", "differentiator", "gap", "versus", " vs ",
      "compare", "comparison", "how is haven different",
      "just a chatbot", "chatbot",
    ],
  },
  // Architecture, tech capabilities & return economics
  {
    module: "architecture",
    keywords: [
      "architecture", "technical", "tech stack", "capability",
      "how does it work", "how does haven work", "persistent memory",
      "rag", "retrieval", "tool use", "deterministic",
      "background monitor", "handoff", "escalation", "tier",
      "return", "reverse logistics", "return rate", "return cost",
      "return reduction", "fit check", "dimension", "room scan",
      "visualization", "ar", "3d",
      "revenue lift", "revenue uplift", "uplift", "capture",
      "development cost", "build cost", "how much does it cost",
      "investment", "payback",
    ],
  },
  // Customer scenarios & objection handling
  {
    module: "scenarios",
    keywords: [
      "scenario", "sarah", "martinez", "david", "okafor",
      "example", "walk me through", "show me how", "demonstrate",
      "use case", "real world", "customer story", "persona",
      "first apartment", "nursery", "baby", "divorce", "first home",
      "objection", "pushback", "concern", "skeptic", "why not",
      "risk", "what if", "challenge", "counter", "criticism",
      "expensive to build", "no one has done", "trust ai",
      "cannibaliz", "make money",
    ],
  },
  // AI readiness roadmap
  {
    module: "readiness",
    keywords: [
      "readiness", "ready", "ai ready", "capability gap",
      "data readiness", "infrastructure readiness", "talent",
      "governance", "ethics", "change management", "organizational",
      "think big", "start small", "scale fast", "step-wise",
      "pilot criteria", "success criteria", "kpi", "metric",
      "bias", "privacy", "consent", "explainab", "transparency",
      "regulation", "eu ai act", "compliance",
      "section 3", "roadmap",
    ],
  },
  // Pilot plan & AI tech stack
  {
    module: "pilotTechstack",
    keywords: [
      "pilot", "mvp", "minimum viable", "phase 1", "phase 2",
      "tech stack", "stack", "layer", "infrastructure layer",
      "data layer", "model layer", "application layer",
      "api gateway", "vector database", "vector db", "pinecone",
      "langchain", "embedding", "llm", "foundation model",
      "recommendation engine", "budget optimizer",
      "cost model", "monthly cost", "operating cost",
      "cleo", "updater", "headspace", "ebb", "precedent",
      "section 5", "deployment", "cloud", "aws",
    ],
  },
];

/**
 * Classify the user's latest message and return the set of KB modules to inject.
 * Returns 1–2 modules max to keep context focused. Always returns at least one
 * if any keyword matches; falls back to a general "highlights" injection if
 * nothing matches (so Haven is never empty-handed).
 */
function classifyTopic(userMessage) {
  const text = userMessage.toLowerCase();
  const scores = {};

  for (const rule of TOPIC_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > 0) scores[rule.module] = score;
  }

  // Sort by score descending
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    // No match — inject scenarios (most versatile) + market (broadest context)
    return ["scenarios", "market"];
  }

  if (ranked.length === 1) {
    return [ranked[0][0]];
  }

  // Top 2 modules — include second if it scored at least 1 AND
  // at least a third of the top score, to keep multi-topic questions covered
  const top = ranked[0];
  const second = ranked[1];
  if (second[1] >= 1 && second[1] >= top[1] * 0.33) {
    return [top[0], second[0]];
  }

  return [top[0]];
}

// ---------------------------------------------------------------------------
// System prompt assembly
// ---------------------------------------------------------------------------

/**
 * Build the system prompt array for the Anthropic API.
 * Block 1: Core persona (stable — benefits from prompt caching).
 * Block 2: Relevant KB module(s) (dynamic per request).
 */
function buildSystemPrompt(modules) {
  const kbText = modules
    .map((m) => KB_MODULES[m] || "")
    .filter(Boolean)
    .join("\n\n---\n\n");

  const routingNote =
    `\n\n---\n\n## ROUTING NOTE\n` +
    `The knowledge modules loaded for this query are: ${modules.join(", ")}. ` +
    `If the user asks about a topic not covered in the loaded modules, ` +
    `answer from your core knowledge and persona. Do not mention that ` +
    `modules are being loaded or selected — this is invisible to the user.`;

  return [
    {
      type: "text",
      text: CORE_PERSONA,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: kbText + routingNote,
    },
  ];
}

// ---------------------------------------------------------------------------
// Input sanitization — same as v1 (framework §3)
// ---------------------------------------------------------------------------
function sanitize(input) {
  if (!Array.isArray(input) || input.length === 0) return null;

  const recent = input.slice(-MAX_MESSAGES);

  // Must start with a user message
  while (recent.length && recent[0]?.role !== "user") recent.shift();

  const out = [];
  for (const m of recent) {
    if (
      !m ||
      !["user", "assistant"].includes(m.role) ||
      typeof m.content !== "string"
    ) {
      return null;
    }
    const content = m.content.slice(0, MAX_CHARS).trim();
    if (content) out.push({ role: m.role, content });
  }

  // Must end with a user message
  if (!out.length || out[out.length - 1].role !== "user") return null;

  return out;
}

// ---------------------------------------------------------------------------
// Friendly error messages (framework §3, error table)
// ---------------------------------------------------------------------------
function friendlyError(status, detail) {
  if (status === 429 && detail.includes("enforced_spend_limit_reached"))
    return "The demo's usage budget has been reached. Please contact the team.";
  if (status === 400 && /usage limit/i.test(detail))
    return "The demo's usage budget has been reached. Please contact the team.";
  if (status === 429)
    return "Haven is handling a lot of questions right now. Please try again in about 30 seconds.";
  if (status === 529 || status >= 500)
    return "Claude is temporarily busy. Please resend your message.";
  return "Haven is temporarily unavailable. Please try again shortly.";
}

// ---------------------------------------------------------------------------
// Vercel serverless handler
// ---------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Haven is not configured yet." });
  }

  // Sanitize input messages
  const messages = sanitize(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "Invalid conversation format." });
  }

  // --- MULTI-PROMPT ROUTING ---
  // Extract the latest user message for topic classification
  const latestUserMsg = messages[messages.length - 1].content;
  const selectedModules = classifyTopic(latestUserMsg);

  // Build dynamic system prompt
  const systemBlocks = buildSystemPrompt(selectedModules);

  // Set up SSE streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const anthropic = new Anthropic({ apiKey });

    const requestParams = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemBlocks,
      messages: messages,
      // --- CODE EXECUTION (server-side tool) ---
      // Anthropic runs Python in a sandboxed container. No client-side
      // tool_result loop needed — the API handles execution internally.
      // Haven uses this for all financial math, ROI projections, and
      // impact-matrix scoring so every number is deterministic.
      tools: [
        {
          type: "code_execution_20250825",
          name: "code_execution",
        },
      ],
    };

    // Sonnet 5.5 thinking config: between_tools with medium effort
    // for snappier chat latency (framework §2, §3)
    if (MODEL === "claude-sonnet-5-5") {
      requestParams.thinking = { type: "between_tools" };
      requestParams.output_config = { effort: "medium" };
    }

    const stream = anthropic.messages.stream(requestParams);

    // Track computing state so we can signal the frontend
    let isComputing = false;

    for await (const event of stream) {
      // --- Text deltas: forward to frontend as before ---
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        // If we were in computing state, signal exit before sending text
        if (isComputing) {
          res.write(
            `data: ${JSON.stringify({ computing: false })}\n\n`
          );
          isComputing = false;
        }
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }

      // --- Server tool use: signal computing start ---
      if (
        event.type === "content_block_start" &&
        event.content_block?.type === "server_tool_use"
      ) {
        if (!isComputing) {
          isComputing = true;
          res.write(
            `data: ${JSON.stringify({ computing: true })}\n\n`
          );
        }
      }

      // --- Errors ---
      if (event.type === "error") {
        console.error("Mid-stream Anthropic error:", event.error);
        res.write(
          `data: ${JSON.stringify({ error: "An error occurred. Please try again." })}\n\n`
        );
      }
    }

    // Ensure computing state is cleared before DONE
    if (isComputing) {
      res.write(`data: ${JSON.stringify({ computing: false })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Anthropic API error:", error);

    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ error: "An error occurred. Please try again." })}\n\n`
      );
      res.end();
    } else {
      const status = error?.status || 500;
      const detail = error?.message || "";
      const msg = friendlyError(status, detail);
      res.status(status === 429 ? 429 : 503).json({ error: msg });
    }
  }
};
