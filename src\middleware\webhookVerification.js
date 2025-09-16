// webhookVerification.js
const crypto = require('crypto');
const getRawBody = require('raw-body');

const verifyWebhookSignature = async (req, res, next) => {
  try {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    
    if (!hmacHeader || !topic || !shopDomain) {
      console.log('Missing required webhook headers');
      return res.status(401).send('Unauthorized');
    }

    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Get webhook secret from environment or database
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    // Calculate HMAC
    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('base64');
    
    // Compare signatures
    if (hash !== hmacHeader) {
      console.log('Webhook signature verification failed');
      return res.status(401).send('Unauthorized');
    }
    
    // Parse body and attach to request
    req.body = JSON.parse(rawBody.toString('utf8'));
    req.webhookTopic = topic;
    req.shopDomain = shopDomain;
    
    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = { verifyWebhookSignature };
