/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
(() => {
  // Polymer is officially supported on IE11, so here's a quick little
  // polyfill.
  let ix = 0;
  function lazyGet(fn) {
    let value;
    return () => {
      if (value === undefined) {
        value = fn();
      }
      return value;
    }
  }
  class _SymbolPolyfill {
    constructor(str, ix) {
      this.str = str;
      this.ix = ix;
      this.constructor = Symbol;
    }
    static make(str) {
      return new _SymbolPolyfill(str, ix++);
    }
    static get iterator() {
      return lazyGet(() => Symbol('iterator'))();
    }
    toString() {
      return `##Symbol#${this.str}#${this.ix}`
    }
  }
  Symbol = Symbol || _SymbolPolyfill.make; // eslint-disable-line no-global-assign
})();
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
      if (!target.$isSubtypeOf) {
        target.$isSubtypeOf = (typeOther) => {
          typeOther = exports.reifyType(typeOther);
          for (let implementedType of target.runtimeType[TYPE_INFO][SUPERTYPES]) {
            if (implementedType == typeOther) return true;
          }
          return false;
        }
      }
      if (!target.$isSupertypeOf) {
        target.$isSupertypeOf = (typeOther) => {
          typeOther = exports.reifyType(typeOther);
          if (_isSubtypeOfObject(typeOther)) {
            return typeOther.$isSubtypeOf(target);
          }
          return false;
        }
      }
      if (!target.$doesObjectImplement) {
        target.$doesObjectImplement = (obj) => {
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
      var typeInfo = _buildType(this.constructor);
      typeInfo.doAllChecks(this, this.constructor);
    }


    equals(other) {
      return this == other;
    }
    isInstanceOf(type) {
      if (_isSubtypeOfObject(type)) {
        _buildType(type);
        return type.$doesObjectImplement(this, type);
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
  function _isJSSubtypeOfType(type, supertype) {
    while (type) {
      if (type == supertype) return true;
      type = type.__proto__;
    }
    return false;
  }
  function _isSubtypeOfObject(type) {
    return _isJSSubtypeOfType(type, _Object);
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
    let realTypeArgs = [];
    return (...typeArgs) => {
      let currentMap = typeMap;
      for (var i = 0; i < fn.length - 1; i++) {
        let reifiedType = exports.reifyType(typeArgs[i]);
        realTypeArgs.push(reifiedType);
        currentMap = currentMap[reifiedType];
        if (!currentMap) {
          typeMap[reifiedType] = currentMap = new WeakMap();
        }
      }
      if (fn.length > 0) {
        let reifiedType = exports.reifyType(typeArgs[i]);
        realTypeArgs.push(reifiedType);
        let finalType = currentMap[reifiedType];
        if (!finalType) {
          currentMap[reifiedType] = finalType = fn.apply(fn, typeArgs);
          finalType.$isGeneric = true;
          finalType.$typeArguments = realTypeArgs;
          finalType.$classDefinition = fn;
        }
        return finalType;
      } else {
        return onlyType ? onlyType : fn.apply(this, typeArgs);
      }
    }
  };

  let VALUE_INTERCEPTORS = Symbol('_valueInterceptors');
  let CLASS_INTERCEPTORS = Symbol('_classInterceptors');
  let CACHED_TYPES = Symbol('_cachedTypes');
  class _TypeInterceptor {
    constructor() {
      this[CACHED_TYPES] = {};
      this[VALUE_INTERCEPTORS] = [];
      this[CLASS_INTERCEPTORS] = [];
    }
    get any() {
      return exports.lazyGet(() => {
        return class extends _Object {
          static $doesObjectImplement() { return true; }
          static get name() { return 'any'; }
        };
      })();
    }
    get Null() {
      return exports.lazyGet(() => {
        return class extends _Object {
          static $doesObjectImplement(obj) {
            return obj == null;
          }
          static $isSubtypeOf() {
            return true;
          }
          static get name() { return 'Null'; }
        };
      })();
    }
    get int() {
      return exports.lazyGet(() => {
        return class extends _Object {
          static $doesObjectImplement(obj) {
            return (typeof obj === 'number' && obj|0 == obj);
          }
          static get name() { return 'int'; }
        };
      })();
    }
    get double() {
      return exports.lazyGet(() => {
        return class extends _Object {
          static $doesObjectImplement (obj) {
            return (typeof obj === 'number');
          }
          static get name() { return 'double'; }
        };
      })();
    }
    get String() {
      return exports.lazyGet(() => {
        return class extends _Object {
          static $doesObjectImplement (obj) {
            return (typeof obj === 'string');
          }
          static get name() { return 'String'; }
        };
      })();
    }
  }
  exports.types = new _TypeInterceptor();
  exports.lazyGet = (fn) => {
    let value;
    return () => {
      if (value === undefined) {
        value = fn();
      }
      return value;
    }
  };
  exports.reifyType = (fn) => {
    if (fn == Number) return exports.types.double;
    if (fn == String) return exports.types.String;
    return fn;
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
    type = exports.reifyType(type);
    if (obj instanceof _Object) return obj.isInstanceOf(type);
    if (_isSubtypeOfObject(type)) return type.$doesObjectImplement(obj, type);
    return obj instanceof type;
  };
  exports.as = (obj, type) => {
    if (!exports.isInstanceOf(obj, type))
      throw new TypeError(`Object [${obj}] was not an instance of ${type}`);
    return obj;
  };
  exports.StateError = class StateError extends _Object {
    constructor(message) {
      super();
      this.message = message;
    }
    toString() {
      return `Bad State: ${this.message}`;
    }
  }
  exports.getOperator = Symbol('operator[]');
  exports.setOperator = Symbol('operator[]=');


  return exports;
});
