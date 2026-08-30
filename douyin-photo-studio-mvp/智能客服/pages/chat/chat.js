const api = require("../../services/api")
const { getService } = require("../../services/catalog")
const { studioConfig } = require("../../config/studio")

const networkErrorAnswer = "当前连接有点慢，请稍后重试，或直接填写预约意向让门店顾问联系你。"
const quickFirstAnswer = "我正在结合门店套餐和你的需求整理回复..."
const sessionStoragePrefix = "photo_studio_chat_session_"
const generalService = {
  key: "general",
  title: "智能客服",
  shortTitle: "在线咨询",
  icon: "问",
  tag: "全品类咨询",
  description: "套餐、价格、预约、出片和租赁问题",
  questions: ["婚纱照多少钱？", "亲子照多久出片？", "可以租婚纱吗？", "怎么预约档期？"]
}

function getStoredSessionId(serviceKey) {
  if (typeof tt === "undefined" || typeof tt.getStorageSync !== "function") {
    return ""
  }

  const key = `${sessionStoragePrefix}${serviceKey}`

  try {
    const result = tt.getStorageSync(key)
    return typeof result === "string" ? result : ""
  } catch (error) {
    console.warn("read chat session failed", error)
    return ""
  }
}

function storeSessionId(serviceKey, sessionId) {
  if (
    typeof tt === "undefined" ||
    typeof tt.setStorageSync !== "function" ||
    !sessionId
  ) {
    return
  }

  const key = `${sessionStoragePrefix}${serviceKey}`

  try {
    tt.setStorageSync(key, sessionId)
  } catch (error) {
    console.warn("store chat session failed", error)
  }
}

Page({
  data: {
    sessionId: "",
    serviceKey: "general",
    service: generalService,
    messages: [
      {
        role: "bot",
        text: `你好，我是${studioConfig.studioName}智能客服。你可以咨询套餐、价格、服装、出片时间和预约流程。`
      }
    ],
    inputValue: "",
    quickQuestions: generalService.questions,
    isSending: false,
    isProfileSaving: false,
    profileSynced: false,
    douyinNickName: "",
    douyinAvatarUrl: "",
    scrollIntoView: "message-0"
  },

  onLoad: function (options) {
    const current = options.type ? getService(options.type) : generalService
    const sessionId = getStoredSessionId(current.key) ||
      `douyin-${current.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const welcomeText = current.key === "general"
      ? `你好，我是${studioConfig.studioName}智能客服。你可以咨询套餐、价格、服装、出片时间和预约流程。`
      : `你好，我可以帮你了解${current.title}的套餐、价格和预约安排。你想先了解哪一项呢？`

    this.setData({
      sessionId,
      serviceKey: current.key,
      service: current,
      messages: [{ role: "bot", text: welcomeText }],
      quickQuestions: current.questions,
      ...this.getStoredProfileState()
    }, () => {
      storeSessionId(current.key, sessionId)
      if (options.question) {
        const question = decodeURIComponent(options.question)
        this.setData({ inputValue: question }, () => {
          this.sendMessage()
        })
      }
    })
  },

  getStoredProfileState: function () {
    const authUser = api.getAuthUser ? api.getAuthUser() : null
    const nickName = authUser && authUser.douyinNickName
      ? authUser.douyinNickName
      : ""
    const avatarUrl = authUser && authUser.douyinAvatarUrl
      ? authUser.douyinAvatarUrl
      : ""

    return {
      profileSynced: Boolean(nickName || avatarUrl),
      douyinNickName: nickName,
      douyinAvatarUrl: avatarUrl
    }
  },

  syncDouyinProfile: function () {
    if (this.data.isProfileSaving) {
      return
    }

    if (typeof tt === "undefined" || typeof tt.getUserProfile !== "function") {
      tt.showToast({
        title: "当前版本暂不支持授权",
        icon: "none"
      })
      return
    }

    this.setData({ isProfileSaving: true })
    tt.getUserProfile({
      desc: "用于在客服后台识别咨询客户",
      success: (result) => {
        const profile = result && result.userInfo ? result.userInfo : result
        api.saveProfile(profile).then((response) => {
          const user = response && response.user ? response.user : {}
          this.setData({
            isProfileSaving: false,
            profileSynced: true,
            douyinNickName: user.douyinNickName || profile.nickName || "",
            douyinAvatarUrl: user.douyinAvatarUrl || profile.avatarUrl || ""
          })
          tt.showToast({
            title: "抖音资料已同步",
            icon: "none"
          })
        }).catch((error) => {
          console.warn("save douyin profile failed", error)
          this.setData({ isProfileSaving: false })
          tt.showToast({
            title: "同步失败，请稍后重试",
            icon: "none"
          })
        })
      },
      fail: (error) => {
        console.warn("get douyin profile failed", error)
        this.setData({ isProfileSaving: false })
        tt.showToast({
          title: "已取消授权",
          icon: "none"
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
    const pendingMessage = {
      role: "bot",
      text: quickFirstAnswer,
      pending: true
    }
    const history = this.data.messages
      .slice(-6)
      .map((item) => ({
        role: item.role === "bot" ? "assistant" : "user",
        content: item.text
      }))

    const nextMessages = this.data.messages.concat(userMessage, pendingMessage)
    const pendingIndex = nextMessages.length - 1

    this.setData({
      messages: nextMessages,
      inputValue: "",
      isSending: true,
      scrollIntoView: `message-${pendingIndex}`
    })

    api.chat({
      studioId: studioConfig.studioId,
      douyinAppId: studioConfig.douyinAppId,
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
        knowledgeMatch: response && response.knowledgeMatch,
        matchType: response && response.matchType,
        session: response && response.session,
        ai: response && response.ai
      })
      const reply = response && response.reply
        ? response.reply
        : networkErrorAnswer
      const messages = this.data.messages.slice()
      messages[pendingIndex] = { role: "bot", text: reply }

      this.setData({
        messages,
        isSending: false,
        scrollIntoView: `message-${messages.length - 1}`
      })
    }).catch((error) => {
      console.error("chat request failed", error)
      const messages = this.data.messages.slice()
      messages[pendingIndex] = { role: "bot", text: networkErrorAnswer }

      this.setData({
        messages,
        isSending: false,
        scrollIntoView: `message-${messages.length - 1}`
      })
    })
  },

  openLead: function () {
    const query = []
    if (this.data.serviceKey !== "general") {
      query.push(`type=${encodeURIComponent(this.data.serviceKey)}`)
    }
    if (this.data.sessionId) {
      query.push(`sessionId=${encodeURIComponent(this.data.sessionId)}`)
    }
    tt.navigateTo({
      url: `/pages/lead/lead${query.length ? `?${query.join("&")}` : ""}`
    })
  }
})
