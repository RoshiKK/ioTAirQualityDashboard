const path = require('path');

module.exports = function override(config, env) {
  // Customize Webpack config here
  // Example: Adding an alias
  config.resolve.alias = {
    ...config.resolve.alias,
    '@components': path.resolve(__dirname, 'src/components/'),
  };
  return config;
};
