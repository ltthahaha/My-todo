const express = require("express");
const cloudbase = require("@cloudbase/js-sdk");
const crypto = require("crypto");
const fallbackFaq = require("./data/faq.json");
const fallbackPackages = require("./data/packages.json");

const app = express();
const port = Number(process.env.PORT || 9000);
const defaultStudioId = process.env.DEFAULT_STUDIO_ID || "demo-studio";
const faqCollection = process.env.CLOUDBASE_FAQ_COLLECTION || "faqs";
const packageCollection = process.env.CLOUDBASE_PACKAGE_COLLECTION || "packages";
const leadCollection = process.env.CLOUDBASE_LEAD_COLLECTION || "leads";
const chatCollection = process.env.CLOUDBASE_CHAT_COLLECTION || "chat_messages";
const adminApiToken = asString(process.env.ADMIN_API_TOKEN);

let cloudbaseDb = null;

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

    if (!Array.isArray(result.data) || result.data.length === 0) {
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

function findFaq(message, faqs) {
  const normalized = message.toLowerCase();

  return faqs.find((item) =>
    item.keywords.some((keyword) =>
      normalized.includes(String(keyword).toLowerCase())
    )
  );
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
        chatMessages: chatCollection
      }
    },
    timestamp: new Date().toISOString()
  });
});

app.get("/api/photo-studio/knowledge", async (req, res) => {
  const studioId = asString(req.query.studioId) || defaultStudioId;

  try {
    const [faqs, packages] = await Promise.all([
      getFaqs(studioId),
      getPackages(studioId)
    ]);

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
  const sessionId = asString(req.body.sessionId);
  const studioId = asString(req.body.studioId) || defaultStudioId;

  if (!message) {
    res.status(400).json({
      ok: false,
      error: "Missing message"
    });
    return;
  }

  try {
    const faqs = await getFaqs(studioId);
    const matchedFaq = findFaq(message, faqs);
    const reply = matchedFaq
      ? matchedFaq.answer
      : "这个问题目前需要门店顾问确认。你可以留下联系方式和意向日期，我们会尽快联系你。";
    const needHuman = !matchedFaq;
    const leadIntent = /预约|档期|价格|多少钱|租|定金|联系|咨询|拍摄/.test(message);

    const chatLog = await saveChatMessage({
      studioId,
      sessionId: sessionId || `session-${Date.now()}`,
      userMessage: message,
      reply,
      matchedFaqId: matchedFaq ? matchedFaq.id : null,
      needHuman,
      source: "douyin-miniapp",
      createdAt: new Date()
    });

    res.json({
      ok: true,
      reply,
      matchedFaqId: matchedFaq ? matchedFaq.id : null,
      needHuman,
      leadIntent,
      sessionId: sessionId || null,
      chatLog
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
