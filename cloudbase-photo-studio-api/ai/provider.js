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
      Math.max(Number(process.env.AI_TIMEOUT_MS) || 6000, 2000),
      7000
    ),
    maxTokens: Math.min(
      Math.max(Number(process.env.AI_MAX_TOKENS) || 240, 120),
      320
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
  const choice = data && Array.isArray(data.choices) ? data.choices[0] : null;
  const message = choice && choice.message ? choice.message : {};
  const content = message.content || (choice && choice.text) || data.output_text;

  if (content && typeof content === "object" && !Array.isArray(content)) {
    return asString(content.text || content.value || content.content);
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        return asString(part && (part.text || part.value || part.content));
      })
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

function decodeJsonString(value) {
  try {
    return asString(JSON.parse(`"${value}"`));
  } catch {
    return asString(value)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }
}

function extractStringField(text, field) {
  const pattern = new RegExp(
    `"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`
  );
  const match = asString(text).match(pattern);
  return match ? decodeJsonString(match[1]).slice(0, 500) : "";
}

function extractObjectField(text, field) {
  const source = asString(text);
  const marker = `"${field}"`;
  const start = source.indexOf(marker);

  if (start < 0) {
    return null;
  }

  const objectStart = source.indexOf("{", start + marker.length);

  if (objectStart < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = objectStart; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(objectStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function recoverStructuredReply(text) {
  const reply = extractStringField(text, "reply");

  if (!reply) {
    return null;
  }

  return {
    text: reply,
    structured: true,
    recovered: true,
    intent: extractStringField(text, "intent") || "other",
    leadStage: extractStringField(text, "leadStage") || "none",
    lead: cleanLead(
      extractObjectField(text, "lead") ||
      extractObjectField(text, "leadInfo")
    ),
    followUpQuestion: extractStringField(text, "followUpQuestion")
  };
}

function looksLikeStructuredPayload(text) {
  return /["'](?:reply|intent|leadStage|lead|followUpQuestion)["']\s*:/.test(
    asString(text)
  );
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
  const recovered = parsed ? null : recoverStructuredReply(text);
  const source = parsed || recovered;
  const reply = asString(source && source.reply) || asString(source && source.text);
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
      structured: Boolean(parsed || recovered),
      recovered: Boolean(recovered),
      intent: intents.has(asString(source.intent)) ? source.intent : "other",
      leadStage: stages.has(asString(source.leadStage)) ? source.leadStage : "none",
      lead: cleanLead(source.lead),
      followUpQuestion: asString(source.followUpQuestion).slice(0, 240)
    };
  }

  const plainText = asString(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (/^\s*[{[]/.test(plainText) || looksLikeStructuredPayload(plainText)) {
    return null;
  }

  return plainText
    ? {
      text: plainText,
      structured: false,
      recovered: false,
      intent: "other",
      leadStage: "none",
      lead: cleanLead(null),
      followUpQuestion: ""
    }
    : null;
}

async function generateReply({ message, history, faqs, packages, serviceType }) {
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
        messages: buildMessages({
          message,
          history,
          faqs,
          packages,
          serviceType
        }),
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
