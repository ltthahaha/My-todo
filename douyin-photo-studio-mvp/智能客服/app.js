const api = require("./services/api")

App({
  globalData: {
    studioName: "映白摄影",
    studioId: "demo-studio",
    authUser: null
  },

  onLaunch: function () {
    console.log("映白摄影智能客服小程序启动")
    api.loginWithDouyin(this.globalData.studioId)
  }
})
