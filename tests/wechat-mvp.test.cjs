const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const appId = 'wxdb93d05dc105b2a2';
const studioId = 'xian-west-photo';

function memoryDatabase() {
  const records = { studios: [{ studioId, name: 'Test studio', status: 'active', apiEnabled: true, wechatAppId: appId, douyinAppId: 'tt-test' }] };
  let sequence = 0;
  return {
    records,
    collection(name) {
      const rows = records[name] || (records[name] = []);
      let filter = {};
      let limit = Infinity;
      const query = {
        where(value) { filter = value; return query; },
        limit(value) { limit = value; return query; },
        orderBy() { return query; },
        async get() { return { data: rows.filter(row => Object.entries(filter).every(([key, value]) => row[key] === value)).slice(0, limit) }; },
        async add(record) { const id = 'test-' + (++sequence); rows.push({ ...record, _id: id }); return { id }; },
        doc(id) { return { async update(record) { Object.assign(rows.find(row => row._id === id), record); } }; }
      };
      return query;
    }
  };
}

function server(extraEnv = {}, fetchImpl) {
  const filename = path.join(root, 'cloudbase-photo-studio-api/index.js');
  const realRequire = createRequire(filename);
  const routes = new Map();
  const app = { use() {}, listen() {} };
  for (const method of ['get', 'post', 'patch']) app[method] = (url, ...handlers) => routes.set(method + ' ' + url, handlers.at(-1));
  const express = Object.assign(() => app, { json: () => () => {} });
  const db = memoryDatabase();
  const env = {
    DEFAULT_STUDIO_ID: studioId, WECHAT_APP_ID: appId, WECHAT_APP_SECRET: 'test-app-secret',
    WECHAT_AUTH_TOKEN_SECRET: 'test-wechat-signing-secret-at-least-32-characters',
    DOUYIN_AUTH_TOKEN_SECRET: 'test-douyin-secret', ...extraEnv
  };
  const context = vm.createContext({
    Buffer, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout,
    process: { env }, console: { log() {}, warn() {}, error() {} }, db,
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({ openid: 'test-openid', session_key: 'private-session-key' }) })),
    require(name) {
      if (name === 'express') return express;
      if (name === '@cloudbase/js-sdk') return {};
      if (name === './ai/provider') return { getAvailability: () => ({ enabled: false, configured: false }), generateReply: async () => null };
      return realRequire(name);
    }
  });
  vm.runInContext(fs.readFileSync(filename, 'utf8') + '\nglobalThis.__db = db;', context);
  vm.runInContext('getDatabase = () => __db; globalThis.helpers = { signWechatToken, signUserToken, verifyRequestUser, validateStudioRequest, normalizeSessionState, readSessionState, saveSessionState, captureBookingLead, buildCustomerList, buildCustomerFilter };', context);
  return {
    db, context, helpers: context.helpers,
    async call(url, body = {}, method = 'post') {
      let status = 200, result;
      const res = { status(value) { status = value; return res; }, json(value) { result = value; return res; } };
      await routes.get(method + ' ' + url)({ body, query: {}, params: {} }, res);
      return { status, body: JSON.parse(JSON.stringify(result)) };
    }
  };
}

function client(respond, allowAnonymous = false, failLogin = false) {
  const storage = new Map();
  const requests = [];
  const app = { globalData: {} };
  let logins = 0;
  const context = vm.createContext({
    Promise, Date, Math, module: { exports: {} }, getApp: () => app,
    require: () => ({ studioConfig: { studioId, wechatAppId: appId, apiBaseUrl: 'https://test.invalid', allowAnonymous } }),
    wx: {
      getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
      login: options => { logins++; if (failLogin) options.fail({}); else options.success({ code: 'test-code' }); },
      request: options => { requests.push(options); const data = options.url.endsWith('/wechat-login') ? { statusCode: 200, data: { ok: true, user: { userId: 'wechat_test', isAuthenticated: true }, userToken: 'test-token', expiresIn: 86400 } } : respond(options, requests); options.success(data); }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'wechat-photo-studio-mvp/services/api.js'), 'utf8'), context);
  return { api: context.module.exports, requests, storage, logins: () => logins };
}

test('WeChat project has the requested AppID and every registered page', () => {
  const directory = path.join(root, 'wechat-photo-studio-mvp');
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'project.config.json')));
  const app = JSON.parse(fs.readFileSync(path.join(directory, 'app.json')));
  assert.equal(config.appid, appId);
  for (const page of app.pages) for (const ext of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(directory, page + '.' + ext)));
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.(js|json|wxml|wxss)$/.test(file)) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /\btt[.:]|douyinAppId|syncDouyinProfile|wx\.getUserProfile|<br\s*\//);
        if (file.endsWith('.json')) JSON.parse(source);
        if (file.endsWith('.js')) new vm.Script(source, { filename: file });
      }
    }
  }
  scan(directory);
});

test('login exchanges code on server and never returns platform secrets', async () => {
  let requestedUrl;
  const s = server({}, async (url, options) => {
    requestedUrl = new URL(url);
    assert.ok(options.signal);
    return { ok: true, status: 200, json: async () => ({ openid: 'openid-a', session_key: 'private-session-key' }) };
  });
  const response = await s.call('/api/photo-studio/auth/wechat-login', { studioId, wechatAppId: appId, code: 'code-a', anonymousId: 'anon-a' });
  assert.equal(response.status, 200);
  assert.match(response.body.user.userId, /^wechat_/);
  assert.ok(response.body.userToken);
  assert.equal(response.body.expiresIn, 86400);
  assert.equal(requestedUrl.searchParams.get('js_code'), 'code-a');
  assert.doesNotMatch(JSON.stringify(response.body), /private-session-key|test-app-secret|openid-a/);
  assert.equal(s.db.records.wechat_users.length, 1);
});

test('login requires signing configuration, an AppID binding and a valid code', async () => {
  const s = server({ WECHAT_AUTH_TOKEN_SECRET: '' });
  assert.equal((await s.call('/api/photo-studio/auth/wechat-login', { code: 'test' })).status, 503);
  assert.equal((await s.call('/api/photo-studio/auth/wechat-login')).status, 400);
  assert.equal((await s.helpers.validateStudioRequest(studioId, 'wx-other', 'wechat')).ok, false);
  assert.equal((await s.helpers.validateStudioRequest(studioId, '', 'wechat')).ok, false);
});

test('WeChat tokens cannot be reused across apps, stores, users or platforms', () => {
  const s = server();
  const userId = 'wechat_a';
  const userToken = s.helpers.signWechatToken(studioId, appId, userId);
  const body = { platform: 'wechat', wechatAppId: appId, userId, userToken };
  assert.equal(s.helpers.verifyRequestUser(body, studioId).isAuthenticated, true);
  for (const patch of [{ wechatAppId: 'wx-other' }, { userId: 'wechat_b' }, { platform: 'douyin-miniapp' }, { userToken: userToken + 'x' }]) {
    assert.equal(s.helpers.verifyRequestUser({ ...body, ...patch }, studioId).isAuthenticated, false);
  }
  assert.equal(s.helpers.verifyRequestUser(body, 'other-store').isAuthenticated, false);
  const expired = Buffer.from(JSON.stringify({ studioId, appId, userId, exp: 1 })).toString('base64url');
  const signature = require('node:crypto').createHmac('sha256', s.context.process.env.WECHAT_AUTH_TOKEN_SECRET).update(expired).digest('hex');
  assert.equal(s.helpers.verifyRequestUser({ ...body, userToken: expired + '.' + signature }, studioId).isAuthenticated, false);
});

test('legacy Douyin tokens and studio validation continue to work', async () => {
  const s = server();
  const body = { userId: 'douyin_a', userToken: s.helpers.signUserToken(studioId, 'douyin_a') };
  assert.equal(s.helpers.verifyRequestUser(body, studioId).isAuthenticated, true);
  assert.equal(s.helpers.verifyRequestUser({ ...body, platform: 'wechat', wechatAppId: appId }, studioId).isAuthenticated, false);
  assert.equal((await s.helpers.validateStudioRequest(studioId, 'tt-test')).ok, true);
  assert.equal((await s.helpers.validateStudioRequest(studioId, 'tt-wrong')).ok, false);
});

test('identical session IDs cannot expose a different WeChat customer history', async () => {
  const s = server();
  const state = { studioId, sessionId: 'same-session', platform: 'wechat', wechatAppId: appId, userId: 'wechat_a', contact: 'private-a' };
  await s.helpers.saveSessionState(state);
  assert.equal((await s.helpers.readSessionState(studioId, 'same-session', state)).contact, 'private-a');
  assert.equal(await s.helpers.readSessionState(studioId, 'same-session', { ...state, userId: 'wechat_b' }), null);
  await s.helpers.saveSessionState({ ...state, userId: 'wechat_b', contact: 'private-b' });
  assert.equal(s.db.records.chat_sessions.length, 2);
  assert.equal((await s.helpers.readSessionState(studioId, 'same-session', state)).contact, 'private-a');
});

test('booking deduplication is scoped to the WeChat customer', async () => {
  const s = server();
  const input = { studioId, sessionId: 'same-session', platform: 'wechat', wechatAppId: appId, message: 'test', sessionState: { contact: 'test-contact' } };
  const first = await s.helpers.captureBookingLead({ ...input, user: { userId: 'wechat_a' } });
  const repeat = await s.helpers.captureBookingLead({ ...input, user: { userId: 'wechat_a' } });
  const other = await s.helpers.captureBookingLead({ ...input, user: { userId: 'wechat_b' } });
  assert.equal(first.stored, true);
  assert.equal(repeat.deduplicated, true);
  assert.equal(other.deduplicated, false);
});

test('production rejects anonymous WeChat requests; explicit demo mode works', async () => {
  const s = server();
  const payload = { studioId, wechatAppId: appId, platform: 'wechat', anonymousId: 'anon-test', sessionId: 'test-session', message: '你好' };
  assert.equal((await s.call('/api/photo-studio/chat', payload)).status, 401);
  const demo = server({ WECHAT_ALLOW_ANONYMOUS: 'true' });
  const result = await demo.call('/api/photo-studio/chat', payload);
  assert.equal(result.status, 200);
  assert.equal(result.body.studio.wechatAppId, appId);
  assert.equal(result.body.user.isAuthenticated, false);
  assert.equal(demo.db.records.chat_messages[0].source, 'wechat-miniapp');
  assert.equal(demo.db.records.chat_sessions[0].platform, 'wechat');
});

test('client sends WeChat identity fields only', async () => {
  const c = client(() => ({ statusCode: 200, data: { ok: true, reply: 'test' } }));
  await c.api.loginWithWechat();
  await c.api.chat({ message: 'test' });
  const payload = c.requests.at(-1).data;
  assert.equal(payload.platform, 'wechat');
  assert.equal(payload.wechatAppId, appId);
  assert.equal(payload.userToken, 'test-token');
  assert.equal('douyinAppId' in payload, false);
  assert.equal(c.logins(), 1);
});

test('authenticated WeChat lead is stored and missing database cannot report success', async () => {
  const s = server();
  const userId = 'wechat_a';
  const payload = { studioId, wechatAppId: appId, platform: 'wechat', userId, userToken: s.helpers.signWechatToken(studioId, appId, userId), contact: 'test-contact', nickName: 'Alice' };
  const result = await s.call('/api/photo-studio/leads', payload);
  assert.equal(result.status, 200);
  assert.equal(result.body.stored, true);
  assert.equal(s.db.records.leads[0].source, 'wechat-miniapp');
  assert.equal(s.db.records.leads[0].douyinAppId, '');
  s.context.__db = null;
  const failed = await s.call('/api/photo-studio/leads', payload);
  assert.equal(failed.status, 503);
  assert.equal(failed.body.stored, false);
});

test('WeChat profile stays out of Douyin fields in admin summaries', () => {
  const s = server();
  const customers = s.helpers.buildCustomerList({ sessions: [], messages: [], leads: [], users: [{ userId: 'wechat_a', platform: 'wechat', nickName: 'Alice' }] });
  assert.equal(customers[0].wechatNickName, 'Alice');
  assert.equal(customers[0].douyinNickName, '');
  assert.equal(customers[0].platform, 'wechat');
  assert.equal(s.helpers.buildCustomerFilter(studioId, 'wechat_a').userId, 'wechat_a');
});

test('client rejects logical errors and unstored leads', async () => {
  for (const data of [{ ok: false }, { ok: true, stored: false }]) {
    const c = client(() => ({ statusCode: 200, data }));
    await assert.rejects(c.api.submitLead({ contact: 'test' }));
  }
});

test('client refreshes rejected identity once without retrying server failures', async () => {
  let chatRequests = 0;
  const c = client(() => {
    chatRequests++;
    return chatRequests === 1 ? { statusCode: 401, data: { ok: false } } : { statusCode: 200, data: { ok: true, reply: 'ok' } };
  });
  assert.equal((await c.api.chat({ message: 'test' })).reply, 'ok');
  assert.equal(c.logins(), 2);
  const failing = client(() => ({ statusCode: 502, data: { ok: false } }));
  await assert.rejects(failing.api.submitLead({ contact: 'test' }));
  assert.equal(failing.requests.length, 2);
});

test('anonymous fallback requires explicit client opt-in', async () => {
  await assert.rejects(client(() => {}, false, true).api.loginWithWechat());
  const demo = client(() => {}, true, true);
  const first = await demo.api.loginWithWechat();
  const second = await demo.api.loginWithWechat();
  assert.equal(first.anonymousId, second.anonymousId);
  assert.equal(first.isAuthenticated, false);
  assert.equal(demo.logins(), 1);
});
