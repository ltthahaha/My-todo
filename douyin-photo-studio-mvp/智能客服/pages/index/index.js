const app = getApp()

Page({
  data: {
    studioName: app.globalData.studioName,
    services: [
      {
        key: "wedding",
        title: "婚纱照",
        icon: "婚",
        description: "套餐、服装、精修和预约咨询"
      },
      {
        key: "travel",
        title: "旅游照 / 旅拍",
        icon: "旅",
        description: "城市、海边和旅行主题拍摄"
      },
      {
        key: "family",
        title: "亲子照",
        icon: "亲",
        description: "生日、满月和家庭纪实"
      },
      {
        key: "dress",
        title: "婚纱礼服租赁",
        icon: "衣",
        description: "主纱、敬酒服和伴娘服试穿"
      }
    ]
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
