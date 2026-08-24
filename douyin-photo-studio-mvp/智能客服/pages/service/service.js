Page({
  data: {
    title: "服务详情",
    description: "你可以咨询该服务的套餐、价格、服装和预约规则。",
    questions: [
      "这个服务有哪些套餐？",
      "价格大概是多少？",
      "需要提前多久预约？",
      "包含化妆和修图吗？"
    ]
  },

  onLoad: function (options) {
    const serviceMap = {
      wedding: {
        title: "婚纱照",
        description: "了解婚纱照套餐、服装造型、精修数量和拍摄安排。"
      },
      travel: {
        title: "旅游照 / 旅拍",
        description: "了解城市、海边和旅行主题拍摄方案。"
      },
      family: {
        title: "亲子照",
        description: "了解生日、满月和家庭纪实拍摄方案。"
      },
      dress: {
        title: "婚纱礼服租赁",
        description: "了解主纱、敬酒服、伴娘服和试穿安排。"
      }
    }

    const current = serviceMap[options.type] || serviceMap.wedding
    this.setData({
      title: current.title,
      description: current.description
    })
  },

  askQuestion: function (event) {
    const question = event.currentTarget.dataset.question
    tt.navigateTo({
      url: `/pages/chat/chat?question=${encodeURIComponent(question)}`
    })
  },

  openLead: function () {
    tt.navigateTo({
      url: "/pages/lead/lead"
    })
  }
})
