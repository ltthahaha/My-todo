const api = require("../../services/api")
const { getService } = require("../../services/catalog")
const { studioConfig } = require("../../config/studio")
const generalService = {
  key: "general", title: "摄影咨询", icon: "问", description: "AI 咨询助手 · 档期由顾问确认",
  questions: ["套餐参考怎么选？", "有哪些服装和造型？", "拍摄流程是怎样的？", "怎么联系门店顾问？"]
}
const consentKey = "wechat_ai_consent_v1_" + studioConfig.wechatAppId

function decode(value) {
  try { return decodeURIComponent(value || "") } catch (error) { return "" }
}

Page({
  data: {
    sessionId: "", serviceKey: "general", service: generalService,
    messages: [], inputValue: "", quickQuestions: [], isSending: false,
    isInitializing: true, identityError: false, showProfile: false, profileName: "",
    isProfileSaving: false, nickname: "", scrollIntoView: "message-0"
  },

  onLoad(options = {}) {
    this._active = true
    this._options = options
    const service = options.type ? getService(options.type) : generalService
    this.setData({ service, serviceKey: service.key, quickQuestions: service.questions })
    this.initializeChat()
  },

  onUnload() { this._active = false },

  initializeChat() {
    this.setData({ isInitializing: true, identityError: false })
    return api.loginWithWechat().then(auth => {
      if (!this._active) return
      const owner = auth.userId || auth.anonymousId
      this._historyKey = ["wechat_chat", studioConfig.wechatAppId, studioConfig.studioId, owner, this.data.serviceKey].join("_")
      let stored = null
      try { stored = wx.getStorageSync(this._historyKey) } catch (error) { /* Use a new conversation if storage is unavailable. */ }
      const sessionId = stored && stored.sessionId || "wechat-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12)
      const welcome = "你好，我是" + studioConfig.studioName + "的 AI 咨询助手。你可以问我拍摄风格、套餐和流程，具体档期由门店顾问确认。"
      const messages = stored && Array.isArray(stored.messages) && stored.messages.length
        ? stored.messages.filter(item => item && typeof item.text === "string" && ["bot", "user"].includes(item.role)).slice(-40)
        : [{ role: "bot", text: welcome }]
      this.setData({
        sessionId, messages, isInitializing: false, nickname: auth.nickName || "",
        profileName: auth.nickName || "", scrollIntoView: "message-" + (messages.length - 1)
      })
      this.persistHistory()
      if (this._options.question) {
        this.setData({ inputValue: decode(this._options.question) })
        this._options.question = ""
      }
    }).catch(() => {
      if (this._active) this.setData({ isInitializing: false, identityError: true })
    })
  },

  persistHistory() {
    if (!this._historyKey) return
    try {
      wx.setStorageSync(this._historyKey, {
        sessionId: this.data.sessionId,
        messages: this.data.messages.filter(item => !item.pending).slice(-40)
      })
    } catch (error) { /* Server-side history is still used. */ }
  },

  toggleProfile() { this.setData({ showProfile: !this.data.showProfile }) },
  onProfileInput(event) { this.setData({ profileName: event.detail.value }) },
  saveProfile() {
    const nickName = this.data.profileName.trim()
    if (!nickName || this.data.isProfileSaving) return
    this.setData({ isProfileSaving: true })
    api.saveProfile({ nickName }).then(() => {
      if (!this._active) return
      this.setData({ nickname: nickName, showProfile: false })
      wx.showToast({ title: "称呼已保存", icon: "none" })
    }).catch(() => wx.showToast({ title: "暂时无法保存称呼", icon: "none" })).then(() => {
      if (this._active) this.setData({ isProfileSaving: false })
    })
  },

  onInput(event) { this.setData({ inputValue: event.detail.value }) },
  askQuick(event) {
    if (this.data.isSending || this.data.isInitializing || this.data.identityError) return
    this.setData({ inputValue: event.currentTarget.dataset.question }, () => this.sendMessage())
  },

  sendMessage() {
    const question = this.data.inputValue.trim()
    if (!question || this.data.isSending || this.data.isInitializing || this.data.identityError) return
    let consent = false
    try { consent = wx.getStorageSync(consentKey) === true } catch (error) { /* Ask before sending. */ }
    if (!consent) {
      wx.showModal({
        title: "开始 AI 咨询",
        content: "咨询内容会发送至门店客服服务及其 AI 服务商处理并保存。请勿发送身份证、银行卡等敏感信息；主动留下联系方式表示同意门店联系你。",
        confirmText: "同意咨询",
        success: result => {
          if (result.confirm) {
            try { wx.setStorageSync(consentKey, true) } catch (error) { /* Consent applies to this request. */ }
            this.submitMessage(question)
          }
        }
      })
      return
    }
    this.submitMessage(question)
  },

  submitMessage(question) {
    if (!this._active || this.data.isSending) return
    const history = this.data.messages.filter(item => !item.pending && !item.failed).slice(-8)
      .map(item => ({ role: item.role === "bot" ? "assistant" : "user", content: item.text }))
    const messages = this.data.messages.concat(
      { role: "user", text: question },
      { role: "bot", text: "正在结合你的需求整理回复…", pending: true }
    )
    const pendingIndex = messages.length - 1
    this.setData({ messages, inputValue: "", isSending: true, scrollIntoView: "message-" + pendingIndex })
    api.chat({
      sessionId: this.data.sessionId, serviceKey: this.data.serviceKey,
      serviceType: this.data.service.knowledgeType || "", message: question, history
    }).then(response => {
      if (!this._active) return
      if (!response.reply) throw new Error("Empty reply")
      const ai = response.ai || {}
      console.info("chat answer source", {
        answerSource: response.answerSource,
        aiUsed: Boolean(ai.used),
        aiEnabled: Boolean(ai.enabled),
        aiConfigured: Boolean(ai.configured),
        aiFallback: Boolean(ai.fallback),
        aiFallbackReason: ai.fallbackReason || ai.reason || "",
        aiSkipped: Boolean(ai.skipped),
        aiLatencyMs: Number(ai.latencyMs) || null
      })
      this.finishReply(pendingIndex, response.reply, false)
    }).catch(() => {
      if (this._active) this.finishReply(pendingIndex, "这次未能收到回复，请稍后重试，也可以留下咨询信息让顾问联系你。", true)
    })
  },

  finishReply(index, text, failed) {
    const messages = this.data.messages.slice()
    messages[index] = { role: "bot", text, failed }
    this.setData({ messages, isSending: false, scrollIntoView: "message-" + index })
    this.persistHistory()
  },

  openLead() {
    wx.navigateTo({ url: "/pages/lead/lead?type=" + encodeURIComponent(this.data.serviceKey) + "&sessionId=" + encodeURIComponent(this.data.sessionId) })
  },
  openPrivacy() { wx.navigateTo({ url: "/pages/privacy/privacy" }) }
})
