const app = getApp()
const { serviceCatalog } = require("../../services/catalog")

Page({
  data: {
    studioName: app.globalData.studioName,
    services: Object.keys(serviceCatalog).map((key) => serviceCatalog[key]),
    serviceCount: Object.keys(serviceCatalog).length
  },

  goChat: function () {
    wx.navigateTo({
      url: "/pages/chat/chat"
    })
  },

  goService: function (event) {
    const service = event.currentTarget.dataset.service
    wx.navigateTo({
      url: `/pages/service/service?type=${service}`
    })
  }
})
