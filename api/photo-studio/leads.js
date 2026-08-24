function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return {};
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildLeadText(lead) {
  return [
    '新摄影店预约线索',
    `姓名：${lead.name || '未填写'}`,
    `联系方式：${lead.contact}`,
    `拍摄类型：${lead.serviceType || '未填写'}`,
    `意向日期：${lead.preferredDate || '未填写'}`,
    `预算：${lead.budget || '未填写'}`,
    `补充需求：${lead.note || '无'}`,
    `来源：${lead.source || 'douyin-miniapp'}`
  ].join('\n');
}

async function notifyFeishu(text) {
  const webhook = asString(process.env.FEISHU_BOT_WEBHOOK);

  if (!webhook) {
    return { sent: false, reason: 'FEISHU_BOT_WEBHOOK is not configured' };
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msg_type: 'text',
      content: { text }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.code) {
    throw new Error(data?.msg || 'Feishu notification failed');
  }

  return { sent: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = readJsonBody(req);
  const lead = {
    name: asString(body.name),
    contact: asString(body.contact),
    serviceType: asString(body.serviceType),
    preferredDate: asString(body.preferredDate),
    budget: asString(body.budget),
    note: asString(body.note),
    source: asString(body.source) || 'douyin-miniapp',
    createdAt: new Date().toISOString()
  };

  if (!lead.contact) {
    res.status(400).json({ ok: false, error: 'Missing contact' });
    return;
  }

  try {
    const notification = await notifyFeishu(buildLeadText(lead));

    res.status(200).json({
      ok: true,
      leadId: `lead-${Date.now()}`,
      notification,
      stored: false,
      message: notification.sent
        ? 'Lead notification sent'
        : 'Lead validated in demo mode; configure Feishu webhook for notification'
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error.message || 'Lead notification failed'
    });
  }
};
