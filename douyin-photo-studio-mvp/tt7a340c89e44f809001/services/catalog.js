const serviceCatalog = {
  wedding: {
    key: "wedding",
    title: "婚纱照",
    shortTitle: "婚纱",
    icon: "婚",
    accent: "rose",
    tag: "婚礼记录",
    description: "轻奢套餐、服装造型、精修数量和拍摄安排",
    detailDescription: "从选套餐到确定档期，帮你快速了解婚纱照拍摄方案。",
    highlights: [
      "轻奢套餐 ¥3999 起",
      "2 套服装造型",
      "室内棚拍或城市外景"
    ],
    audience: "适合准备结婚、想一次了解套餐与档期的新人",
    priceHint: "¥3999 起",
    questions: [
      "婚纱照多少钱？",
      "有哪些服装和造型？",
      "室内和外景怎么选？",
      "怎么预约档期？"
    ]
  },
  travel: {
    key: "travel",
    title: "旅游照 / 旅拍",
    shortTitle: "旅拍",
    icon: "旅",
    accent: "sky",
    tag: "自然出片",
    description: "城市、海边和旅行主题拍摄方案",
    detailDescription: "根据目的地、时间和风格，了解更适合你的旅拍方案。",
    highlights: [
      "城市、海边等自然场景",
      "旅行主题风格拍摄",
      "地点和档期按需求确认"
    ],
    audience: "适合喜欢自然场景、想把旅行拍成故事的人",
    priceHint: "按地点确认",
    questions: [
      "旅拍有哪些地点？",
      "旅拍通常需要几天？",
      "交通费用怎么算？",
      "什么时候适合拍？"
    ]
  },
  family: {
    key: "family",
    title: "亲子照",
    shortTitle: "亲子",
    icon: "亲",
    accent: "mint",
    tag: "家庭纪念",
    description: "生日、满月和家庭纪实拍摄",
    detailDescription: "记录孩子成长和家人相处的自然瞬间，轻松了解拍摄安排。",
    highlights: [
      "亲子纪实照 ¥899 起",
      "通常 1-2 小时完成",
      "约 7 个工作日出片"
    ],
    audience: "适合生日、满月和想记录家庭日常的客户",
    priceHint: "¥899 起",
    questions: [
      "亲子照多少钱？",
      "宝宝多大适合拍？",
      "多久可以出片？",
      "拍摄前需要准备什么？"
    ]
  },
  dress: {
    key: "dress",
    title: "婚纱礼服租赁",
    shortTitle: "礼服",
    icon: "衣",
    accent: "lavender",
    tag: "试穿租赁",
    description: "主纱、敬酒服和伴娘服试穿租赁",
    detailDescription: "先了解款式、租赁价格和试穿规则，再安排到店体验。",
    highlights: [
      "¥299 起 / 天",
      "主纱、敬酒服、伴娘服",
      "支持提前预约试穿"
    ],
    audience: "适合婚礼、拍摄或活动前需要礼服的客户",
    priceHint: "¥299 起 / 天",
    questions: [
      "可以单独租婚纱吗？",
      "试穿需要预约吗？",
      "押金是多少？",
      "可以提前多久取衣？"
    ]
  }
}

function getService(key) {
  return serviceCatalog[key] || serviceCatalog.wedding
}

module.exports = {
  serviceCatalog,
  getService
}
