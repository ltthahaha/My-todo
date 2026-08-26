const api = require("../../services/api")
const { getService } = require("../../services/catalog")

const fallbackAnswer = "这个问题我还不能确定。你可以填写预约意向，由门店顾问进一步确认。"
const generalService = {
  key: "general",
  title: "智能客服",
  shortTitle: "在线咨询",
  icon: "问",
  tag: "全品类咨询",
  description: "套餐、价格、预约、出片和租赁问题",
  questions: ["婚纱照多少钱？", "亲子照多久出片？", "可以租婚纱吗？", "怎么预约档期？"]
}

const knowledgeBase = [
  {
    keywords: ["婚纱", "婚照", "结婚"],
    answer: "婚纱照轻奢套餐 ¥3999 起，包含 2 套服装造型、80 张底片和 20 张精修。具体档期和加选内容由门店顾问确认。"
  },
  {
    keywords: ["亲子", "宝宝", "家庭"],
    answer: "亲子纪实照 ¥899 起，适合生日、满月和家庭日常记录。通常 1-2 小时完成，出片约 7 个工作日。"
  },
  {
    keywords: ["租", "礼服", "试穿", "押金"],
    answer: "婚纱礼服支持单独租赁，¥299 起/天。主纱、敬酒服和伴娘服都可以预约试穿，押金按具体款式确认。"
  },
  {
    keywords: ["出片", "多久", "照片", "精修"],
    answer: "普通拍摄一般 7 个工作日左右出预览片，精修确认后再交付高清文件，具体以门店排期为准。"
  },
  {
    keywords: ["预约", "档期", "定金"],
    answer: "建议提前 1-2 周预约，婚纱照和节假日档期建议更早。具体定金和改期规则以订单确认为准。"
  }
]

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
    quickQuestions: generalService.questions
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
    const question = event.currentTarget.dataset.question
    this.setData({
      inputValue: question
    }, () => {
      this.sendMessage()
    })
  },

  sendMessage: function () {
    const question = this.data.inputValue.trim()

    if (!question) {
      return
    }

    const hit = knowledgeBase.find((item) => item.keywords.some((keyword) => question.includes(keyword)))
    const userMessage = { role: "user", text: question }
    const history = this.data.messages
      .slice(-6)
      .map((item) => ({
        role: item.role === "bot" ? "assistant" : "user",
        content: item.text
      }))

    this.setData({
      messages: this.data.messages.concat(userMessage),
      inputValue: ""
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
      const reply = response && response.reply
        ? response.reply
        : (hit ? hit.answer : fallbackAnswer)

      this.setData({
        messages: this.data.messages.concat({ role: "bot", text: reply })
      })
    }).catch(() => {
      this.setData({
        messages: this.data.messages.concat({
          role: "bot",
          text: hit ? hit.answer : fallbackAnswer
        })
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
