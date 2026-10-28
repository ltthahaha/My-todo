const test = require("node:test");
const assert = require("node:assert/strict");

const providerPath = require.resolve("../cloudbase-photo-studio-api/ai/provider");
const provider = require(providerPath);

const originalEnv = {
  AI_ENABLED: process.env.AI_ENABLED,
  ARK_API_KEY: process.env.ARK_API_KEY,
  ARK_MODEL: process.env.ARK_MODEL,
  ARK_BASE_URL: process.env.ARK_BASE_URL,
  AI_DEBUG_RAW_RESPONSE: process.env.AI_DEBUG_RAW_RESPONSE
};
const originalFetch = global.fetch;

function useConfiguredProvider() {
  process.env.AI_ENABLED = "true";
  process.env.ARK_API_KEY = "test-key";
  process.env.ARK_MODEL = "test-model";
  process.env.ARK_BASE_URL = "https://provider.invalid/v1/chat/completions";
  process.env.AI_DEBUG_RAW_RESPONSE = "false";
}

test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = originalFetch;
});

test("classifies provider HTTP failures instead of hiding them as generic request failures", async () => {
  useConfiguredProvider();
  global.fetch = async () => ({
    ok: false,
    status: 401,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify({ error: { code: "AuthenticationError" } })
  });

  const result = await provider.generateReply({
    message: "请介绍一下套餐",
    history: [],
    faqs: [],
    packages: [],
    serviceType: "婚纱照"
  });

  assert.equal(result.unavailable, true);
  assert.equal(result.reason, "AI provider returned HTTP 401");
});
