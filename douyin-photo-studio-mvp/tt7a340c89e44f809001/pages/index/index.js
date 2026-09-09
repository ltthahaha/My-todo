const app = getApp()
const { serviceCatalog } = require("../../services/catalog")

Page({
  data: {
    studioName: app.globalData.studioName,
    services: Object.keys(serviceCatalog).map((key) => serviceCatalog[key])
  },

  goChat: function () {
    tt.navigateTo({
      url: "/pages/chat/chat"
    })
  },

  goService: function (event) {
    const service = event.currentTarget.dataset.service
    tt.navigateTo({
      url: `/pages/service/service?type=${service}`
    })
  }
})
