/**
*   Type class
*/
class Type {
  constructor(name) {
    this.name = name;
  }

  /**
  *  Returns name
  */
  getName() {
    return this.name;
  }

  /**
  *  String Representation
  */
  toString() {
    return this.getName();
  }

  /**
  *  Equals
  */
  equals(other) {
    if (other instanceof Type.Alias) {
      return other.equals(this);
    }
    return this.name === other.name;
  }

  /**
  *  From string: 'number' -> Type.number
  */
  static fromString(typeStr) {
    if (this.hasOwnProperty(typeStr)) {
      return this[typeStr];
    }

    // Functions
    if (typeStr.includes('Fn<')) {
      return Type.Function.fromString(typeStr);
    }

    throw `Unknown type: ${typeStr}`;
  }
}

/**
*   Number type
*/
Type.number = new Type('number');

/**
*   String type
*/
Type.string = new Type('string');

/**
*   Boolean type
*/
Type.boolean = new Type('boolean');

/**
*   Function meta type
*/
Type.Function = class extends Type {
  constructor({name=null, paramTypes, returnType}) {
    super(name);
    this.paramTypes = paramTypes;
    this.returnType = returnType;
    this.name = this.getName();
  }

  /**
  * Returns name: Fn<returnType<p1, p2, ... >>
  *
  * Fn<number> - function which returns a number
  *
  * Fn<number<number, number>> - function which returns a number and accepts two numbers
  */
  getName() {
    if (this.name == null) {
      const name = ['Fn<', this.returnType.getName()];
      // Params.
      if (this.paramTypes.length !== 0) {
        const params = [];
        for (let i = 0; i  < this.paramTypes.length; i++) {
          params.push(this.paramTypes[i].getName());
        }
        name.push('<', params.join(','), '>');
      }
      name.push('>');
      this.name = name.join('');
    }
    return this.name;
  }

  /**
  *  Equals
  */
  equals(other) {
    if (this.paramTypes.length !== other.paramTypes.length) {
      return false;
    }

    // Same params
    for (let i = 0; i< this.paramTypes.length; i++) {
      if (!this.paramTypes[i].equals(other.paramTypes[i])) {
        return false;
      }
    }

    // return type
    if (!this.returnType.equals(other.returnType)) {
      return false;
    }

    return true;
  }

  /**
  *  From string: 'FN<number>' -> Type.Function
  */
  static fromString(typeStr) {
    //  Already compiled
    if (Type.hasOwnProperty(typeStr)) {
      return Type[typeStr];
    }

    // Function type with return and params:
    let matched = /^Fn<(\w+)<([a-z,\s]+)>>$/.exec(typeStr);

    if (matched != null) {
      const [_, returnTypeStr, paramsString] = matched;

      // Param types:
      const paramTypes = paramsString
        .split(/,\s*/g)
        .map(param => Type.fromString(param));

      return (Type[typeStr] = new Type.Function({
        name: typeStr,
        paramTypes,
        returnType: Type.fromString(returnTypeStr),
      }));
    }

    // Function type with return type only:
    matched = /^Fn<(\w+)>$/.exec(typeStr);

    if (matched != null) {
      const [_, returnTypeStr] = matched;
      return (Type[typeStr] = new Type.Function({
        name:  typeStr,
        paramTypes: [],
        returnType: Type.fromString(returnTypeStr),
      }));
    }
    throw `Type.Function.fromString: Unknown type: ${typeStr}.`;
  }
};

/**
*
*/
Type.Alias = class extends Type {
  constructor({name, parent}) {
    super(name);
    this.parent = parent;
  }

  equals(other) {
    if (this.name === other.name) {
      return true;
    }
    return this.parent.equals(other);
  }
};


module.exports = Type;
