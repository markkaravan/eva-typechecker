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
    // Type declarations/alias: (type  <name> <base>):
    if (exp[0] === 'type') {
      const [_tag, name, base] = exp;

      // Union type: (or number string)
      if (base[0] === 'or') {
        const options = base.slice(1);
        const optionTypes = options.map(option => Type.fromString(option));
        return (Type[name] = new Type.Union({name, optionTypes}));
      }

      // Type alias:
      if (Type.hasOwnProperty(name)) {
        throw `Type ${name} is already defined: ${Type[name]}.`;
      }

      if (!Type.hasOwnProperty(base)) {
        throw `Type ${base} is not defined.`;
      }

      return (Type[name] = new Type.Alias({
        name,
        parent: Type[base],
      }));
    }

    // ---------------------------------
    // class declaration: (class <Name> <Super> <Body>)

    if (exp[0] === 'class') {
      const [_tag, name, superClassName, body] = exp;

      const superClass = Type[superClassName];

      const classType = new Type.Class({name, superClass});

      Type[name] = env.define(name, classType);

      this._tcBody(body, classType.env);

      return classType;
    }

    // ---------------------------------
    // Class instantiation: (new <Class> <Argments>...)

    if (exp[0] === 'new') {
      const [_tag, className, ...argValues] = exp;

      const classType = Type[className];

      if (classType == null) {
        throw `Unknown class ${name}.`;
      }

      const argTypes = argValues.map(arg => this.tc(arg, env));

      return  this._checkFunctionCall(
        classType.getField('constructor'),
        [classType, ...argTypes],
        env,
        exp,
      );
    }

    // ---------------------------------
    // Super  expressions: (super <ClassName>)
    if (exp[0] === 'super') {
      const [_tag, className] = exp;

      const classType = Type[className];

      if (classType == null) {
        throw `Unknown class ${name}.`;
      }

      return classType.superClass;
    }

    // ---------------------------------
    // Property access: (prop <instance> <name>)
    if (exp[0] === 'prop') {
      const [_tag, instance, name] = exp;

      const instanceType = this.tc(instance, env);

      return instanceType.getField(name);
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

      // 1. Assignment to a property: (set (prop <instance> <propName>) <value>)
      if (ref[0] === 'prop')  {
        const [_tag, instance, propName] = ref;
        const instanceType = this.tc(instance, env);

        const valueType = this.tc(value, env);
        const propType = instanceType.getField(propName);

        return this._expect(valueType, propType, value, exp);
      }

      // 2.  Simple Assignment
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

      // Boolean  conditions:
      const t1 = this.tc(condition, env);
      this._expect(t1, Type.boolean, condition, exp);

      // Initially the  environment used to tc  consequent
      // is the same as the main env, however it can be updated
      // for the union type with type casting:
      let consequentEnv = env;

      // Check if the condition is a type casting rule
      // This  is used with  union  types to make a  type concrete
      //
      // (if (== (typeof foo) "striing") ...)
      //
      if (this._isTypeCastCondition(condition)) {
        const  [name, specificType] = this._getSpecifiedType(condition);

        // Update environment with the concrete type for this name:
        consequentEnv = new TypeEnvironment(
          {[name]: Type.fromString(specificType)},
          env,
        );
      }

      const t2 = this.tc(consequent, consequentEnv);
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
      if (!this._isGenericDefFunction(exp)) {
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
      }
      // Actually validate the body
      return this.tc(exp, env);
    }

    // -------------------------------------
    // Lambda function
    if (exp[0] === 'lambda') {
      // 1. Generic function:
      if (this._isGenericLambdaFunction(exp)) {
        return this._createGenericFunctionType(exp, env);
      }

      // 2. Simple function:
      return this._createSimpleFunctionType(exp, env);
    }

    // -------------------------------------
    // Function calls
    if (Array.isArray(exp)) {
      const fn = this.tc(exp[0], env);
      const argValues = exp.slice(1);

      // Passed arguments:
      const argTypes = argValues.map(arg => this.tc(arg, env));
      const cfc = this._checkFunctionCall(fn, argTypes, env, exp);
      return cfc;
    }


    throw `Unknown type for expression ${exp}.`;
  }

  /**
  * Simple function declarations (no generic parameters).
  *
  * Such functions are typechecked during declaration time
  */
  _createSimpleFunctionType(exp, env) {
    const [_tag, params, _retDel, returnTypeStr, body] = exp;
    return this._tcFunction(params, returnTypeStr, body, env);
  }


  /**
  * Simple function declarations (no generic parameters).
  *
  * Such functions are typechecked during declaration time
  */
  _createGenericFunctionType(exp, env) {
    const [_tag, genericTypes, params, _retDel, returnType, body] = exp;
    return new Type.GenericFunction({
      genericTypesStr: genericTypes.slice(1, -1),
      params,
      body,
      returnType,
      env,    // closure
    });
  }


  /**
  * Whether the function is generic.
  *
  * (def foo <K> ((x K)) ->  K (+ x x))
  */
  _isGenericLambdaFunction(exp) {
    return exp.length === 6 && /^<[^>]+>$/.test(exp[2]);
  }


  /**
  * Whether the function is generic.
  *
  * (def foo <K> ((x K)) ->  K (+ x x))
  */
  _isGenericDefFunction(exp) {
    return exp.length === 7 && /^<[^>]+>$/.test(exp[2]);
  }

  /**
  * Transforms  def to var-lambda
  */
  _transformDefToVarLambda(exp) {
    // 1. Generic functions:
    if (this._isGenericDefFunction(exp)) {
      const [_tag, name, genericTypesStr, _retDel, returnTypeStr, body] = exp;
      return ['var', name, ['lambda', genericTypesStr, _retDel, returnTypeStr, body]];
    }

    // 2. Simple function
    const [_tag, name, params, _retDel, returnTypeStr, body] = exp;
    return ['var', name, ['lambda', params, _retDel, returnTypeStr, body]];
  }

  /**
  * Used with union types to make a type concrete
  *
  * (if (== (typeof foo) "string")...)
  *
  */
  _isTypeCastCondition(condition) {
    const [op, lhs] = condition;
    return op === '=='  && lhs[0] === 'typeof';
  }

  /**
  * Returns a specific type after casting
  *
  * Used for type narrowing
  *
  */
  _getSpecifiedType(condition) {
    const [_op, [_typeof, name], specificType] = condition;

    // Return name and the new type (stripping quotes).
    return [name, specificType.slice(1,  -1)];
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
      if (fn.paramTypes[index] === Type.any) {
        return;
      }
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

      typeof: Type.fromString('Fn<string<any>>'),
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
    // For union type, *all* sub-types should support this operation:
    if (type_ instanceof Type.Union) {
      if (type_.includesAll(allowedTypes)) {
        return;
      }
    }

    // Other types:
    else {
      if (allowedTypes.some(t => t.equals(type_))) {
        return;
      }
    }

    throw `\nUnexpected type: ${type_} in ${exp}, allowed: ${allowedTypes}`;

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
