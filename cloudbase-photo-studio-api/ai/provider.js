const { buildMessages } = require("./prompt");

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(asString(value).toLowerCase());
}

function getConfig() {
  return {
    enabled: isEnabled(process.env.AI_ENABLED),
    provider: asString(process.env.AI_PROVIDER) || "volcengine",
    apiKey: asString(process.env.ARK_API_KEY || process.env.AI_API_KEY),
    model: asString(process.env.ARK_MODEL || process.env.AI_MODEL),
    baseUrl: asString(
      process.env.ARK_BASE_URL ||
        process.env.AI_BASE_URL ||
        "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    ),
    timeoutMs: Math.min(
      Math.max(Number(process.env.AI_TIMEOUT_MS) || 8000, 2000),
      20000
    ),
    maxTokens: Math.min(
      Math.max(Number(process.env.AI_MAX_TOKENS) || 450, 120),
      800
    )
  };
}

function getAvailability() {
  const config = getConfig();
  return {
    enabled: config.enabled,
    provider: config.provider,
    configured: Boolean(config.enabled && config.apiKey && config.model)
  };
}

function extractText(data) {
  const content = data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === "string" ? part : asString(part && part.text))
      .filter(Boolean)
      .join("");
  }

  return asString(content);
}

function parseJsonObject(text) {
  const trimmed = asString(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function cleanLead(value) {
  const source = value && typeof value === "object" ? value : {};
  const fields = ["serviceType", "budget", "preferredDate", "name", "contact"];

  return fields.reduce((lead, field) => {
    lead[field] = asString(source[field]).slice(0, 120);
    return lead;
  }, {});
}

function parseReply(text) {
  const parsed = parseJsonObject(text);
  const reply = asString(parsed && parsed.reply);
  const intents = new Set([
    "wedding_photo",
    "travel_photo",
    "family_photo",
    "dress_rental",
    "package_consultation",
    "price_consultation",
    "booking",
    "delivery",
    "store_info",
    "other"
  ]);
  const stages = new Set(["none", "exploring", "interested", "high_intent"]);

  if (reply) {
    return {
      text: reply,
      structured: true,
      intent: intents.has(asString(parsed.intent)) ? parsed.intent : "other",
      leadStage: stages.has(asString(parsed.leadStage)) ? parsed.leadStage : "none",
      lead: cleanLead(parsed.lead),
      followUpQuestion: asString(parsed.followUpQuestion).slice(0, 240)
    };
  }

  const plainText = asString(text);

  return plainText
    ? {
      text: plainText,
      structured: false,
      intent: "other",
      leadStage: "none",
      lead: cleanLead(null),
      followUpQuestion: ""
    }
    : null;
}

async function generateReply({ message, history, faqs, packages }) {
  const config = getConfig();

  if (!config.enabled) {
    return null;
  }

  if (!config.apiKey || !config.model) {
    return {
      unavailable: true,
      reason: "AI provider is not configured"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages({ message, history, faqs, packages }),
        temperature: 0.35,
        max_tokens: config.maxTokens
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error && (data.error.message || data.error.code)
          ? data.error.message || data.error.code
          : `AI provider returned ${response.status}`
      );
    }

    const result = parseReply(extractText(data));

    if (!result || result.text === "NEED_HUMAN") {
      return {
        unavailable: true,
        reason: result ? "AI requested human review" : "AI returned an empty reply",
        latencyMs: Date.now() - startedAt
      };
    }

    return {
      ...result,
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      unavailable: true,
      reason: error.name === "AbortError" ? "AI request timed out" : "AI request failed",
      latencyMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  generateReply,
  getAvailability
};
