const api = require("../../services/api")
const { getService } = require("../../services/catalog")

const networkErrorAnswer = "当前连接有点慢，请稍后重试，或直接填写预约意向让门店顾问联系你。"
const generalService = {
  key: "general",
  title: "智能客服",
  shortTitle: "在线咨询",
  icon: "问",
  tag: "全品类咨询",
  description: "套餐、价格、预约、出片和租赁问题",
  questions: ["婚纱照多少钱？", "亲子照多久出片？", "可以租婚纱吗？", "怎么预约档期？"]
}

Page({
  data: {
    sessionId: "",
    serviceKey: "general",
    service: generalService,
    messages: [
      {
        role: "bot",
        text: "你好，我是映白摄影智能客服。你可以咨询套餐、价格、服装、出片时间和预约流程。"
      }
    ],
    inputValue: "",
    quickQuestions: generalService.questions,
    isSending: false,
    scrollIntoView: "message-0"
  },

  onLoad: function (options) {
    const current = options.type ? getService(options.type) : generalService
    const welcomeText = current.key === "general"
      ? "你好，我是映白摄影智能客服。你可以咨询套餐、价格、服装、出片时间和预约流程。"
      : `你好，我可以帮你了解${current.title}的套餐、价格和预约安排。你想先了解哪一项呢？`

    this.setData({
      sessionId: `douyin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      serviceKey: current.key,
      service: current,
      messages: [{ role: "bot", text: welcomeText }],
      quickQuestions: current.questions
    }, () => {
      if (options.question) {
        const question = decodeURIComponent(options.question)
        this.setData({ inputValue: question }, () => {
          this.sendMessage()
        })
      }
    })
  },

  onInput: function (event) {
    this.setData({ inputValue: event.detail.value })
  },

  askQuick: function (event) {
    if (this.data.isSending) {
      return
    }

    const question = event.currentTarget.dataset.question
    this.setData({
      inputValue: question
    }, () => {
      this.sendMessage()
    })
  },

  sendMessage: function () {
    const question = this.data.inputValue.trim()

    if (!question || this.data.isSending) {
      return
    }

    const userMessage = { role: "user", text: question }
    const history = this.data.messages
      .slice(-6)
      .map((item) => ({
        role: item.role === "bot" ? "assistant" : "user",
        content: item.text
      }))

    const nextMessages = this.data.messages.concat(userMessage)
    this.setData({
      messages: nextMessages,
      inputValue: "",
      isSending: true,
      scrollIntoView: `message-${nextMessages.length - 1}`
    })

    api.chat({
      studioId: "demo-studio",
      sessionId: this.data.sessionId,
      serviceKey: this.data.serviceKey,
      serviceType: this.data.service.title === "智能客服"
        ? ""
        : this.data.service.title,
      message: question,
      history
    }).then((response) => {
      console.log("chat answer source", {
        answerSource: response && response.answerSource,
        matchType: response && response.matchType,
        ai: response && response.ai
      })
      const reply = response && response.reply
        ? response.reply
        : networkErrorAnswer
      const messages = this.data.messages.concat({ role: "bot", text: reply })

      this.setData({
        messages,
        isSending: false,
        scrollIntoView: `message-${messages.length - 1}`
      })
    }).catch(() => {
      const messages = this.data.messages.concat({
        role: "bot",
        text: networkErrorAnswer
      })

      this.setData({
        messages,
        isSending: false,
        scrollIntoView: `message-${messages.length - 1}`
      })
    })
  },

  openLead: function () {
    const typeQuery = this.data.serviceKey === "general"
      ? ""
      : `?type=${this.data.serviceKey}`
    tt.navigateTo({
      url: `/pages/lead/lead${typeQuery}`
    })
  }
})
