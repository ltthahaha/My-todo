const { buildMessages } = require("./prompt");

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(asString(value).toLowerCase());
}

function isRawResponseDebugEnabled() {
  return isEnabled(process.env.AI_DEBUG_RAW_RESPONSE);
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
      Math.max(Number(process.env.AI_MAX_TOKENS) || 200, 120),
      260
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

function extractTextValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map(extractTextValue)
      .filter(Boolean)
      .join("");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  return (
    extractTextValue(value.text) ||
    extractTextValue(value.value) ||
    extractTextValue(value.content) ||
    extractTextValue(value.output_text) ||
    extractTextValue(value.answer) ||
    extractTextValue(value.reply) ||
    extractTextValue(value.message) ||
    extractTextValue(value.delta) ||
    extractTextValue(value.choices) ||
    extractTextValue(value.data) ||
    extractTextValue(value.result) ||
    extractTextValue(value.output)
  );
}

function extractStreamText(value) {
  if (typeof value !== "string" || !/\ndata\s*:/i.test(`\n${value}`)) {
    return "";
  }

  return value
    .split(/\r?\n/)
    .filter((line) => /^\s*data\s*:/i.test(line))
    .map((line) => line.replace(/^\s*data\s*:\s*/i, "").trim())
    .filter((chunk) => chunk && chunk !== "[DONE]")
    .map((chunk) => extractText(parseResponseBody(chunk)))
    .filter(Boolean)
    .join("");
}

function extractText(data) {
  if (typeof data === "string") {
    return extractStreamText(data) || asString(data);
  }

  if (Array.isArray(data)) {
    return data.map(extractText).filter(Boolean).join("");
  }

  const choice = data && Array.isArray(data.choices) ? data.choices[0] : null;
  const message = choice && choice.message ? choice.message : {};
  const candidates = [
    message.content,
    message.answer,
    choice && choice.delta,
    choice && choice.text,
    data && data.output_text,
    data && data.answer,
    data && data.reply,
    data && data.text,
    data && data.content,
    data && data.message,
    data && data.result,
    data && data.output,
    data && data.data
  ];

  for (const candidate of candidates) {
    const text = asString(extractTextValue(candidate));

    if (text) {
      return text;
    }
  }

  return "";
}

function parseResponseBody(rawBody) {
  const text = asString(rawBody);

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
  const source = asString(text);
  const pattern = new RegExp(
    `"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`
  );
  const match = source.match(pattern);

  if (match) {
    return decodeJsonString(match[1]).slice(0, 500);
  }

  const marker = `"${field}"`;
  const markerIndex = source.indexOf(marker);

  if (markerIndex < 0) {
    return "";
  }

  const colonIndex = source.indexOf(":", markerIndex + marker.length);

  if (colonIndex < 0) {
    return "";
  }

  const valueStart = source.indexOf('"', colonIndex + 1);

  if (valueStart < 0) {
    return "";
  }

  let value = "";
  let escaped = false;

  for (let index = valueStart + 1; index < source.length; index += 1) {
    const character = source[index];

    if (escaped) {
      value += `\\${character}`;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      return decodeJsonString(value).slice(0, 500);
    } else {
      value += character;
    }
  }

  return decodeJsonString(value).slice(0, 500);
}

function extractFirstStringField(text, fields) {
  for (const field of fields) {
    const value = extractStringField(text, field);

    if (value) {
      return value;
    }
  }

  return "";
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
  const reply = extractFirstStringField(text, ["reply", "answer", "text", "content"]);

  if (!reply) {
    return null;
  }

  return {
    text: reply,
    structured: true,
    recovered: true,
    intent: extractFirstStringField(text, ["intent", "type"]) || "other",
    leadStage: extractFirstStringField(text, ["leadStage", "stage"]) || "none",
    lead: cleanLead(
      extractObjectField(text, "lead") ||
      extractObjectField(text, "leadInfo")
    ),
    followUpQuestion: extractFirstStringField(text, ["followUpQuestion", "follow_up_question"])
  };
}

function looksLikeStructuredPayload(text) {
  return /["'](?:reply|answer|text|content|intent|leadStage|lead|followUpQuestion)["']\s*:/.test(
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
  const reply = asString(
    source &&
    extractTextValue(
      source.reply ||
      source.answer ||
      source.text ||
      source.content
    )
  );
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
      lead: cleanLead(source.lead || source.leadInfo),
      followUpQuestion: asString(
        source.followUpQuestion || source.follow_up_question
      ).slice(0, 240)
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
        temperature: 0.45,
        max_tokens: config.maxTokens
      }),
      signal: controller.signal
    });
    const rawBody = await response.text().catch(() => "");
    const data = parseResponseBody(rawBody);

    const rawResponsePreview = typeof data === "string"
      ? data.slice(0, 6000)
      : JSON.stringify(data).slice(0, 6000);
    const contentType = response.headers &&
      typeof response.headers.get === "function"
      ? response.headers.get("content-type")
      : null;

    if (isRawResponseDebugEnabled() && !response.ok) {
      console.log("AI provider raw error response", {
        status: response.status,
        contentType,
        model: config.model,
        bodyLength: rawBody.length,
        response: rawResponsePreview
      });
    }

    if (!response.ok) {
      throw new Error(
        data &&
        typeof data === "object" &&
        data.error &&
        (data.error.message || data.error.code)
          ? data.error.message || data.error.code
          : asString(rawBody) || `AI provider returned ${response.status}`
      );
    }

    const rawText = extractText(data) || (typeof data === "string" ? data : "");

    if (isRawResponseDebugEnabled()) {
      console.log("AI provider raw response", {
        status: response.status,
        contentType,
        model: config.model,
        bodyLength: rawBody.length,
        finishReason: data.choices && data.choices[0]
          ? data.choices[0].finish_reason || null
          : null,
        extractedTextLength: rawText.length,
        extractedText: rawText.slice(0, 3000),
        response: rawResponsePreview
      });
    }

    const result = parseReply(rawText);

    if (!result || result.text === "NEED_HUMAN") {
      const parseDiagnostic = {
        status: response.status,
        contentType,
        model: config.model,
        extractedTextLength: rawText.length,
        reason: result ? "AI requested human review" : "AI response could not be parsed"
      };

      if (isRawResponseDebugEnabled()) {
        parseDiagnostic.extractedText = rawText.slice(0, 3000);
        parseDiagnostic.response = rawResponsePreview;
      }

      console.warn("AI provider response could not be parsed", parseDiagnostic);

      return {
        unavailable: true,
        reason: result ? "AI requested human review" : "AI response could not be parsed",
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
