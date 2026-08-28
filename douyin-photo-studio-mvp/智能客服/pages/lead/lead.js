const api = require("../../services/api")
const { studioConfig } = require("../../config/studio")

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

  onLoad: function (options) {
    const typeIndex = {
      wedding: 0,
      travel: 1,
      family: 2,
      dress: 3
    }
    const index = Object.prototype.hasOwnProperty.call(typeIndex, options.type)
      ? typeIndex[options.type]
      : 0

    this.setData({
      serviceIndex: index,
      serviceType: this.data.serviceOptions[index]
    })
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
      studioId: studioConfig.studioId,
      douyinAppId: studioConfig.douyinAppId,
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
    }).catch((error) => {
      tt.hideLoading()
      console.error("submit lead failed", error)
      tt.showToast({
        title: error && error.statusCode
          ? `提交失败（${error.statusCode}）`
          : "网络请求失败",
        icon: "none"
      })
    })
  },

  goBack: function () {
    tt.navigateBack()
  }
})
