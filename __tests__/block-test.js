const Type = require('../src/Type');
const {exec, test} = require('./test-util');

module.exports = eva => {

  // Block: sequence of expressions
  test(eva,

    ['begin',
      ['var', 'x', 10],
      ['var', 'y', 20],
      ['+', ['*', 'x', 10], 'y']
    ],
    Type.number
  );

  // Block: local scope
  test(eva,

    ['begin',
      ['var', 'x', 10],
      ['begin',
        ['var', 'x', '"hello"'],
        ['+', 'x', '"world"']],

      ['-', 'x', 5]],

    Type.number
  );

  // Block: access parent scopes
  test(eva,

    ['begin',
      ['var', 'x', 10],

      ['begin',
        ['var', 'y', 20],
        ['+', 'x', 'y']]],

    Type.number
  );

  // Block: variable update

  exec(eva, `(var x 10)`);

  test(eva,
    `
      (var y 20)
      (+ (* x 10) y)
    `,

    Type.number
  );


};
