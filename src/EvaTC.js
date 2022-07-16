const Type = require('./Type');
const TypeEnvironment = require('./TypeEnvironment');

/**
* Typed Eva: static typechecker.
*/
class EvaTC {
  /**
  * Creates an Eva instance with the global environment
  */
  constructor() {
    /**
    * Create the Global TypeEnvironment per Eva instance
    */
    this.global = this._createGlobal();
  }

  tcGlobal(exp) {
    return this._tcBody(exp, this.global);
  }

  _tcBody(body, env) {
    if (body[0] === 'begin') {
      return this._tcBlock(body, env);
    }
    return this.tc(body, env);
  }

  tc(exp, env = this.global) {
    //-----------------------------------
    // Self-evaluating:

    /**
    * Numbers: 10
    */

    if (this._isNumber(exp)) {
      return Type.number;
    }

    if (this._isString(exp)) {
      return Type.string;
    }

    if (this._isBoolean(exp)) {
      return Type.boolean;
    }

    // ---------------------------------
    // Math operations
    if (this._isBinary(exp)) {
      return this._binary(exp, env);
    }

    // ---------------------------------
    // Boolean binary:
    if (this._isBooleanBinary(exp)) {
      return this._booleanBinary(exp, env);
    }

    // ---------------------------------
    // Variable declaration: (var x 10)
    //
    // With typecheck: (var (x number) "foo") // error

    if (exp[0] === 'var') {
      const [_tag, name, value] = exp;

      // Infer actual type:
      const valueType = this.tc(value, env);

      // With type check:
      if (Array.isArray(name)) {
        const [varName, typeStr] = name;

        const expectedType = Type.fromString(typeStr);

        // Check the type:
        this._expect(valueType, expectedType, value, exp);

        return env.define(varName, expectedType);
      }

      // Simple name:
      return env.define(name, valueType);
    }

    // -------------------------------------
    // Variable access: foo
    if (this._isVariableName(exp)) {
      return env.lookup(exp);
    }

    // -------------------------------------
    // Variable update: (set x 10)
    if (exp[0] === 'set') {
      const  [_, ref, value] = exp;

      // The type of the new value should match the
      // previous type when the variable was defined

      const valueType = this.tc(value, env);
      const varType = this.tc(ref, env);

      return this._expect(valueType, varType, value, exp);
    }

    // -------------------------------------
    // Block: sequence of expressions
    if (exp[0] === 'begin') {
      const blockEnv = new TypeEnvironment({}, env);
      return this._tcBlock(exp, blockEnv);
    }

    // -------------------------------------
    // If statement
    if (exp[0] === 'if') {
      const [_tag, condition, consequent, alternate] = exp;

      const t1 = this.tc(condition, env);
      this._expect(t1, Type.boolean, condition, exp);

      const t2 = this.tc(consequent, env);
      const t3 = this.tc(alternate, env);

      // Both branches should be the same type
      return this._expect(t3, t2, exp, exp);

      throw `Unknown type for expression ${exp}.`;
    }

    // -------------------------------------
    // While statement
    if (exp[0] === 'while') {
      const [_tag, condition, body] = exp;

      // Boolean condition:
      const t1 = this.tc(condition, env);
      this._expect(t1, Type.boolean, condition, exp);

      return this.tc(body, env);
    }

    // -------------------------------------
    // Function  declaration
    // Suntactic sugar  for  var-lambda
    if (exp[0]  === 'def') {
      const varExp = this._transformDefToVarLambda(exp);

      const name = exp[1];
      const params = exp[2];
      const returnTypeStr = exp[4];

      // We must extend the environment with the function name BEFORE
      // evaluating the body -- this supports recursion
      const paramTypes = params.map(([name, typeStr]) =>
        Type.fromString(typeStr),
      );

      // Predefine (for recursion)
      env.define(
        name,
        new Type.Function({
          paramTypes,
          returnType: Type.fromString(returnTypeStr),
        }),
      );

      // Actually validate the body
      return this.tc(varExp, env);
    }

    // -------------------------------------
    // Lambda function
    if (exp[0] === 'lambda') {
      const [_tag, params, _retDel, returnTypeStr, body] = exp;
      return this._tcFunction(params, returnTypeStr, body, env);
    }

    // -------------------------------------
    // Function calls
    if (Array.isArray(exp)) {
      const fn = this.tc(exp[0], env);
      const argValues = exp.slice(1);

      // Passed arguments:
      const argTypes = argValues.map(arg => this.tc(arg, env));

      return this._checkFunctionCall(fn, argTypes, env, exp);
    }


    throw `Unknown type for expression ${exp}.`;
  }

  /**
  * Transforms  def to var-lambda
  */
  _transformDefToVarLambda(exp) {
    const [_tag, name, params, _retDel, returnTypeStr, body] = exp;
    return ['var', name, ['lambda', params, _retDel, returnTypeStr, body]];
  }

  /**
  * Checks a block
  */
  _checkFunctionCall(fn, argTypes, env, exp) {
    // Check arity:

    if (fn.paramTypes.length !== argTypes.length) {
      throw `\nFunction ${exp[0]} ${fn.getName()} expects ${
        fn.paramTypes.length
      } arguments, ${argTypes.length} given in ${exp}.\n`;
    }

    argTypes.forEach((argType, index) => {
      this._expect(argType, fn.paramTypes[index], argTypes[index], exp);
    });

    return fn.returnType;
  }


  /**
  * Checks a block
  */
  _tcFunction(params, returnTypeStr, body, env) {
    const returnType = Type.fromString(returnTypeStr);

    // Parameters environment and types:
    const paramsRecord = {};
    const paramTypes = [];
    params.forEach(([name, typeStr]) => {
      const paramType = Type.fromString(typeStr);
      paramsRecord[name] = paramType;
      paramTypes.push(paramType);
    });

    const fnEnv = new TypeEnvironment(paramsRecord, env);

    // Check  the body in the extended environment:
    const actualReturnType = this._tcBody(body, fnEnv);

    // Check the return type:
    if (!returnType.equals(actualReturnType)) {
      throw `Expected function ${body} to return  ${returnType}, but got ${actualReturnType}.`;
    }

    // Function type records its parameters  and return type,
    // so we can use the to validate  function calls:
    return new Type.Function({
      paramTypes,
      returnType,
    });
  }


  /**
  * Checks a block
  */
  _tcBlock(block, env) {
    let result;

    const [_tag, ...expressions] = block;

    expressions.forEach(exp =>  {
      result = this.tc(exp, env);
    });

    return result;
  }


  /**
  * Whether the expression is a variable name
  */
  _isVariableName(exp) {
    return typeof exp === 'string' && /^[+\-*<>=a-zA-Z0-9_:]+$/.test(exp);
  }

  /**
  * Creates a new TypeEnvironment
  */
  _createGlobal() {
    return new TypeEnvironment({
      VERSION: Type.string,
      sum: Type.fromString('Fn<number<number,number>>'),
      square: Type.fromString('Fn<number<number>>'),
    });
  }

  /**
  * Whether the expression is boolean binary
  */
  _isBooleanBinary(exp) {
    return (
      exp[0] === '==' ||
      exp[0] === '!=' ||
      exp[0] === '>=' ||
      exp[0] === '<=' ||
      exp[0] === '>' ||
      exp[0] === '<'
    );
  }

  _booleanBinary(exp, env) {
    this._checkArity(exp, 2);

    const t1 = this.tc(exp[1], env);
    const t2 = this.tc(exp[2], env);

    this._expect(t2, t1, exp[2], exp);

    return Type.boolean;
  }

  /**
  * Whether operatiion  is binary
  */
  _isBinary(exp) {
    return /^[+\-*/]$/.test(exp[0]);
  }

  /**
  * Binary operators
  */
  _binary(exp, env) {
    this._checkArity(exp, 2);

    const t1 = this.tc(exp[1], env);
    const t2 = this.tc(exp[2], env);

    const allowedTypes = this._getOperandTypesForOperator(exp[0]);

    this._expectOperatorType(t1, allowedTypes, exp);
    this._expectOperatorType(t2, allowedTypes, exp);

    return this._expect(t2, t1, exp[2], exp);
  }

  /**
  * Returns allowed operand types for an operator
  */
  _getOperandTypesForOperator(operator) {
    switch(operator) {
      case '+':
        return [Type.string, Type.number];
      case '-':
        return [Type.number];
      case '*':
        return [Type.number];
      case '/':
        return [Type.number];
      default:
        throw `Unknown operator: ${operator}.`;
    }
  }

  _expectOperatorType(type_, allowedTypes, exp) {
    if (!allowedTypes.some(t => t.equals(type_))) {
      throw `\nUnexpected type: ${type_} in ${exp}, allowed: ${allowedTypes}`;
    }
  }

  _expect(actualType, expectedType, value, exp) {
    if (!actualType.equals(expectedType)) {
      this._throw(actualType, expectedType, value, exp);
    }
    return actualType;
  }

  _throw(actualType, expectedType, value, exp) {
    throw `\nExpected "${expectedType}" type for ${value} in ${exp}, but got "${actualType}" type.\n`;
  }

  _checkArity(exp, arity) {
    if (exp.length - 1 !== arity) {
      throw `\nOperator '${exp[0]}' expects ${arity} operands, ${exp.length - 1} given in ${exp}.\n`;
    }
  }

  _isBoolean(exp) {
    return typeof exp === 'boolean' || exp === 'true' || exp === 'false';
  }

  _isNumber(exp) {
    return typeof exp === 'number';
  }

  _isString(exp) {
    return typeof exp === 'string' && exp[0] === '"' && exp.slice(-1) === '"';
  }
}

module.exports = EvaTC;
