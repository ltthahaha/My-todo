const faq = require('../../data/faq.json');

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return {};
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function findFaq(message) {
  const normalized = message.toLowerCase();
  return faq.find((item) =>
    Array.isArray(item.keywords) &&
    item.keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()))
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = readJsonBody(req);
  const message = asString(body.message);
  const sessionId = asString(body.sessionId);

  if (!message) {
    res.status(400).json({ ok: false, error: 'Missing message' });
    return;
  }

  const matchedFaq = findFaq(message);
  const reply = matchedFaq
    ? matchedFaq.answer
    : '这个问题目前需要门店顾问确认。你可以留下联系方式和意向日期，我们会尽快联系你。';

  res.status(200).json({
    ok: true,
    reply,
    matchedFaqId: matchedFaq?.id || null,
    needHuman: !matchedFaq,
    leadIntent: Boolean(
      /预约|档期|价格|多少钱|租|定金|联系|咨询|拍摄/.test(message)
    ),
    sessionId: sessionId || null,
    source: 'knowledge-base'
  });
};
