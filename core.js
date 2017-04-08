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
  const TYPE_INFO = exports.TYPE_INFO = Symbol('_typeInfo');
  const SUPERTYPES = exports.SUPERTYPES = Symbol('_supertypes');

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
          return (target.$isSupertypeOf(obj.runtimeType));
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
    static [Symbol.hasInstance](obj) {
      if (this == _Object) return Object[Symbol.hasInstance].apply(this, [obj]);
      _buildType(this);
      return this.$doesObjectImplement(obj, this);
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
    return (...typeArgs) => {
      let realTypeArgs = [];
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

  const VALUE_INTERCEPTORS = Symbol('_valueInterceptors');
  const CLASS_INTERCEPTORS = Symbol('_classInterceptors');
  const CACHED_TYPES = Symbol('_cachedTypes');
  const ANY_SYMBOL = Symbol('_any');
  const NULL_SYMBOL = Symbol('_null');
  const INT_SYMBOL = Symbol('_int');
  const DOUBLE_SYMBOL = Symbol('_double');
  const STRING_SYMBOL = Symbol('_string');
  const BOOL_SYMBOL = Symbol('_bool');
  class _TypeInterceptor {
    constructor() {
      this[CACHED_TYPES] = {};
      this[VALUE_INTERCEPTORS] = [];
      this[CLASS_INTERCEPTORS] = [];
    }
    get any() {
      return this[ANY_SYMBOL] = this[ANY_SYMBOL] || (() => {
        return class extends _Object {
          static $doesObjectImplement() { return true; }
          static get name() { return 'any'; }
          static $isSupertypeOf() { return true; }
          static $isSubtypeOf(type) {
            return type == exports.types.any;
          }
        };
      })();
    }
    get Null() {
      return this[NULL_SYMBOL] = this[NULL_SYMBOL] || (() => {
        return class extends _Object {
          static $doesObjectImplement(obj) {
            return obj == null;
          }
          static $isSubtypeOf() {
            return true;
          }
          static get name() { return 'Null'; }
          static $hashCode() {return 0;}
        };
      })();
    }
    get int() {
      return this[INT_SYMBOL] = this[INT_SYMBOL] || (() => {
        return class extends _Object {
          static $doesObjectImplement(obj) {
            return (typeof obj === 'number' && obj|0 == obj);
          }
          static $isSubtypeOf(type) {
            return [exports.types.int, exports.types.double, exports.types.any].includes(type);
          }
          static get name() { return 'int'; }
          static $hashCode(value) {
            return value & 0x1fffffff;
          }
        };
      })();
    }
    get bool() {
      return this[BOOL_SYMBOL] = this[BOOL_SYMBOL] || (() => {
        return class extends _Object {
          static $doesObjectImplement(obj) {
            return (typeof obj === 'boolean');
          }
          static $isSubtypeOf(type) {
            return [exports.types.bool, exports.types.any].includes(type);
          }
          static get name() { return 'bool'; }
          static $hashCode(value) {
            return value ? 2 * 3 * 23 * 3761 : 269 * 811;
          }
        };
      })();
    }
    get double() {
      return this[DOUBLE_SYMBOL] = this[DOUBLE_SYMBOL] || (() => {
        return class extends _Object {
          static $doesObjectImplement (obj) {
            return (typeof obj === 'number');
          }
          static $isSubtypeOf(type) {
            return [exports.types.double, exports.types.any].includes(type);
          }
          static get name() { return 'double'; }
          static $hashCode(value) {
            let array = new Int32Array(new Float64Array([value]).buffer);
            let hash = 0;
            for (let i = 0; i < array.length; i++) {
              hash = 536870911 & hash + array[i]
              hash = 536870911 & hash + ((524287 & hash) << 10);
              hash = hash ^ hash >> 6;
            }
            hash = 536870911 & hash + ((67108863 & hash) << 3);
            hash = hash ^ hash >> 11;
            return 536870911 & hash + ((16383 & hash) << 15);
          }
        };
      })();
    }
    get String() {
      return this[STRING_SYMBOL] = this[STRING_SYMBOL] || (() => {
        return class extends _Object {
          static $doesObjectImplement (obj) {
            return (typeof obj === 'string');
          }
          static $isSubtypeOf(type) {
            return [exports.types.String, exports.types.any].includes(type);
          }
          static get name() { return 'String'; }
          static $hashCode(value) {
            let hash = 0;
            for (let i = 0; i < this.length; i++) {
              hash = 536870911 & hash + value.charCodeAt(i);
              hash = 536870911 & hash + ((524287 & hash) << 10);
              hash = hash ^ hash >> 6;
            }
            hash = 536870911 & hash + ((67108863 & hash) << 3);
            hash = hash ^ hash >> 11;
            return 536870911 & hash + ((16383 & hash) << 15);
          }
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
    if (fn == Boolean) return exports.types.bool;
    return fn;
  };
  exports.runtimeType = (obj) => {
    if (obj == null) return exports.types.Null;
    if (typeof obj === 'number') {
      if ((obj|0) == obj) return exports.types.int;
      return exports.types.double;
    }
    if (typeof obj === 'string') {
      return exports.types.String;
    }
    if (typeof obj === 'boolean') {
      return exports.types.bool;
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
  exports.isSupertypeOf = (type, subType) => {
    type = exports.reifyType(type);
    subType = exports.reifyType(subType);
    if (!_isSubtypeOfObject(type)) {
      return _isJSSubtypeOfType(subType, type);
    }
    _buildType(type);
    return type.$isSupertypeOf(subType);
  }
  exports.isSubtypeOf = (type, superType) => exports.isSupertypeOf(superType, subType);
  exports.as = (obj, type) => {
    exports.assert(() => exports.isInstanceOf(obj, type),
                   `Object [${obj}] was not an instance of ${type}`);
    return obj;
  };
  exports.equals = (that, other) => {
    let type = exports.runtimeType(that);
    if (that instanceof _Object) {
      return that.equals(other);
    }
    if (type.$equals) {
      return type.$equals(that, other);
    }
    return that == other;
  };
  let cachedHashCodes = new WeakMap();
  exports.hashCode = (value) => {
    let type = exports.runtimeType(value);
    if (value instanceof _Object) {
      return value.hashCode;
    }
    if (type.$hashCode) {
      return type.$hashCode(value);
    }
    if (cachedHashCodes.has(value))
      return cachedHashCodes.get(value);
    let hashCode = Math.random() * 0x3fffffff | 0;
    cachedHashCodes.set(value, hashCode);
    return hashCode;
  }
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
