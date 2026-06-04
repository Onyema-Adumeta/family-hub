module.exports = function(code) {
  return { code: typeof code === 'string' ? code : String(code), map: null };
};