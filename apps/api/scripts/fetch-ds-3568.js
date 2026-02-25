const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
const envPaths = [
  path.resolve(__dirname, '../../../.env.development.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../apps/api/.env'), 
  path.resolve(__dirname, '../../.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        let val = value.trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key.trim()] = val;
      }
    });
    envLoaded = true;
    break; 
  }
}

const ISSUE_KEY = 'DS-3568';
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN || !JIRA_DOMAIN) {
  console.error('Error: Missing environment variables.');
  process.exit(1);
}

const credentials = `${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`;
const basicAuth = `Basic ${Buffer.from(credentials).toString('base64')}`;

console.log(`Fetching issue ${ISSUE_KEY} from ${JIRA_DOMAIN}...`);

const options = {
  hostname: JIRA_DOMAIN,
  path: `/rest/api/3/issue/${ISSUE_KEY}`,
  method: 'GET',
  headers: {
    'Authorization': basicAuth,
    'Accept': 'application/json'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`Error ${res.statusCode}: ${data}`);
      return;
    }
    const issue = JSON.parse(data);
    console.log(`\nSuccess! Found issue: ${issue.key}`);
    console.log(`Summary: ${issue.fields.summary}`);
    console.log(`Status: ${issue.fields.status.name}`);
    console.log(`Assignee: ${issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned'}`);
    console.log(`Project: ${issue.fields.project.name} (${issue.fields.project.key})`);
    console.log(`Description: ${issue.fields.description ? JSON.stringify(issue.fields.description).substring(0, 200) + '...' : 'No description'}`);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
