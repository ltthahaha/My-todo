const LICENSE_API_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return {};
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function matchesExpectedProduct(meta) {
  const expectedProductId = process.env.LEMON_SQUEEZY_PRODUCT_ID;
  const expectedVariantId = process.env.LEMON_SQUEEZY_VARIANT_ID;

  if (expectedProductId && String(meta?.product_id) !== String(expectedProductId)) {
    return false;
  }

  if (expectedVariantId && String(meta?.variant_id) !== String(expectedVariantId)) {
    return false;
  }

  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { licenseKey, instanceId } = readJsonBody(req);
  const key = asString(licenseKey);
  const instance = asString(instanceId);

  if (!key) {
    res.status(400).json({ ok: false, error: 'Missing license key' });
    return;
  }

  const body = new URLSearchParams({
    license_key: key
  });

  if (instance) {
    body.set('instance_id', instance);
  }

  try {
    const response = await fetch(LICENSE_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const data = await response.json();
    const meta = data?.meta || {};
    const license = data?.license_key || {};

    if (!response.ok || !data?.valid || license?.status !== 'active' || !matchesExpectedProduct(meta)) {
      res.status(403).json({ ok: false, error: data?.error || 'License is invalid' });
      return;
    }

    res.status(200).json({
      ok: true,
      licenseKey: license.key || key,
      instanceId: data?.instance?.id || instance || null,
      meta: {
        productId: meta.product_id || null,
        variantId: meta.variant_id || null
      }
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message || 'License service unavailable' });
  }
};
