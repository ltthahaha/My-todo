const serviceCatalog = {
  wedding: {
    key: "wedding",
    title: "婚纱照",
    shortTitle: "婚纱",
    icon: "婚",
    accent: "rose",
    tag: "婚礼记录",
    description: "十服十造、内外景双拍和婚纱照交付安排",
    detailDescription: "西安婚纱照拍摄，先了解风格、套餐和档期，再由门店客服确认方案。",
    highlights: [
      "主推套餐 ¥3999 十服十造",
      "提供 150 张拍摄照片",
      "内外景双拍，底片全部赠送",
      "相册、相框、摆台等资料所列项目"
    ],
    audience: "适合准备结婚、想一次了解套餐与档期的新人",
    priceHint: "¥3999 主推",
    questions: [
      "婚纱照有哪些风格？",
      "3999 元套餐包含什么？",
      "室内和外景怎么选？",
      "怎么预约档期？"
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
