module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', {
        targets: { android: '21' },
        unstable_transformProfile: 'hermes-canary',
      }],
    ],
    plugins: [
      ['@babel/plugin-proposal-class-properties', { loose: true }],
      ['@babel/plugin-proposal-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-classes', { loose: true }],
      ['@babel/plugin-transform-spread', { loose: true }],
      ['@babel/plugin-transform-destructuring', { loose: true }],
      ['@babel/plugin-transform-parameters', { loose: true }],
      ['@babel/plugin-transform-object-rest-spread', { loose: true }],
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-transform-logical-assignment-operators',
      '@babel/plugin-transform-numeric-separator',
      ['@babel/plugin-transform-runtime', { helpers: true }],
    ],
  };
};