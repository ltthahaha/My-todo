function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value) {
  return asString(value)
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getRecentUserContext(history) {
  if (!Array.isArray(history)) {
    return "";
  }

  return history
    .filter((item) => item && item.role === "user")
    .slice(-3)
    .map((item) => asString(item.content || item.text))
    .filter(Boolean)
    .join(" ");
}

function scoreText(query, terms, weight) {
  return terms.reduce((score, term) => {
    const normalizedTerm = normalize(term);

    if (normalizedTerm.length < 2 || !query.includes(normalizedTerm)) {
      return score;
    }

    return score + weight + Math.min(normalizedTerm.length, 6);
  }, 0);
}

function serviceMatches(service, category) {
  const normalizedService = normalize(service);
  const normalizedCategory = normalize(category);

  return Boolean(
    normalizedService &&
    normalizedCategory &&
    (
      normalizedService.includes(normalizedCategory) ||
      normalizedCategory.includes(normalizedService)
    )
  );
}

function rankRecords(records, getScore, limit) {
  return records
    .map((record) => ({ record, score: getScore(record) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.record);
}

function retrieveKnowledge({ message, history, faqs, packages, serviceType }) {
  const context = normalize(`${getRecentUserContext(history)} ${message}`);
  const service = normalize(serviceType);
  const priceIntent = /价格|多少钱|预算|费用|报价|贵不贵|便宜|价位/.test(context);
  const bookingIntent = /预约|档期|日期|时间|周末|下个月|今天|明天|定金|改期/.test(context);
  const packageIntent = /套餐|包含|内容|推荐|适合|怎么选/.test(context);

  const relevantFaqs = rankRecords(faqs, (faq) => {
    let score = 0;
    score += scoreText(context, faq.keywords || [], 10);
    score += scoreText(context, [faq.category], 6);
    score += serviceMatches(service, faq.category) ? 8 : 0;

    if (bookingIntent && /预约|档期|定金|改期|时间/.test(`${faq.category} ${(faq.keywords || []).join(" ")}`)) {
      score += 8;
    }

    if (priceIntent && /价格|费用|套餐|预算/.test(`${faq.category} ${(faq.keywords || []).join(" ")}`)) {
      score += 5;
    }

    return score;
  }, 3);

  const relevantPackages = rankRecords(packages, (item) => {
    let score = 0;
    score += scoreText(context, [item.name], 12);
    score += scoreText(context, [item.category], 8);
    score += scoreText(context, item.items || [], 4);
    score += scoreText(context, [item.description], 2);
    score += serviceMatches(service, item.category) ? 10 : 0;

    if (priceIntent) {
      score += 8;
    }

    if (packageIntent) {
      score += 5;
    }

    return score;
  }, 2);

  return {
    faqs: relevantFaqs,
    packages: relevantPackages,
    context: {
      faqIds: relevantFaqs.map((item) => item.id).filter(Boolean),
      packageIds: relevantPackages.map((item) => item.id).filter(Boolean)
    }
  };
}

module.exports = {
  retrieveKnowledge
};
