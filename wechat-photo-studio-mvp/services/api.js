const { studioConfig } = require("../config/studio")
const scope = studioConfig.wechatAppId + "_" + studioConfig.studioId
const authKey = "photo_studio_wechat_auth_" + scope
const anonymousKey = "photo_studio_wechat_anon_" + scope
let loginPromise = null
let currentAuth = null
let retryAfter = 0

function readStorage(key) {
  try { return wx.getStorageSync(key) } catch (error) { return null }
}

function writeStorage(key, value) {
  try { wx.setStorageSync(key, value) } catch (error) { /* Storage can be unavailable in private mode. */ }
}

function getAnonymousId() {
  const stored = readStorage(anonymousKey)
  if (typeof stored === "string" && stored) return stored
  const id = "anon-wechat-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12)
  writeStorage(anonymousKey, id)
  return id
}

function storeAuth(value) {
  currentAuth = value
  writeStorage(authKey, value)
  const app = typeof getApp === "function" ? getApp() : null
  if (app && app.globalData) app.globalData.authUser = value
}

function getAuthUser() {
  return currentAuth || readStorage(authKey) || null
}

function request(path, options = {}) {
  if (!studioConfig.apiBaseUrl) return Promise.reject(new Error("请先配置客服服务地址"))
  return new Promise((resolve, reject) => {
    wx.request({
      url: studioConfig.apiBaseUrl.replace(/\/$/, "") + path,
      method: options.method || "POST",
      timeout: options.timeout || 25000,
      data: options.data || {},
      header: { "content-type": "application/json" },
      success(response) {
        const data = response.data
        if (response.statusCode >= 200 && response.statusCode < 300 && data && data.ok === true) {
          resolve(data)
          return
        }
        const error = new Error(data && data.error || "服务暂时不可用，请稍后重试")
        error.statusCode = response.statusCode
        reject(error)
      },
      fail() { reject(new Error("网络连接失败，请稍后重试")) }
    })
  })
}

function loginWithWechat(studioId = studioConfig.studioId, force = false) {
  if (studioId !== studioConfig.studioId) return Promise.reject(new Error("门店配置不一致"))
  if (loginPromise) return loginPromise
  const stored = getAuthUser()
  if (!force && stored && stored.userToken && stored.expiresAt > Date.now() + 60000) {
    return Promise.resolve(stored)
  }
  const anonymous = { anonymousId: getAnonymousId(), platform: "wechat", isAuthenticated: false }
  if (!force && retryAfter > Date.now() && studioConfig.allowAnonymous) return Promise.resolve(anonymous)
  loginPromise = new Promise((resolve, reject) => {
    wx.login({
      timeout: 8000,
      success(result) {
        if (result && result.code) resolve(result.code)
        else reject(new Error("微信登录未完成，请重试"))
      },
      fail() { reject(new Error("微信登录失败，请重试")) }
    })
  }).then(code => request("/api/photo-studio/auth/wechat-login", {
    timeout: 10000,
    data: { platform: "wechat", studioId, wechatAppId: studioConfig.wechatAppId, code, anonymousId: anonymous.anonymousId }
  })).then(response => {
    if (!response.user || !response.user.userId || !response.userToken) throw new Error("登录响应不完整")
    const auth = Object.assign({}, response.user, {
      anonymousId: anonymous.anonymousId,
      platform: "wechat",
      userToken: response.userToken,
      expiresAt: Date.now() + Number(response.expiresIn || 86400) * 1000
    })
    retryAfter = 0
    storeAuth(auth)
    return auth
  }).catch(error => {
    storeAuth(null)
    if (!studioConfig.allowAnonymous) throw error
    retryAfter = Date.now() + 60000
    return anonymous
  }).then(value => { loginPromise = null; return value }, error => { loginPromise = null; throw error })
  return loginPromise
}

function withAuth(payload, path, retry = true) {
  return loginWithWechat().then(auth => request(path, {
    data: Object.assign({}, payload, {
      platform: "wechat", studioId: studioConfig.studioId, wechatAppId: studioConfig.wechatAppId,
      userId: auth.userId || "", userToken: auth.userToken || "",
      anonymousId: auth.anonymousId || getAnonymousId(),
      nickName: auth.nickName || "", avatarUrl: auth.avatarUrl || ""
    })
  })).catch(error => {
    // A rejected identity has no side effects; retry once with a fresh login.
    if (retry && error.statusCode === 401) {
      storeAuth(null)
      return loginWithWechat(studioConfig.studioId, true).then(() => withAuth(payload, path, false))
    }
    throw error
  })
}

module.exports = {
  loginWithWechat, getAuthUser,
  saveProfile(profile) {
    return withAuth({ profile }, "/api/photo-studio/auth/wechat-profile").then(response => {
      storeAuth(Object.assign({}, getAuthUser(), response.user))
      return response
    })
  },
  chat(payload) { return withAuth(payload, "/api/photo-studio/chat") },
  submitLead(payload) {
    return withAuth(payload, "/api/photo-studio/leads").then(response => {
      if (response.stored !== true) throw new Error("咨询信息尚未保存，请稍后重试")
      return response
    })
  }
}
