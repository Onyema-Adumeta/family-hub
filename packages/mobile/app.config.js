// Extends app.json. Adds the Firebase file for Android push notifications
// once it has been downloaded into this folder (see docs/OPERATIONS.md → Push notifications).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(firebase)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
