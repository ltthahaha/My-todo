const api = require("../../services/api")

Page({
  data: {
    name: "",
    contact: "",
    serviceType: "婚纱照",
    serviceOptions: ["婚纱照", "旅游照 / 旅拍", "亲子照", "婚纱礼服租赁"],
    serviceIndex: 0,
    preferredDate: "",
    budget: "",
    note: "",
    submitted: false
  },

  onInput: function (event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [field]: event.detail.value
    })
  },

  chooseService: function (event) {
    const index = Number(event.detail.value)
    this.setData({
      serviceIndex: index,
      serviceType: this.data.serviceOptions[index]
    })
  },

  chooseDate: function (event) {
    this.setData({
      preferredDate: event.detail.value
    })
  },

  submitLead: function () {
    if (!this.data.contact) {
      tt.showToast({
        title: "请填写联系方式",
        icon: "none"
      })
      return
    }

    const payload = {
      studioId: "demo-studio",
      name: this.data.name,
      contact: this.data.contact,
      serviceType: this.data.serviceType,
      preferredDate: this.data.preferredDate,
      budget: this.data.budget,
      note: this.data.note,
      source: "douyin-miniapp"
    }

    tt.showLoading({
      title: "提交中"
    })

    api.submitLead(payload).then(() => {
      tt.hideLoading()
      this.setData({ submitted: true })
    }).catch(() => {
      tt.hideLoading()
      tt.showToast({
        title: "提交失败，请稍后再试",
        icon: "none"
      })
    })
  },

  goBack: function () {
    tt.navigateBack()
  }
})
