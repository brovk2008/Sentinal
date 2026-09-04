const https = require('https');

module.exports = (cronDetails, context) => {
  const targetUrl = 'https://sentinal-backend-50043676705.development.catalystappsail.in/health';
  console.log(`[KeepAlive] Sending heartbeat ping to AppSail backend at: ${targetUrl}`);

  const req = https.get(targetUrl, { timeout: 25000 }, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      console.log(`[KeepAlive] AppSail responded with HTTP ${res.statusCode}: ${rawData}`);
      context.closeWithSuccess();
    });
  });

  req.on('error', (err) => {
    console.error(`[KeepAlive] Ping failed: ${err.message}`);
    // Non-fatal error report
    context.closeWithSuccess();
  });

  req.on('timeout', () => {
    console.warn('[KeepAlive] Request timed out, destroying socket');
    req.destroy();
    context.closeWithSuccess();
  });
};
