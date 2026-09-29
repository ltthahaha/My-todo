const serviceCatalog = {
  wedding: {
    key: "wedding",
    title: "摄影服务",
    shortTitle: "摄影",
    knowledgeType: "婚纱照",
    icon: "影",
    accent: "rose",
    tag: "影像记录",
    description: "作品风格、套餐参考、服装造型和拍摄流程",
    detailDescription: "先了解作品方向、套餐参考和拍摄流程，再联系门店顾问获取适合你的建议。",
    highlights: [
      "作品风格与拍摄方向",
      "服装造型与拍摄安排",
      "室内棚拍或城市外景",
      "具体服务内容以门店顾问确认结果为准"
    ],
    audience: "适合想了解摄影作品、服务内容和拍摄流程的客户",
    priceHint: "在线咨询",
    questions: [
      "有哪些作品风格？",
      "套餐参考包含什么？",
      "室内和外景怎么选？",
      "拍摄流程是怎样的？"
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
