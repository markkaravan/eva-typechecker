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
    return this.name === other.name;
  }

  /**
  *  From string: 'number' -> Type.number
  */
  static fromString(typeStr) {
    if (this.hasOwnProperty(typeStr)) {
      return this[typeStr];
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

module.exports = Type;
