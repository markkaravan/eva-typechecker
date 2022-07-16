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

    // ---------------------------------
    // Math operations
    if (this._isBinary(exp)) {
      return this._binary(exp, env);
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

    throw `Unknown type for expression ${exp}.`;
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
    });
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

  _isNumber(exp) {
    return typeof exp === 'number';
  }

  _isString(exp) {
    return typeof exp === 'string' && exp[0] === '"' && exp.slice(-1) === '"';
  }
}

module.exports = EvaTC;
