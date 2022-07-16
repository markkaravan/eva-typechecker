/**
*   TypeEnvironment: mapping from names to types.
*/
class TypeEnvironment {
  /**
  *   Creates and environment with the given record
  */
  constructor(record = {}, parent = null) {
    this.record =  record;
    this.parent = parent;
  }

  /**
  *   Creates a variable with the given name and type;
  */
  define(name, type_) {
    this.record[name] = type_;
    return type_;
  }

  /**
  *   Returns the type of  a defined variable, or
  *   throws if the variable is not defined
  */
  lookup(name) {
    // TODO: parent env lookup
    if (!this.record.hasOwnProperty(name)) {
      throw new ReferenceError(`Variable "${name}" is not defined.`);
    }
    return this.record[name];
  }
}


module.exports = TypeEnvironment;
