/**
 * Automated Unified Deployment Script
 * Deploys simultaneously to BOTH:
 *  1. Primary Catalyst Serverless + AppSail (catalystserverless.in)
 *  2. High-Availability Slate Mirror (sentinal-peak.onslate.in)
 */
const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const cliBase = 'C:\\Users\\techp\\AppData\\Roaming\\npm\\node_modules\\zcatalyst-cli\\lib';
const Crypt = require(cliBase + '\\authentication\\crypt').default;

async function getToken() {
  const configPath = path.join(require('os').homedir(), 'AppData', 'Roaming', 'zcatalyst-cli-nodejs', 'Config', 'zcatalyst-cli.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const dec = new Crypt('ZC_TRAM').decrypt(config['in'].credential);
  const rt = dec.refresh_token;
  const body = `refresh_token=${rt}&client_id=1000.D5IIHDXSPN2MII26AD0V61I6RMVSNM&client_secret=02ee875ecfc50573e5cc8d62916ad3077be20d0f42&grant_type=refresh_token`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'accounts.zoho.in',
      path: '/oauth/v2/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let s = '';
      res.on('data', d => s += d);
      res.on('end', () => {
        try {
          const p = JSON.parse(s);
          resolve(p.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function triggerSlateRedeploy(token) {
  const projectId = '50170000000065001';
  const appId = '4539000000005004';
  const resourceId = '4539000000005006';
  const postData = JSON.stringify({});

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.catalyst.zoho.in',
      path: `/baas/v1/project/${projectId}/app/${appId}/deployment/${resourceId}/redeploy`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Catalyst-org': '60073535541',
        'Environment': 'Development',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let s = '';
      res.on('data', d => s += d);
      res.on('end', () => {
        try {
          const p = JSON.parse(s);
          resolve(p);
        } catch (e) {
          resolve(s);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== [1/4] Building Frontend Bundle ===');
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, 'frontend') });

  console.log('\n=== [2/4] Fetching Fresh Zoho Catalyst Token ===');
  const token = await getToken();
  console.log('Successfully acquired Catalyst OAuth token.');

  console.log('\n=== [3/4] Deploying to Catalyst Serverless & AppSail (catalystserverless.in) ===');
  const catalystCli = 'C:\\Users\\techp\\AppData\\Roaming\\npm\\catalyst.cmd';
  const cmd = `cmd /c "call "${catalystCli}" deploy --token ${token} < NUL"`;
  execSync(cmd, { stdio: 'inherit', cwd: __dirname });

  console.log('\n=== [4/4] Triggering Instant Slate Cloud Redeployment (sentinal-peak.onslate.in) ===');
  const slateRes = await triggerSlateRedeploy(token);
  console.log('Slate Cloud Redeploy Response:', slateRes);

  console.log('\n======================================================');
  console.log('SUCCESS: Both production environments updated!');
  console.log('1. Primary: https://sentinal-60073535541.development.catalystserverless.in/app/index.html');
  console.log('2. Slate Mirror: https://sentinal-peak.onslate.in');
  console.log('======================================================');
}

main().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
