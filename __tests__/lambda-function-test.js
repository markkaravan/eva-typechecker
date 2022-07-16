const Type = require('../src/Type');
const {test} = require('./test-util');

module.exports = eva => {
  test(eva,
    `
      (lambda ((x number)) -> number (* x x))
    `,
    Type.fromString('Fn<number<number>>')
  );

  // Callback
  test(eva,
    `
      (def onClick ((callback Fn<number<number>>)) -> number
        (begin
          (var x 10)
          (var  y 20)
          (callback (+  x y))))

      (onClick (lambda ((data number)) -> number (* data 10)))
    `,
    Type.number
  );

  test(eva,
    `
      ((lambda ((x number)) -> number (* x x)) 2)
    `,
    Type.number
  );

  test(eva,
    `
      (var square (lambda ((x  number)) -> number (* x x)))

      (square 2)
    `,
    Type.number
  );
};
