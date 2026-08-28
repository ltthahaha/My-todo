const { studioConfig } = require("../config/studio")
const API_BASE_URL = studioConfig.apiBaseUrl
const AUTH_STORAGE_KEY = "photo_studio_douyin_auth"
const ANONYMOUS_STORAGE_KEY = "photo_studio_anonymous_id"

let loginPromise = null

function getAppInstance() {
  try {
    return typeof getApp === "function" ? getApp() : null
  } catch (error) {
    return null
  }
}

function getStorage(key) {
  if (typeof tt === "undefined" || typeof tt.getStorageSync !== "function") {
    return null
  }

  try {
    return tt.getStorageSync(key)
  } catch (error) {
    console.warn("read storage failed", key, error)
    return null
  }
}

function setStorage(key, value) {
  if (typeof tt === "undefined" || typeof tt.setStorageSync !== "function") {
    return
  }

  try {
    tt.setStorageSync(key, value)
  } catch (error) {
    console.warn("write storage failed", key, error)
  }
}

function getAnonymousId() {
  const key = `${ANONYMOUS_STORAGE_KEY}_${studioConfig.studioId}`
  const stored = getStorage(key)

  if (typeof stored === "string" && stored) {
    return stored
  }

  const anonymousId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  setStorage(key, anonymousId)
  return anonymousId
}

function getStoredAuth() {
  const app = getAppInstance()

  if (app && app.globalData && app.globalData.authUser) {
    return app.globalData.authUser
  }

  const stored = getStorage(`${AUTH_STORAGE_KEY}_${studioConfig.studioId}`)
  return stored && typeof stored === "object" ? stored : null
}

function storeAuth(authUser) {
  const app = getAppInstance()

  if (app && app.globalData) {
    app.globalData.authUser = authUser
  }

  setStorage(`${AUTH_STORAGE_KEY}_${studioConfig.studioId}`, authUser)
}

function getAuthUser() {
  return getStoredAuth()
}

function request(path, options = {}) {
  if (!API_BASE_URL) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    tt.request({
      url: `${API_BASE_URL}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "content-type": "application/json",
        ...(options.header || {})
      },
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }

        const error = new Error(`API request failed: ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.responseData = response.data
        console.error("API request failed", path, response.statusCode, response.data)
        reject(error)
      },
      fail: (error) => {
        console.error("API network request failed", path, error)
        reject(error)
      }
    })
  })
}

function loginWithDouyin(studioId) {
  const anonymousId = getAnonymousId()
  const stored = getStoredAuth()

  if (stored && stored.userId && stored.userToken) {
    return Promise.resolve(stored)
  }

  if (loginPromise) {
    return loginPromise
  }

  if (typeof tt === "undefined" || typeof tt.login !== "function") {
    return Promise.resolve({ anonymousId })
  }

  loginPromise = new Promise((resolve) => {
    tt.login({
      success: (result) => {
        const code = result && result.code

        if (!code) {
          resolve({ anonymousId })
          return
        }

        request("/api/photo-studio/auth/login", {
          method: "POST",
          data: {
            studioId,
            douyinAppId: studioConfig.douyinAppId,
            code,
            anonymousId
          }
        }).then((response) => {
          if (response && response.ok && response.user && response.userToken) {
            const authUser = {
              ...response.user,
              userToken: response.userToken,
              anonymousId
            }
            storeAuth(authUser)
            resolve(authUser)
            return
          }

          resolve({ anonymousId })
        }).catch((error) => {
          console.warn("douyin auth login failed", error)
          resolve({ anonymousId })
        })
      },
      fail: (error) => {
        console.warn("tt.login failed", error)
        resolve({ anonymousId })
      }
    })
  })

  loginPromise.then(() => {
    loginPromise = null
  }).catch(() => {
    loginPromise = null
  })

  return loginPromise
}

function withAuth(payload, sender) {
  const data = payload || {}
  const studioId = data.studioId || studioConfig.studioId

  return loginWithDouyin(studioId).then((authUser) => {
    const authPayload = authUser
      ? {
        userId: authUser.userId || "",
        userToken: authUser.userToken || "",
        anonymousId: authUser.anonymousId || getAnonymousId(),
        douyinNickName: authUser.douyinNickName || "",
        douyinAvatarUrl: authUser.douyinAvatarUrl || ""
      }
      : {
        anonymousId: getAnonymousId()
      }

    return sender({
      ...data,
      studioId,
      douyinAppId: data.douyinAppId || studioConfig.douyinAppId,
      ...authPayload
    })
  })
}

module.exports = {
  loginWithDouyin,
  getAuthUser,

  saveProfile: function (profile) {
    return withAuth({}, (data) => {
      if (!data.userId || !data.userToken) {
        return Promise.reject(new Error("Douyin login is required before saving profile"))
      }

      return request("/api/photo-studio/auth/profile", {
        method: "POST",
        data: {
          ...data,
          profile
        }
      }).then((response) => {
        if (response && response.ok && response.user) {
          const authUser = {
            ...getStoredAuth(),
            ...response.user,
            userToken: data.userToken,
            anonymousId: response.user.anonymousId || data.anonymousId
          }
          storeAuth(authUser)
        }

        return response
      })
    })
  },

  chat: function (payload) {
    return withAuth(payload, (data) => request("/api/photo-studio/chat", {
      method: "POST",
      data
    }))
  },

  submitLead: function (payload) {
    return withAuth(payload, (data) => request("/api/photo-studio/leads", {
      method: "POST",
      data
    }))
  }
}
