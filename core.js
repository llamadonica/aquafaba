/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
define('core', [], function () {
  var exports = {};

  const HASH_CODE = Symbol('_hashCode');
  const TYPE_INFO = Symbol('_typeInfo');
  const SUPERTYPES = Symbol('_supertypes');


  class _StaticTypeInfo {
    constructor(supertypes) {
      this[SUPERTYPES] = supertypes;
    }
    doAllChecks(obj, target) {
      for (let supertype of this[SUPERTYPES]) {
        if (supertype.check) {
          supertype.check(obj, target);
        }
      }
    }
  }
  function _buildTypeHelper(target, visitedAlready, results) {
    if (visitedAlready.has(target)) return;
    visitedAlready.add(target);
    results.push(target);
    let originalTypes = target.implements || [];
    if (target != _Object) {
      originalTypes.push(target.__proto__);
    }
    for (let supertype of originalTypes) {
      _buildTypeHelper(supertype, visitedAlready, results);
    }
  }
  function _buildType(target) {
    var typeInfo = target[TYPE_INFO];
    if (!typeInfo) {
      var supertypes = [];
      _buildTypeHelper(target, new WeakSet(), supertypes);
      typeInfo = target[TYPE_INFO] = new _StaticTypeInfo(supertypes);
      if (!target.$isInstanceOf) {
        target.$isInstanceOf = (obj) => {
          if (!(obj instanceof _Object)) return false;
          for (let implementedType of obj.runtimeType[TYPE_INFO][SUPERTYPES]) {
            if (implementedType == target) return true;
          }
          return false;
        }
      }
    }
    return typeInfo;
  }

  class _Object {
    constructor() {
      this[HASH_CODE] = null;
      var typeInfo = _buildType(new.target);
      typeInfo.doAllChecks(this, new.target);
    }


    equals(other) {
      return this == other;
    }
    isInstanceOf(type) {
      if (_isSubtypeOfObject(type)) {
        _buildType(type);
        return type.$isInstanceOf(this, type);
      }
      return (this instanceof type);
    }
    get hashCode() {
      let hashCode = this[HASH_CODE];
      if (hashCode == null) {
        hashCode = Math.random() * 0x3fffffff | 0;
        this[HASH_CODE] = hashCode;
      }
      return hashCode;
    }
    get runtimeType() {
      return this.constructor;
    }
    static get name() { return (this == _Object) ? 'Object' : '##AnonymousType##'; }
    static toString() { return this.name; }
    toString() { return `Instance of ${this.runtimeType}` }
  }
  function _isSubtypeOfObject(type) {
    while (type) {
      if (type == _Object) return true;
      type = type.__proto__;
    }
    return false;
  }
  class _AssertionException extends _Object {
    constructor(message) {
      super();
      this.message = message;
    }
  }

  exports.Object = _Object;
  exports.assert = (fn, message) => {
    if (!fn()) throw new _AssertionException(message || 'Assertion failed');
  };
  exports.makeGenericType = (fn) => {
    let typeMap = new WeakMap();
    let onlyType;
    return (...typeArgs) => {
      let currentMap = typeMap;
      for (var i = 0; i < fn.length - 1; i++) {
        currentMap = currentMap[typeArgs[i]];
        if (!currentMap) {
          typeMap[typeArgs] = currentMap = new WeakMap();
        }
      }
      if (fn.length > 0) {
        let finalType = currentMap[typeArgs[fn.length - 1]];
        if (!finalType) {
          currentMap[typeArgs[fn.length - 1]] = finalType = fn.apply(fn, typeArgs);
          finalType.$isGeneric = true;
          finalType.$typeArguments = typeArgs.slice(0);
          finalType.$classDefinition = fn;
        }
        return finalType;
      } else {
        return onlyType ? onlyType : fn.apply(this, typeArgs);
      }
    }
  };
  exports.types = {
    any: class extends _Object {
      static $isInstanceOf() { return true; }
      static get name() { return 'any'; }
    },
    Null: class extends _Object {
      static $isInstanceOf(obj) {
        return obj == null;
      }
      static get name() { return 'Null'; }
    },
    int: class extends _Object {
      static $isInstanceOf(obj) {
        return (typeof obj === 'number' && obj|0 == obj);
      }
      static get name() { return 'int'; }
    },
    double: class extends _Object {
      static $isInstanceOf (obj) {
        return (typeof obj === 'number');
      }
      static get name() { return 'double'; }
    },
    String: class extends _Object {
      static $isInstanceOf (obj) {
        return (typeof obj === 'string');
      }
      static get name() { return 'String'; }
    }
  };
  exports.lazyGet = (fn) => {
    let value;
    return () => {
      if (value === undefined) {
        value = fn();
      }
      return value;
    }
  };
  exports.runtimeType = (obj) => {
    if (obj == null) return exports.types.Null;
    if (typeof obj === 'number') {
      if (obj|0 == obj) return exports.types.int;
      return exports.types.double;
    }
    if (typeof obj === 'string') {
      return exports.types.String;
    }
    if (obj instanceof _Object) return obj.runtimeType;
    return obj.constructor;
  };
  exports.isInstanceOf = (obj, type) => {
    if (obj instanceof _Object) return obj.isInstanceOf(type);
    if (type.$isInstanceOf) return type.$isInstanceOf(obj, type);
    return obj instanceof type;
  }


  return exports;
});
