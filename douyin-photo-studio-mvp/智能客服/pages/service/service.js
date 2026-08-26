const { getService } = require("../../services/catalog")

Page({
  data: {
    serviceKey: "wedding",
    service: getService("wedding")
  },

  onLoad: function (options) {
    const current = getService(options.type)
    this.setData({
      serviceKey: current.key,
      service: current
    })
  },

  askQuestion: function (event) {
    const question = event.currentTarget.dataset.question
    const serviceKey = event.currentTarget.dataset.service || this.data.serviceKey
    tt.navigateTo({
      url: `/pages/chat/chat?type=${serviceKey}&question=${encodeURIComponent(question)}`
    })
  },

  openLead: function () {
    tt.navigateTo({
      url: `/pages/lead/lead?type=${this.data.serviceKey}`
    })
  },

  startChat: function () {
    tt.navigateTo({
      url: `/pages/chat/chat?type=${this.data.serviceKey}`
    })
  }
})
