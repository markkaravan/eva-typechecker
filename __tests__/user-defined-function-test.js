const Type = require('../src/Type');
const {test} = require('./test-util');

module.exports = eva => {
  test(eva,
    `
      (def square ((x number)) -> number
        (* x x))
    `,
    Type.fromString('Fn<number<number>>')
  );

  test(eva,
    `
      (square 2)
    `,
    Type.number
  );

  test(eva,
    `
      (def calc ((x number) (y number)) -> number
        (begin
          (var z 30)
          (+ (* x y) z)
        ))

      //(calc 10 20)
    `,
    Type.fromString('Fn<number<number, number>>')
  );

  test(eva,
    `
      (def factorial ((x number)) -> number
        (if (== x 1)
          1
          (* x (factorial (- x 1)))))

      (factorial 5)
    `,
    Type.number
  );
};
