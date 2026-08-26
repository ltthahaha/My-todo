const api = require("./services/api")
const { studioConfig } = require("./config/studio")

App({
  globalData: {
    studioName: studioConfig.studioName,
    studioId: studioConfig.studioId,
    douyinAppId: studioConfig.douyinAppId,
    authUser: null
  },

  onLaunch: function () {
    console.log(`${studioConfig.studioName}智能客服小程序启动`)
    api.loginWithDouyin(this.globalData.studioId)
  }
})
