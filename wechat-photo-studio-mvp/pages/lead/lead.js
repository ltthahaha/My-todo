const api = require("../../services/api")
const { studioConfig } = require("../../config/studio")
const { serviceCatalog } = require("../../services/catalog")
const services = Object.keys(serviceCatalog).map(key => serviceCatalog[key])

Page({
  data: {
    sessionId: "",
    name: "",
    contact: "",
    serviceType: "摄影服务",
    knowledgeServiceType: "婚纱照",
    serviceOptions: services.map(service => service.title),
    serviceIndex: 0,
    preferredDate: "",
    budget: "",
    note: "",
    submitted: false,
    isSubmitting: false,
    consent: false
  },

  onLoad: function (options) {
    const index = Math.max(0, services.findIndex(service => service.key === options.type))

    this.setData({
      sessionId: options.sessionId ? decodeURIComponent(options.sessionId) : "",
      serviceIndex: index,
      serviceType: this.data.serviceOptions[index],
      knowledgeServiceType: services[index].knowledgeType
    })
  },

  onInput: function (event) {
    const field = event.currentTarget.dataset.field
    if (!["name", "contact", "budget", "note"].includes(field)) return
    this.setData({
      [field]: event.detail.value
    })
  },

  chooseService: function (event) {
    const index = Number(event.detail.value)
    if (!services[index]) return
    this.setData({
      serviceIndex: index,
      serviceType: this.data.serviceOptions[index],
      knowledgeServiceType: services[index].knowledgeType
    })
  },

  chooseDate: function (event) {
    this.setData({
      preferredDate: event.detail.value
    })
  },

  submitLead: function () {
    if (this.data.isSubmitting || this.data.submitted) return
    if (!this.data.consent) {
      wx.showToast({ title: "请先同意联系和隐私说明", icon: "none" })
      return
    }
    if (!this.data.contact.trim()) {
      wx.showToast({
        title: "请填写联系信息",
        icon: "none"
      })
      return
    }

    const payload = {
      studioId: studioConfig.studioId,
      platform: "wechat",
      wechatAppId: studioConfig.wechatAppId,
      sessionId: this.data.sessionId,
      name: this.data.name,
      contact: this.data.contact.trim(),
      serviceType: this.data.knowledgeServiceType || this.data.serviceType,
      preferredDate: this.data.preferredDate,
      budget: this.data.budget,
      note: this.data.note,
      source: "wechat-miniapp-consultation",
      consent: true
    }

    this.setData({ isSubmitting: true })
    wx.showLoading({
      title: "提交中"
    })

    api.submitLead(payload).then(() => {
      wx.hideLoading()
      this.setData({ submitted: true, isSubmitting: false })
    }).catch((error) => {
      wx.hideLoading()
      this.setData({ isSubmitting: false })
      console.error("submit lead failed", error)
      wx.showToast({
        title: error && error.statusCode
          ? `提交失败（${error.statusCode}）`
          : "网络请求失败",
        icon: "none"
      })
    })
  },

  onConsent: function (event) {
    this.setData({ consent: event.detail.value.includes("agree") })
  },

  openPrivacy: function () { wx.navigateTo({ url: "/pages/privacy/privacy" }) },

  goBack: function () {
    wx.navigateBack()
  }
})
