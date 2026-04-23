const fs = require('fs');
const path = require('path');

const required = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`replace.js: missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const distPath = 'dist';
const files = fs.readdirSync(distPath);
const mainJsFile = files.find(f => f.startsWith('main.') && f.endsWith('.js'));
if (!mainJsFile) {
  console.error('replace.js: could not find main.*.js in dist');
  process.exit(1);
}

const filePath = path.join(distPath, mainJsFile);
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace('___AUTH0_DOMAIN___', process.env.AUTH0_DOMAIN);
content = content.replace('___AUTH0_CLIENT_ID___', process.env.AUTH0_CLIENT_ID);
fs.writeFileSync(filePath, content);
console.log('Environment variables injected successfully');