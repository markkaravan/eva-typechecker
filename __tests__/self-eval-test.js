const Type = require('../src/Type');
const {test} = require('./test-util');

module.exports = eva => {
  test(eva, 42, Type.number);

  test(eva, '"hello"', Type.string);
}
