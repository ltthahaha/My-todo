const API_BASE_URL = "https://my-todo-nm067hz9v-ltthahahas-projects.vercel.app"

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

module.exports = {
  chat: function (payload) {
    return request("/api/photo-studio/chat", {
      method: "POST",
      data: payload
    })
  },

  submitLead: function (payload) {
    return request("/api/photo-studio/leads", {
      method: "POST",
      data: payload
    })
  }
}
