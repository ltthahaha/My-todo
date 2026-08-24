const API_BASE_URL = ""

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

        reject(new Error(`API request failed: ${response.statusCode}`))
      },
      fail: reject
    })
  })
}

module.exports = {
  chat: function (payload) {
    return request("/api/chat", {
      method: "POST",
      data: payload
    })
  },

  submitLead: function (payload) {
    return request("/api/leads", {
      method: "POST",
      data: payload
    })
  }
}
