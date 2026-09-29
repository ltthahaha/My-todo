const api = require("./services/api")
const { studioConfig } = require("./config/studio")

App({
  globalData: {
    studioName: studioConfig.studioName,
    studioId: studioConfig.studioId,
    wechatAppId: studioConfig.wechatAppId,
    authUser: null
  },

  onLaunch: function () {
    console.log(`${studioConfig.studioName}摄影咨询小程序启动`)
    api.loginWithWechat(this.globalData.studioId, true).catch(() => {
      console.warn("WeChat login unavailable; retry from the chat page")
    })
  }
})
