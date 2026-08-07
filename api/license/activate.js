const LICENSE_API_URL = 'https://payhip.com/api/v2/license/verify';
const EXPECTED_PRODUCT_KEY = process.env.PAYHIP_PRODUCT_KEY || '4pF7G';

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return {};
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasPayhipSecret() {
  return Boolean(asString(process.env.PAYHIP_PRODUCT_SECRET_KEY));
}

async function verifyPayhipLicense(licenseKey) {
  const url = new URL(LICENSE_API_URL);
  url.searchParams.set('license_key', licenseKey);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'product-secret-key': process.env.PAYHIP_PRODUCT_SECRET_KEY
    }
  });

  const data = await response.json();
  const license = data?.data || {};

  if (!response.ok || !license?.enabled || String(license.product_link) !== String(EXPECTED_PRODUCT_KEY)) {
    return {
      ok: false,
      error: data?.error || 'License verification failed'
    };
  }

  return {
    ok: true,
    license
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { licenseKey } = readJsonBody(req);
  const key = asString(licenseKey);

  if (!key) {
    res.status(400).json({ ok: false, error: 'Missing license key' });
    return;
  }

  if (!hasPayhipSecret()) {
    res.status(500).json({ ok: false, error: 'Missing Payhip product secret key' });
    return;
  }

  try {
    const result = await verifyPayhipLicense(key);

    if (!result.ok) {
      res.status(403).json({ ok: false, error: result.error });
      return;
    }

    res.status(200).json({
      ok: true,
      licenseKey: result.license.license_key || key,
      meta: {
        productKey: result.license.product_link || null,
        buyerEmail: result.license.buyer_email || null
      }
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message || 'License service unavailable' });
  }
};
