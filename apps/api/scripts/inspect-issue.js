const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env if available
// Try loading from apps/api/.env first, then root .env
const envPaths = [
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
        process.env[key.trim()] = value.trim();
      }
    });
    envLoaded = true;
    break; 
  }
}

const ISSUE_KEY = 'DS-3523';
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN || !JIRA_DOMAIN) {
  console.error('Error: Please set ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, and JIRA_DOMAIN environment variables.');
  console.error('You can create an apps/api/.env file with these values.');
  process.exit(1);
}

const credentials = `${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`;
const basicAuth = `Basic ${Buffer.from(credentials).toString('base64')}`;

console.log(`Fetching issue ${ISSUE_KEY} from ${JIRA_DOMAIN}...`);

const options = {
  hostname: JIRA_DOMAIN,
  path: `/rest/api/3/issue/${ISSUE_KEY}?expand=names,schema`,
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
    const names = issue.names;
    
    console.log(`\nIssue: ${issue.key} - ${issue.fields.summary}`);
    console.log('Searching for fields containing "[GO] VTVgo"...');
    
    let foundFieldId = null;
    
    for (const [key, value] of Object.entries(issue.fields)) {
      if (value && JSON.stringify(value).includes('[GO] VTVgo')) {
        console.log(`\n✅ FOUND FIELD: ${key} (${names[key]})`);
        console.log(`Value: ${JSON.stringify(value, null, 2)}`);
        foundFieldId = key;
        break; 
      }
    }
    
    if (!foundFieldId) {
      console.log('❌ Not found any field with value "[GO] VTVgo".');
      console.log('Trying to find field by name "(BU) Project"...');
      for (const [key, name] of Object.entries(names)) {
        if (name.includes('(BU) Project') || name.includes('BU') && name.includes('Project')) {
             console.log(`Potential field: ${key} (${name})`);
             foundFieldId = key;
        }
      }
    }

    if (foundFieldId) {
        fetchAllowedValues(foundFieldId);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();

function fetchAllowedValues(fieldId) {
    console.log(`\nFetching allowed values for field ${fieldId}...`);
    const editMetaOptions = {
        hostname: JIRA_DOMAIN,
        path: `/rest/api/3/issue/${ISSUE_KEY}/editmeta`,
        method: 'GET',
        headers: {
            'Authorization': basicAuth,
            'Accept': 'application/json'
        }
    };
    
    const metaReq = https.request(editMetaOptions, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
             if (res.statusCode !== 200) {
                 console.log(`Cannot fetch editmeta: ${res.statusCode}`);
                 return;
             }
             const meta = JSON.parse(data);
             if (meta.fields[fieldId] && meta.fields[fieldId].allowedValues) {
                 console.log(`\n✅ ALLOWED VALUES for ${fieldId}:`);
                 const values = meta.fields[fieldId].allowedValues.map(v => v.value);
                 console.log(JSON.stringify(values, null, 2));
                 
                 // Save to file for easy copy
                 const outFile = 'jira_field_values.json';
                 fs.writeFileSync(outFile, JSON.stringify(values, null, 2));
                 console.log(`\nSaved values to ${outFile}`);
             } else {
                 console.log(`No allowed values found for ${fieldId} in editmeta.`);
                 console.log('Field might not be a Select List or user does not have permission to edit it.');
             }
        });
    });
    metaReq.end();
}
