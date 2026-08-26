const express = require("express");
const cloudbase = require("@cloudbase/js-sdk");
const crypto = require("crypto");
const fallbackFaq = require("./data/faq.json");
const fallbackPackages = require("./data/packages.json");
const { generateReply, getAvailability } = require("./ai/provider");
const { retrieveKnowledge } = require("./ai/retrieval");

const app = express();
const port = Number(process.env.PORT || 9000);
const defaultStudioId = process.env.DEFAULT_STUDIO_ID || "demo-studio";
const faqCollection = process.env.CLOUDBASE_FAQ_COLLECTION || "faqs";
const packageCollection = process.env.CLOUDBASE_PACKAGE_COLLECTION || "packages";
const leadCollection = process.env.CLOUDBASE_LEAD_COLLECTION || "leads";
const chatCollection = process.env.CLOUDBASE_CHAT_COLLECTION || "chat_messages";
const unansweredCollection = process.env.CLOUDBASE_UNANSWERED_COLLECTION || "unanswered_questions";
const adminApiToken = asString(process.env.ADMIN_API_TOKEN);
const chatOperationTimeouts = {
  knowledge: 1800,
  leadCapture: 1800,
  feishuNotification: 1000,
  chatLog: 1000,
  unanswered: 800
};
const knowledgeCacheTtlMs = 60 * 1000;

let cloudbaseDb = null;
const knowledgeCache = new Map();

app.use(express.json({ limit: "256kb" }));

app.use((req, res, next) => {
  // CORS is configured on the CloudBase HTTP gateway. Avoid adding a second
  // wildcard origin here, which would produce an invalid duplicate header.
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function withTimeout(task, timeoutMs, fallback) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve(fallback);
    }, timeoutMs);

    Promise.resolve()
      .then(task)
      .then((value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

function readAdminToken(req) {
  const headerToken = asString(req.get("x-admin-token"));
  const authorization = asString(req.get("authorization"));
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  return headerToken || bearerToken;
}

function tokenMatches(expected, actual) {
  if (!expected || !actual) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function requireAdmin(req, res, next) {
  if (!adminApiToken) {
    res.status(503).json({
      ok: false,
      error: "Admin API is not configured"
    });
    return;
  }

  if (!tokenMatches(adminApiToken, readAdminToken(req))) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
    return;
  }

  next();
}

function getDatabase() {
  if (cloudbaseDb) {
    return cloudbaseDb;
  }

  const envId = asString(process.env.CLOUDBASE_ENV_ID);
  const accessKey = asString(
    process.env.CLOUDBASE_APIKEY || process.env.CLOUDBASE_ACCESS_KEY
  );
  const secretId = asString(
    process.env.CLOUDBASE_SECRET_ID ||
      process.env.CLOUDBASE_SECRETID ||
      process.env.TENCENTCLOUD_SECRETID
  );
  const secretKey = asString(
    process.env.CLOUDBASE_SECRET_KEY ||
      process.env.CLOUDBASE_SECRETKEY ||
      process.env.TENCENTCLOUD_SECRETKEY
  );

  if (!envId) {
    return null;
  }

  const initOptions = { env: envId };

  if (accessKey) {
    initOptions.accessKey = accessKey;
  } else if (secretId && secretKey) {
    initOptions.secretId = secretId;
    initOptions.secretKey = secretKey;
  }

  const appInstance = cloudbase.init(initOptions);

  cloudbaseDb = appInstance.database();
  return cloudbaseDb;
}

function normalizeFaq(item) {
  return {
    id: asString(item.id) || asString(item._id),
    category: asString(item.category),
    keywords: Array.isArray(item.keywords)
      ? item.keywords
      : asString(item.keywords).split(/[，,]/).map((value) => value.trim()).filter(Boolean),
    answer: asString(item.answer),
    enabled: item.enabled !== false && item.isActive !== false
  };
}

function normalizePackage(item) {
  return {
    id: asString(item.id) || asString(item._id),
    name: asString(item.name || item.packageName),
    category: asString(item.category),
    price: asString(item.price),
    items: Array.isArray(item.items)
      ? item.items
      : asString(item.items).split(/[；;\n]/).map((value) => value.trim()).filter(Boolean),
    description: asString(item.description)
  };
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }

  return asString(value)
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAdminFaq(item) {
  return {
    _id: asString(item._id),
    id: asString(item.id) || asString(item._id),
    studioId: asString(item.studioId),
    category: asString(item.category),
    keywords: normalizeKeywords(item.keywords),
    answer: asString(item.answer),
    enabled: item.enabled !== false && item.isActive !== false,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null
  };
}

function normalizeAdminPackage(item) {
  return {
    _id: asString(item._id),
    id: asString(item.id) || asString(item._id),
    studioId: asString(item.studioId),
    name: asString(item.name || item.packageName),
    category: asString(item.category),
    price: asString(item.price),
    items: Array.isArray(item.items)
      ? item.items.map(asString).filter(Boolean)
      : asString(item.items)
        .split(/[；;\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
    description: asString(item.description),
    enabled: item.enabled !== false && item.isActive !== false,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null
  };
}

function getAdminCollection(collectionName, studioId) {
  const db = getDatabase();

  if (!db) {
    return null;
  }

  return db.collection(collectionName)
    .where({ studioId })
    .limit(200);
}

function cleanRecordFields(record, fields) {
  return fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      result[field] = record[field];
    }
    return result;
  }, {});
}

function parseEnabled(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  return null;
}

async function getCollectionData(collectionName, studioId, fallback) {
  const db = getDatabase();

  if (!db) {
    return fallback;
  }

  try {
    const result = await db.collection(collectionName)
      .where({
        studioId,
        enabled: true
      })
      .limit(100)
      .get();

    if (!Array.isArray(result.data)) {
      return fallback;
    }

    return result.data;
  } catch (error) {
    console.error("CloudBase collection read failed", collectionName, error);
    return fallback;
  }
}

async function getFaqs(studioId) {
  const data = await getCollectionData(faqCollection, studioId, fallbackFaq);
  return data.map(normalizeFaq).filter((item) => item.answer && item.enabled);
}

async function getPackages(studioId) {
  const data = await getCollectionData(packageCollection, studioId, fallbackPackages);
  return data.map(normalizePackage).filter((item) => item.name && item.price);
}

function invalidateKnowledgeCache(studioId) {
  if (studioId) {
    knowledgeCache.delete(studioId);
    return;
  }

  knowledgeCache.clear();
}

async function getKnowledge(studioId) {
  const cached = knowledgeCache.get(studioId);

  if (cached && Date.now() - cached.createdAt < knowledgeCacheTtlMs) {
    return cached.value;
  }

  const [faqs, packages] = await Promise.all([
    getFaqs(studioId),
    getPackages(studioId)
  ]);
  const value = { faqs, packages };

  knowledgeCache.set(studioId, {
    createdAt: Date.now(),
    value
  });

  return value;
}

function getFallbackKnowledge() {
  return {
    faqs: fallbackFaq.map(normalizeFaq).filter((item) => item.answer && item.enabled),
    packages: fallbackPackages.map(normalizePackage).filter((item) => item.name && item.price)
  };
}

function findFaq(message, faqs) {
  const normalized = message.toLowerCase();

  return faqs.find((item) =>
    item.keywords.some((keyword) =>
      normalized.includes(String(keyword).toLowerCase())
    )
  );
}

function findPackage(message, packages) {
  const normalized = message.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const item of packages) {
    const terms = [
      item.name,
      item.category,
      ...(Array.isArray(item.items) ? item.items : [])
    ]
      .map((term) => asString(term).toLowerCase())
      .filter((term) => term.length >= 2);

    const score = terms.reduce((total, term) => {
      return total + (normalized.includes(term) ? (term === item.name.toLowerCase() ? 4 : 2) : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

function isGreetingMessage(message) {
  return /^(你好|您好|嗨|哈喽|hello|hi|hey|在吗|有人吗|早上好|下午好|晚上好)[！!。。，,\s~～]*$/i.test(
    asString(message)
  );
}

function extractContact(text) {
  const source = asString(text);
  const phone = source.match(/(?:\+?86[\s-]?)?(1[3-9]\d{9})(?!\d)/);

  if (phone) {
    return phone[1];
  }

  const wechat = source.match(
    /(?:微信(?:号|联系)?|wx|wechat)\s*[:：]?\s*([a-zA-Z][-_a-zA-Z0-9]{4,30})/i
  );

  return wechat ? `微信:${wechat[1]}` : "";
}

function getConversationText(message, history) {
  const recentUserMessages = Array.isArray(history)
    ? history
      .filter((item) => item && item.role === "user")
      .slice(-6)
      .map((item) => asString(item.content || item.text))
      .filter(Boolean)
    : [];

  return [...recentUserMessages, asString(message)].filter(Boolean).join(" ");
}

function hasBusinessIntent(text) {
  return /婚纱照|婚纱|旅拍|旅游照|亲子照|亲子|婚纱租赁|礼服|套餐|预算|价格|多少钱|费用|预约|档期|拍摄|试穿|定金|精修|底片|出片|地址|营业|咨询|联系/.test(
    text
  );
}

function extractLeadFields(text) {
  const source = asString(text);
  const serviceType = /婚纱照|婚纱/.test(source)
    ? "婚纱照"
    : /旅拍|旅游照|旅游写真/.test(source)
      ? "旅拍"
      : /亲子照|亲子|宝宝照|家庭照/.test(source)
        ? "亲子照"
        : /婚纱租赁|礼服|租婚纱|租赁/.test(source)
          ? "婚纱租赁"
          : "";
  const budgetMatch = source.match(/预算[^\d]{0,8}(\d{3,7})\s*(?:元|块)?/);
  const dateMatch = source.match(
    /(今天|明天|后天|这周末|下周末|下周|下个月|本月底|月底|\d{1,2}月\d{1,2}[日号]?)/
  );

  return {
    serviceType,
    budget: budgetMatch ? `${budgetMatch[1]}元` : "",
    preferredDate: dateMatch ? dateMatch[1] : ""
  };
}

function mergeExtractedLead(aiResult, contact, contextText) {
  const source = aiResult && typeof aiResult === "object" ? aiResult : {};
  const lead = normalizeAiLead(source.lead);
  const extracted = extractLeadFields(contextText);
  const hasIntent = contact && hasBusinessIntent(contextText);
  const leadStage = ["interested", "high_intent"].includes(source.leadStage)
    ? source.leadStage
    : hasIntent
      ? "high_intent"
      : "none";
  const intent = source.intent && source.intent !== "other"
    ? source.intent
    : hasIntent
      ? "booking"
      : "other";

  if (!lead.contact && contact) {
    lead.contact = contact;
  }
  if (!lead.serviceType && extracted.serviceType) {
    lead.serviceType = extracted.serviceType;
  }
  if (!lead.budget && extracted.budget) {
    lead.budget = extracted.budget;
  }
  if (!lead.preferredDate && extracted.preferredDate) {
    lead.preferredDate = extracted.preferredDate;
  }

  return {
    ...source,
    lead,
    leadStage,
    intent
  };
}

function buildPackageReply(item) {
  const items = item.items.length
    ? `包含：${item.items.join("、")}。`
    : "";
  const description = item.description
    ? `${item.description.replace(/[。！？!?]+$/g, "")}。`
    : "";

  return `${item.name}，价格${item.price}。${items}${description}如果你想预约，可以留下联系方式和意向日期，我们会尽快联系你。`;
}

function buildPackageListReply(packages) {
  const summary = packages
    .filter((item) => item.name && item.price)
    .map((item) => `${item.name}（${item.price}）`)
    .join("、");

  return summary
    ? `目前可咨询的套餐有：${summary}。告诉我你想了解的拍摄类型，我可以继续介绍套餐内容。`
    : "目前还没有可展示的套餐，门店顾问可以为你提供详细方案。";
}

async function saveChatMessage(record) {
  const db = getDatabase();

  if (!db) {
    return { stored: false, reason: "CLOUDBASE_ENV_ID is not configured" };
  }

  try {
    const result = await db.collection(chatCollection).add(record);
    return { stored: true, id: result.id || result._id || null };
  } catch (error) {
    console.error("CloudBase chat log write failed", error);
    return {
      stored: false,
      reason: error.message || "chat log write failed"
    };
  }
}

function normalizeQuestion(value) {
  return asString(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function saveUnansweredQuestion(record) {
  const db = getDatabase();

  if (!db) {
    return { stored: false, reason: "CLOUDBASE_ENV_ID is not configured" };
  }

  try {
    const existing = await db.collection(unansweredCollection)
      .where({
        studioId: record.studioId,
        questionKey: record.questionKey,
        status: "open"
      })
      .limit(1)
      .get();
    const previous = Array.isArray(existing.data) ? existing.data[0] : null;

    if (previous && previous._id) {
      const update = {
        count: Number(previous.count || 1) + 1,
        lastAskedAt: record.lastAskedAt,
        lastSessionId: record.lastSessionId,
        updatedAt: record.updatedAt
      };
      await db.collection(unansweredCollection).doc(previous._id).update(update);
      return { stored: true, id: previous._id, deduplicated: true };
    }

    const result = await db.collection(unansweredCollection).add(record);
    return {
      stored: true,
      id: result.id || result._id || null,
      deduplicated: false
    };
  } catch (error) {
    console.error("CloudBase unanswered question write failed", error);
    return {
      stored: false,
      reason: error.message || "unanswered question write failed"
    };
  }
}

async function countDocuments(collectionName, filter) {
  const db = getDatabase();

  if (!db) {
    return 0;
  }

  try {
    const result = await db.collection(collectionName)
      .where(filter)
      .count();
    return Number(result.total || 0);
  } catch (error) {
    console.error("CloudBase count failed", collectionName, filter, error);
    return 0;
  }
}

function buildLeadText(lead) {
  return [
    "新摄影店预约线索",
    `姓名：${lead.name || "未填写"}`,
    `联系方式：${lead.contact}`,
    `拍摄类型：${lead.serviceType || "未填写"}`,
    `意向日期：${lead.preferredDate || "未填写"}`,
    `预算：${lead.budget || "未填写"}`,
    `补充需求：${lead.note || "无"}`,
    `来源：${lead.source || "douyin-miniapp"}`
  ].join("\n");
}

async function notifyFeishu(text) {
  const webhook = asString(process.env.FEISHU_BOT_WEBHOOK);

  if (!webhook) {
    return {
      sent: false,
      reason: "FEISHU_BOT_WEBHOOK is not configured"
    };
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      msg_type: "text",
      content: { text }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.code) {
    throw new Error(data.msg || "Feishu notification failed");
  }

  return { sent: true };
}

async function saveLead(lead) {
  const db = getDatabase();

  if (!db) {
    return {
      stored: false,
      reason: "CLOUDBASE_ENV_ID is not configured"
    };
  }

  try {
    const result = await db.collection(leadCollection).add(lead);
    return {
      stored: true,
      id: result.id || result._id || null
    };
  } catch (error) {
    console.error("CloudBase lead write failed", error);
    throw new Error(error.message || "CloudBase lead storage failed");
  }
}

function normalizeAiLead(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    name: asString(source.name).slice(0, 120),
    contact: asString(source.contact).slice(0, 120),
    serviceType: asString(source.serviceType).slice(0, 120),
    preferredDate: asString(source.preferredDate).slice(0, 120),
    budget: asString(source.budget).slice(0, 120)
  };
}

function hasLeadContact(lead) {
  return Boolean(asString(lead && lead.contact));
}

async function captureAiLead({
  studioId,
  sessionId,
  message,
  aiResult,
  leadIntent
}) {
  const aiLead = normalizeAiLead(aiResult && aiResult.lead);
  const eligible = Boolean(
    aiResult &&
    ["interested", "high_intent"].includes(aiResult.leadStage) &&
    leadIntent &&
    hasLeadContact(aiLead)
  );

  if (!eligible) {
    return {
      eligible: false,
      stored: false,
      deduplicated: false,
      reason: hasLeadContact(aiLead)
        ? "AI lead stage is not interested or high_intent"
        : "AI did not extract a contact"
    };
  }

  const db = getDatabase();

  if (!db) {
    return {
      eligible: true,
      stored: false,
      deduplicated: false,
      lead: aiLead,
      reason: "CLOUDBASE_ENV_ID is not configured"
    };
  }

  try {
    const existing = await db.collection(leadCollection)
      .where({
        studioId,
        sessionId,
        source: "douyin-miniapp-ai"
      })
      .limit(1)
      .get();
    const previous = Array.isArray(existing.data) ? existing.data[0] : null;

    if (previous && previous._id) {
      return {
        eligible: true,
        stored: true,
        deduplicated: true,
        id: previous._id,
        lead: aiLead
      };
    }

    const lead = {
      studioId,
      sessionId,
      name: aiLead.name,
      contact: aiLead.contact,
      serviceType: aiLead.serviceType,
      preferredDate: aiLead.preferredDate,
      budget: aiLead.budget,
      note: `AI 自动识别：${message}`,
      source: "douyin-miniapp-ai",
      status: "new",
      aiIntent: aiResult.intent || "other",
      aiLeadStage: aiResult.leadStage,
      createdAt: new Date()
    };
    const storage = await saveLead(lead);

    return {
      eligible: true,
      stored: storage.stored,
      deduplicated: false,
      id: storage.id,
      lead
    };
  } catch (error) {
    console.error("AI lead capture failed", error);
    return {
      eligible: true,
      stored: false,
      deduplicated: false,
      lead: aiLead,
      reason: error.message || "AI lead capture failed"
    };
  }
}

function removeRegistrationClaims(value) {
  let text = asString(value);
  const patterns = [
    /我们已经帮您[^。！？!?]*(?:登记|记录|提交)[^。！？!?]*[。！？!?]?/g,
    /已经帮您[^。！？!?]*(?:登记|记录|提交)[^。！？!?]*[。！？!?]?/g,
    /已为您[^。！？!?]*(?:登记|记录|提交)[^。！？!?]*[。！？!?]?/g,
    /已经为您[^。！？!?]*(?:登记|记录|提交)[^。！？!?]*[。！？!?]?/g
  ];

  patterns.forEach((pattern) => {
    text = text.replace(pattern, "");
  });

  return text
    .replace(/\s{2,}/g, " ")
    .replace(/([。！？!?])\1+/g, "$1")
    .trim();
}

function finalizeAiReply(reply, leadCapture) {
  const cleanedReply = removeRegistrationClaims(reply);

  if (leadCapture && (leadCapture.stored || leadCapture.deduplicated)) {
    return `${cleanedReply || "好的，"}已记录您的预约意向，门店顾问会尽快联系您确认具体档期。`;
  }

  if (leadCapture && leadCapture.eligible && !leadCapture.stored) {
    if (hasLeadContact(leadCapture.lead)) {
      return `${cleanedReply || "好的。"}我们已收到您的联系方式，但登记服务暂时不可用，请稍后重试或联系门店顾问。`;
    }

    return `${cleanedReply || "好的。"}请留下手机号或微信，门店顾问才能为您登记预约意向。`;
  }

  return cleanedReply || asString(reply);
}

app.get("/health", (req, res) => {
  const envConfigured = Boolean(asString(process.env.CLOUDBASE_ENV_ID));
  const authConfigured = Boolean(
    asString(process.env.CLOUDBASE_APIKEY || process.env.CLOUDBASE_ACCESS_KEY) ||
      (
        asString(
          process.env.CLOUDBASE_SECRET_ID ||
            process.env.CLOUDBASE_SECRETID ||
            process.env.TENCENTCLOUD_SECRETID
        ) &&
        asString(
          process.env.CLOUDBASE_SECRET_KEY ||
            process.env.CLOUDBASE_SECRETKEY ||
            process.env.TENCENTCLOUD_SECRETKEY
        )
      )
  );

  res.json({
    ok: true,
    service: "cloudbase-photo-studio-api",
    databaseConfigured: Boolean(getDatabase()),
    cloudbase: {
      envConfigured,
      authConfigured,
      collections: {
        faqs: faqCollection,
        packages: packageCollection,
        leads: leadCollection,
        chatMessages: chatCollection,
        unansweredQuestions: unansweredCollection
      }
    },
    ai: getAvailability(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/photo-studio/knowledge", async (req, res) => {
  const studioId = asString(req.query.studioId) || defaultStudioId;

  try {
    const { faqs, packages } = await getKnowledge(studioId);

    res.json({
      ok: true,
      studioId,
      faqs,
      packages
    });
  } catch (error) {
    console.error("Knowledge API failed", error);
    res.status(500).json({
      ok: false,
      error: "Knowledge service failed"
    });
  }
});

app.get("/api/photo-studio/admin/leads", requireAdmin, async (req, res) => {
  const studioId = asString(req.query.studioId) || defaultStudioId;
  const status = asString(req.query.status);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const db = getDatabase();

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    const filter = { studioId };

    if (status && status !== "all") {
      filter.status = status;
    }

    const result = await db.collection(leadCollection)
      .where(filter)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    res.json({
      ok: true,
      studioId,
      leads: Array.isArray(result.data) ? result.data : []
    });
  } catch (error) {
    console.error("Admin lead list failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Lead list failed"
    });
  }
});

app.patch("/api/photo-studio/admin/leads/:leadId", requireAdmin, async (req, res) => {
  const leadId = asString(req.params.leadId);
  const status = asString(req.body.status);
  const staffNote = asString(req.body.staffNote);
  const allowedStatuses = new Set([
    "new",
    "contacted",
    "booked",
    "completed",
    "invalid"
  ]);
  const db = getDatabase();

  if (!leadId) {
    res.status(400).json({
      ok: false,
      error: "Missing lead ID"
    });
    return;
  }

  if (status && !allowedStatuses.has(status)) {
    res.status(400).json({
      ok: false,
      error: "Invalid lead status"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  const update = {
    updatedAt: new Date()
  };

  if (status) {
    update.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "staffNote")) {
    update.staffNote = staffNote;
  }

  try {
    await db.collection(leadCollection).doc(leadId).update(update);
    res.json({
      ok: true,
      leadId,
      update
    });
  } catch (error) {
    console.error("Admin lead update failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Lead update failed"
    });
  }
});

app.get("/api/photo-studio/admin/stats", requireAdmin, async (req, res) => {
  const studioId = asString(req.query.studioId) || defaultStudioId;
  const db = getDatabase();

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    const [
      totalChats,
      totalLeads,
      newLeads,
      contactedLeads,
      bookedLeads,
      completedLeads,
      humanRequiredChats,
      faqMatchedChats,
      packageMatchedChats,
      packageListChats,
      aiAnsweredChats,
      aiFallbackChats,
      highIntentChats,
      totalUnanswered,
      openUnanswered
    ] = await Promise.all([
      countDocuments(chatCollection, { studioId }),
      countDocuments(leadCollection, { studioId }),
      countDocuments(leadCollection, { studioId, status: "new" }),
      countDocuments(leadCollection, { studioId, status: "contacted" }),
      countDocuments(leadCollection, { studioId, status: "booked" }),
      countDocuments(leadCollection, { studioId, status: "completed" }),
      countDocuments(chatCollection, { studioId, needHuman: true }),
      countDocuments(chatCollection, { studioId, matchType: "faq" }),
      countDocuments(chatCollection, { studioId, matchType: "package" }),
      countDocuments(chatCollection, { studioId, matchType: "package_list" }),
      countDocuments(chatCollection, { studioId, aiUsed: true }),
      countDocuments(chatCollection, { studioId, aiEnabled: true, aiUsed: false }),
      countDocuments(chatCollection, { studioId, aiLeadStage: "high_intent" }),
      countDocuments(unansweredCollection, { studioId }),
      countDocuments(unansweredCollection, { studioId, status: "open" })
    ]);

    const conversionRate = totalLeads
      ? Math.round((bookedLeads / totalLeads) * 100)
      : 0;

    res.json({
      ok: true,
      studioId,
      stats: {
        totalChats,
        totalLeads,
        newLeads,
        contactedLeads,
        bookedLeads,
        completedLeads,
        humanRequiredChats,
        faqMatchedChats,
        packageMatchedChats,
        packageListChats,
        aiAnsweredChats,
        aiFallbackChats,
        highIntentChats,
        totalUnanswered,
        openUnanswered,
        conversionRate
      }
    });
  } catch (error) {
    console.error("Admin stats failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Stats failed"
    });
  }
});

app.get("/api/photo-studio/admin/unanswered", requireAdmin, async (req, res) => {
  const studioId = asString(req.query.studioId) || defaultStudioId;
  const status = asString(req.query.status) || "open";
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const db = getDatabase();
  const allowedStatuses = new Set(["all", "open", "reviewed", "resolved", "ignored"]);

  if (!allowedStatuses.has(status)) {
    res.status(400).json({
      ok: false,
      error: "Invalid unanswered status"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    const filter = { studioId };

    if (status !== "all") {
      filter.status = status;
    }

    const result = await db.collection(unansweredCollection)
      .where(filter)
      .orderBy("lastAskedAt", "desc")
      .limit(limit)
      .get();

    res.json({
      ok: true,
      studioId,
      questions: Array.isArray(result.data) ? result.data : []
    });
  } catch (error) {
    console.error("Admin unanswered list failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Unanswered list failed"
    });
  }
});

app.patch("/api/photo-studio/admin/unanswered/:questionId", requireAdmin, async (req, res) => {
  const questionId = asString(req.params.questionId);
  const status = asString(req.body.status);
  const staffNote = asString(req.body.staffNote);
  const allowedStatuses = new Set(["open", "reviewed", "resolved", "ignored"]);
  const db = getDatabase();

  if (!questionId) {
    res.status(400).json({
      ok: false,
      error: "Missing unanswered question ID"
    });
    return;
  }

  if (!allowedStatuses.has(status)) {
    res.status(400).json({
      ok: false,
      error: "Invalid unanswered status"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    const update = {
      status,
      staffNote,
      updatedAt: new Date()
    };
    await db.collection(unansweredCollection).doc(questionId).update(update);
    res.json({
      ok: true,
      questionId,
      update
    });
  } catch (error) {
    console.error("Admin unanswered update failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Unanswered update failed"
    });
  }
});

app.get("/api/photo-studio/admin/knowledge", requireAdmin, async (req, res) => {
  const studioId = asString(req.query.studioId) || defaultStudioId;
  const type = asString(req.query.type) || "all";
  const db = getDatabase();

  if (!["all", "faqs", "packages"].includes(type)) {
    res.status(400).json({
      ok: false,
      error: "Invalid knowledge type"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    const result = {
      ok: true,
      studioId,
      faqs: [],
      packages: []
    };

    if (type === "all" || type === "faqs") {
      const faqResult = await getAdminCollection(faqCollection, studioId).get();
      result.faqs = Array.isArray(faqResult.data)
        ? faqResult.data.map(normalizeAdminFaq)
        : [];
    }

    if (type === "all" || type === "packages") {
      const packageResult = await getAdminCollection(packageCollection, studioId).get();
      result.packages = Array.isArray(packageResult.data)
        ? packageResult.data.map(normalizeAdminPackage)
        : [];
    }

    res.json(result);
  } catch (error) {
    console.error("Admin knowledge list failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Knowledge list failed"
    });
  }
});

app.post("/api/photo-studio/admin/knowledge/faqs", requireAdmin, async (req, res) => {
  const studioId = asString(req.body.studioId) || defaultStudioId;
  const category = asString(req.body.category);
  const keywords = normalizeKeywords(req.body.keywords);
  const answer = asString(req.body.answer);
  const db = getDatabase();

  if (!category || !keywords.length || !answer) {
    res.status(400).json({
      ok: false,
      error: "FAQ requires category, keywords and answer"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    const now = new Date();
    const record = {
      studioId,
      category,
      keywords,
      answer,
      enabled: true,
      createdAt: now,
      updatedAt: now
    };
    const result = await db.collection(faqCollection).add(record);
    invalidateKnowledgeCache(studioId);

    res.status(201).json({
      ok: true,
      type: "faq",
      id: result.id || result._id || null,
      record
    });
  } catch (error) {
    console.error("Admin FAQ create failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "FAQ create failed"
    });
  }
});

app.patch("/api/photo-studio/admin/knowledge/faqs/:faqId", requireAdmin, async (req, res) => {
  const faqId = asString(req.params.faqId);
  const db = getDatabase();
  const update = cleanRecordFields(req.body, ["category", "answer"]);
  const keywords = normalizeKeywords(req.body.keywords);
  const enabled = parseEnabled(req.body.enabled);

  if (!faqId) {
    res.status(400).json({
      ok: false,
      error: "Missing FAQ ID"
    });
    return;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "keywords")) {
    update.keywords = keywords;
  }

  if (enabled !== null) {
    update.enabled = enabled;
  }

  update.updatedAt = new Date();

  if (
    (Object.prototype.hasOwnProperty.call(update, "category") && !asString(update.category)) ||
    (Object.prototype.hasOwnProperty.call(update, "answer") && !asString(update.answer)) ||
    (Object.prototype.hasOwnProperty.call(update, "keywords") && !update.keywords.length)
  ) {
    res.status(400).json({
      ok: false,
      error: "Invalid FAQ fields"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    await db.collection(faqCollection).doc(faqId).update(update);
    invalidateKnowledgeCache();
    res.json({
      ok: true,
      type: "faq",
      id: faqId,
      update
    });
  } catch (error) {
    console.error("Admin FAQ update failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "FAQ update failed"
    });
  }
});

app.post("/api/photo-studio/admin/knowledge/packages", requireAdmin, async (req, res) => {
  const studioId = asString(req.body.studioId) || defaultStudioId;
  const name = asString(req.body.name);
  const category = asString(req.body.category);
  const price = asString(req.body.price);
  const items = normalizeKeywords(req.body.items);
  const description = asString(req.body.description);
  const db = getDatabase();

  if (!name || !category || !price) {
    res.status(400).json({
      ok: false,
      error: "Package requires name, category and price"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    const now = new Date();
    const record = {
      studioId,
      name,
      category,
      price,
      items,
      description,
      enabled: true,
      createdAt: now,
      updatedAt: now
    };
    const result = await db.collection(packageCollection).add(record);
    invalidateKnowledgeCache(studioId);

    res.status(201).json({
      ok: true,
      type: "package",
      id: result.id || result._id || null,
      record
    });
  } catch (error) {
    console.error("Admin package create failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Package create failed"
    });
  }
});

app.patch("/api/photo-studio/admin/knowledge/packages/:packageId", requireAdmin, async (req, res) => {
  const packageId = asString(req.params.packageId);
  const db = getDatabase();
  const update = cleanRecordFields(req.body, [
    "name",
    "category",
    "price",
    "description"
  ]);
  const items = normalizeKeywords(req.body.items);
  const enabled = parseEnabled(req.body.enabled);

  if (!packageId) {
    res.status(400).json({
      ok: false,
      error: "Missing package ID"
    });
    return;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "items")) {
    update.items = items;
  }

  if (enabled !== null) {
    update.enabled = enabled;
  }

  update.updatedAt = new Date();

  const requiredFields = ["name", "category", "price"];
  if (requiredFields.some((field) =>
    Object.prototype.hasOwnProperty.call(update, field) && !asString(update[field])
  )) {
    res.status(400).json({
      ok: false,
      error: "Invalid package fields"
    });
    return;
  }

  if (!db) {
    res.status(503).json({
      ok: false,
      error: "CloudBase database is not configured"
    });
    return;
  }

  try {
    await db.collection(packageCollection).doc(packageId).update(update);
    invalidateKnowledgeCache();
    res.json({
      ok: true,
      type: "package",
      id: packageId,
      update
    });
  } catch (error) {
    console.error("Admin package update failed", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Package update failed"
    });
  }
});

app.post("/api/photo-studio/chat", async (req, res) => {
  const message = asString(req.body.message);
  const serviceKey = asString(req.body.serviceKey);
  const serviceType = asString(req.body.serviceType);
  const sessionId = asString(req.body.sessionId);
  const studioId = asString(req.body.studioId) || defaultStudioId;
  const history = Array.isArray(req.body.history) ? req.body.history : [];
  const conversationId = sessionId || `session-${Date.now()}`;

  if (!message) {
    res.status(400).json({
      ok: false,
      error: "Missing message"
    });
    return;
  }

  try {
    const knowledge = await withTimeout(
      () => getKnowledge(studioId),
      chatOperationTimeouts.knowledge,
      getFallbackKnowledge()
    );
    const { faqs, packages } = knowledge;
    const serviceContext = serviceType || serviceKey;
    const contextualMessage = serviceContext
      ? `${serviceContext} ${message}`
      : message;
    const conversationText = getConversationText(contextualMessage, history);
    const greeting = isGreetingMessage(message);
    const contact = extractContact(conversationText);
    const matchedFaq = findFaq(contextualMessage, faqs);
    const matchedPackage = findPackage(contextualMessage, packages);
    const packageIntent = /套餐|价格|多少钱|预算|包含|内容|费用/.test(contextualMessage);
    const listPackageIntent = /有哪些|什么套餐|套餐列表|套餐介绍/.test(contextualMessage);
    const specificPackageMention = matchedPackage && (
      packageIntent ||
      contextualMessage.toLowerCase().includes(matchedPackage.name.toLowerCase())
    );
    const usePackageReply = Boolean(matchedPackage && specificPackageMention);
    const usePackageListReply = Boolean(
      !usePackageReply &&
      (listPackageIntent || (packageIntent && packages.length && !matchedFaq))
    );
    const baseMatchType = usePackageReply
      ? "package"
      : usePackageListReply
        ? "package_list"
        : matchedFaq
          ? "faq"
          : greeting
            ? "greeting"
            : "none";
    const fallbackReply = usePackageReply
      ? buildPackageReply(matchedPackage)
      : usePackageListReply
        ? buildPackageListReply(packages)
        : matchedFaq
          ? matchedFaq.answer
          : greeting
            ? "你好，我是摄影店智能客服，可以帮你了解婚纱照、旅拍、亲子照、婚纱租赁和套餐价格。你想了解哪一项呢？"
            : "我可以帮你了解婚纱照、旅拍、亲子照、婚纱租赁和套餐价格。你想了解哪一项呢？";
    const aiAvailability = getAvailability();
    const retrievedKnowledge = retrieveKnowledge({
      message: contextualMessage,
      history,
      faqs,
      packages
    });
    const shouldUseAi = Boolean(
      aiAvailability.enabled &&
      !greeting
    );
    const aiResult = shouldUseAi
      ? await generateReply({
        message: contextualMessage,
        history,
        faqs: retrievedKnowledge.faqs,
        packages: retrievedKnowledge.packages
      })
      : null;
    const aiAttempted = Boolean(shouldUseAi);
    const aiUsed = Boolean(aiResult && aiResult.text);
    const matchType = aiUsed && baseMatchType === "none" ? "ai" : baseMatchType;
    let reply = aiUsed ? aiResult.text : fallbackReply;
    const effectiveAiResult = mergeExtractedLead(
      aiUsed ? aiResult : null,
      contact,
      conversationText
    );
    const leadIntent = Boolean(
      (effectiveAiResult &&
        ["interested", "high_intent"].includes(effectiveAiResult.leadStage)) ||
      hasBusinessIntent(conversationText)
    );

    const aiLead = normalizeAiLead(effectiveAiResult && effectiveAiResult.lead);
    const leadCaptureEligible = Boolean(
      effectiveAiResult &&
      ["interested", "high_intent"].includes(effectiveAiResult.leadStage) &&
      leadIntent &&
      hasLeadContact(aiLead)
    );
    const needHuman = matchType === "none" && !aiUsed && !leadCaptureEligible;
    const leadCapture = aiUsed || leadCaptureEligible
      ? await withTimeout(
        () => captureAiLead({
          studioId,
          sessionId: conversationId,
          message,
          aiResult: effectiveAiResult,
          leadIntent
        }),
        chatOperationTimeouts.leadCapture,
        {
          eligible: leadCaptureEligible,
          stored: false,
          deduplicated: false,
          lead: aiLead,
          reason: "AI lead capture timed out"
        }
      )
      : {
        eligible: false,
        stored: false,
        deduplicated: false,
        reason: "AI did not answer this message"
      };
    let notification = null;

    if (leadCapture.stored && !leadCapture.deduplicated) {
      try {
        notification = await withTimeout(
          () => notifyFeishu(buildLeadText(leadCapture.lead)),
          chatOperationTimeouts.feishuNotification,
          {
            sent: false,
            reason: "Feishu notification timed out"
          }
        );
      } catch (error) {
        console.error("AI lead Feishu notification failed", error);
        notification = {
          sent: false,
          reason: error.message || "Feishu notification failed"
        };
      }
    }

    if (aiUsed || leadCapture.eligible) {
      reply = finalizeAiReply(reply, leadCapture);
    }

    const chatLog = await withTimeout(
      () => saveChatMessage({
        studioId,
        sessionId: conversationId,
        userMessage: message,
        reply,
        matchedFaqId: matchedFaq ? matchedFaq.id : null,
        matchedPackageId: usePackageReply ? matchedPackage.id : null,
        serviceKey: serviceKey || null,
        serviceType: serviceType || null,
        matchType,
        needHuman,
        aiEnabled: aiAvailability.enabled,
        aiUsed,
        aiFallback: Boolean(aiAttempted && !aiUsed),
        aiSkipped: Boolean(aiAvailability.enabled && !aiAttempted),
        aiProvider: aiUsed ? aiResult.provider : null,
        aiLatencyMs: aiResult && aiResult.latencyMs ? aiResult.latencyMs : null,
        aiStructured: Boolean(aiUsed && aiResult.structured),
        aiRecovered: Boolean(aiUsed && aiResult.recovered),
        aiIntent: effectiveAiResult.intent,
        aiLeadStage: effectiveAiResult.leadStage,
        aiLead: effectiveAiResult.lead,
        aiFollowUpQuestion: aiUsed ? aiResult.followUpQuestion : null,
        aiLeadCaptureEligible: leadCapture.eligible,
        aiLeadStored: leadCapture.stored,
        aiLeadDeduplicated: leadCapture.deduplicated,
        aiLeadId: leadCapture.id || null,
        aiLeadNotificationSent: Boolean(notification && notification.sent),
        knowledgeContext: retrievedKnowledge.context,
        source: "douyin-miniapp",
        createdAt: new Date()
      }),
      chatOperationTimeouts.chatLog,
      {
        stored: false,
        reason: "chat log write timed out"
      }
    );

    let unanswered = null;

    if (matchType === "none" && !leadCaptureEligible) {
      const now = new Date();
      unanswered = await withTimeout(
        () => saveUnansweredQuestion({
          studioId,
          question: message,
          questionKey: normalizeQuestion(message),
          sampleReply: reply,
          status: "open",
          count: 1,
          firstAskedAt: now,
          lastAskedAt: now,
          lastSessionId: sessionId || null,
          source: "douyin-miniapp",
          staffNote: "",
          createdAt: now,
          updatedAt: now
        }),
        chatOperationTimeouts.unanswered,
        {
          stored: false,
          reason: "unanswered question write timed out"
        }
      );
    }

    res.json({
      ok: true,
      reply,
      matchedFaqId: matchedFaq ? matchedFaq.id : null,
      matchedPackageId: usePackageReply ? matchedPackage.id : null,
      matchType,
      needHuman,
      leadIntent,
      sessionId: conversationId,
      chatLog,
      unanswered,
      leadCapture: {
        eligible: leadCapture.eligible,
        stored: leadCapture.stored,
        deduplicated: leadCapture.deduplicated,
        id: leadCapture.id || null,
        reason: leadCapture.reason || null,
        lead: leadCapture.lead || null,
        notification
      },
      ai: {
        enabled: aiAvailability.enabled,
        configured: aiAvailability.configured,
        used: aiUsed,
        fallback: Boolean(aiAttempted && !aiUsed),
        skipped: Boolean(aiAvailability.enabled && !aiAttempted),
        reason: aiResult && aiResult.reason ? aiResult.reason : null,
        provider: aiUsed ? aiResult.provider : null,
        latencyMs: aiResult && aiResult.latencyMs ? aiResult.latencyMs : null,
        structured: Boolean(aiUsed && aiResult.structured),
        recovered: Boolean(aiUsed && aiResult.recovered),
        intent: aiUsed ? aiResult.intent : null,
        leadStage: aiUsed ? aiResult.leadStage : null,
        lead: aiUsed ? aiResult.lead : null,
        followUpQuestion: aiUsed ? aiResult.followUpQuestion : null,
        knowledgeContext: retrievedKnowledge.context,
        extractedContact: contact
      }
    });
  } catch (error) {
    console.error("Chat API failed", error);
    res.status(500).json({
      ok: false,
      error: "Chat service failed"
    });
  }
});

app.post("/api/photo-studio/leads", async (req, res) => {
  const lead = {
    studioId: asString(req.body.studioId) || defaultStudioId,
    name: asString(req.body.name),
    contact: asString(req.body.contact),
    serviceType: asString(req.body.serviceType),
    preferredDate: asString(req.body.preferredDate),
    budget: asString(req.body.budget),
    note: asString(req.body.note),
    source: asString(req.body.source) || "douyin-miniapp",
    status: "new",
    createdAt: new Date()
  };

  if (!lead.contact) {
    res.status(400).json({
      ok: false,
      error: "Missing contact"
    });
    return;
  }

  try {
    const storage = await saveLead(lead);
    let notification;

    try {
      notification = await notifyFeishu(buildLeadText(lead));
    } catch (error) {
      console.error("Feishu lead notification failed", error);
      notification = {
        sent: false,
        reason: error.message || "Feishu notification failed"
      };
    }

    res.json({
      ok: true,
      leadId: storage.id || `lead-${Date.now()}`,
      stored: storage.stored,
      storage,
      notification,
      message: notification.sent
        ? "Lead stored and notification sent"
        : "Lead stored; notification needs attention"
    });
  } catch (error) {
    console.error("Lead API failed", error);
    res.status(502).json({
      ok: false,
      error: error.message || "Lead service failed"
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`CloudBase photo studio API listening on port ${port}`);
});
