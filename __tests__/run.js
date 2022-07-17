const EvaTC = require('../src/EvaTC');

const tests = [
  require('./self-eval-test.js'),
  require('./math-test.js'),
  require('./variable-test.js'),
  require('./block-test.js'),
  require('./if-test.js'),
  require('./while-test.js'),
  require('./user-defined-function-test.js'),
  require('./built-in-function-test.js'),
  require('./lambda-function-test.js'),
  require('./alias-test.js'),
  require('./class-test.js'),
  require('./union-test.js'),
  // require('./generic-test.js'),
];

const eva = new EvaTC();

tests.forEach(test => test(eva));

console.log('All assertions passed');
