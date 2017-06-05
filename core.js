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
  window.Symbol = window.Symbol || _SymbolPolyfill.make; // eslint-disable-line no-global-assign
})();
(function(s,a,c,q){s[a]=s[a]||function(i,m,f){q.push([i,m,f,c._currentScript||
c.currentScript]);};q=s[a].q=s[a].q||[];})(window,"define",document);

define('core', ['module'], function (module) {
  module.exports = {};

  let AssertionException = module.exports.AssertionException =
      class AssertionException {
    constructor(message) {
      this.message = message;
    }
    toString() {
      return `IterableException: ${this.message}`;
    }
  }

  module.exports.assert = (fn, message) => {
    if (!fn())
      throw new AssertionException(message || 'Assertion failed');
  };
  module.exports.makeGenericType = (fn) => {
    let typeMap = new WeakMap();
    let onlyType;
    return (...typeArgs) => {
      let realTypeArgs = [];
      let currentMap = typeMap;
      for (var i = 0; i < fn.length - 1; i++) {
        let reifiedType = typeArgs[i];
        realTypeArgs.push(reifiedType);
        currentMap = currentMap[reifiedType];
        if (!currentMap) {
          typeMap[reifiedType] = currentMap = new WeakMap();
        }
      }
      if (fn.length > 0) {
        let reifiedType = typeArgs[i];
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

  module.exports.lazyGet = (fn) => {
    let value;
    return () => {
      if (value === undefined) {
        value = fn();
      }
      return value;
    }
  };
  module.exports.equals = (that, other) => {
    if (that == null && other == null) return true;
    if (that == null || other == null) return false;
    if (Number.isNaN(that) && Number.isNaN(other)) return true;
    if (that[module.exports.equalOperator]) {
      return that[module.exports.equalOperator](other);
    }
    return that === other;
  };

  let cachedHashCodes = new WeakMap();

  // Here's the qualities we need for a proper hash function
  // a) obviously, a hash with the same value and salt
  //    must produce the same value.
  // b) The salt must vary the result independently. e.g., if there
  //    is a collision, then, then a value with a different salt
  //    should be no more likely to collide than it would as a result
  //    of random chance.
  let _SALT = Symbol('_salt');
  let _FIRSTCOMMON = Symbol('_common1');
  let _SECONDCOMMON = Symbol('_common2');
  module.exports.HashSalt = class HashSalt {
    constructor() {
      this[_SALT] =  (Math.random() * 0x1fffffff)|0;
    }
    get salt() {
      return this[_SALT];
    }

    static get firstCommon() {
      return this[_FIRSTCOMMON] = this[_FIRSTCOMMON] || new HashSalt();
    }
    static get secondCommon() {
      return this[_SECONDCOMMON] = this[_SECONDCOMMON] || new HashSalt();
    }
  };
  /**
   * @param {any} value
   * @param {HashSalt} salt
   * @return {int}
   */
  module.exports.hashCode = (value, salt) => {
    if (value == null) return nullHashCode(salt.salt)|0;
    let hashCode;
    if (typeof value === 'string') {
      return stringHashCode(value, salt.salt)|0;
    }
    if (typeof value === 'boolean') {
      return booleanHashCode(value, salt.salt)|0;
    }
    if (typeof value === 'number' && ((value|0) == value)) {
      return intHashCode(value, salt.salt)|0;
    }
    if (typeof value === 'number') {
      return floatHashCode(value, salt.salt)|0;
    }

    let innerMap;
    if (!cachedHashCodes.has(salt)) {
      innerMap = new WeakMap();
      cachedHashCodes.set(salt, innerMap);
    } else {
      innerMap = cachedHashCodes.get(salt);
    }
    if (innerMap.has(value)) {
      return innerMap.get(value);
    }
    innerMap.set(value, hashCode = objectHashCode(value, salt)|0);
    return hashCode;
  }

  module.exports.getOperator = Symbol('operator[]');
  module.exports.setOperator = Symbol('operator[]=');
  module.exports.equalOperator = Symbol('operator==');

  function floatHashCode(value, hash = 0) {
    let array = new Int32Array(new Float64Array([value]).buffer);
    for (let i = 0; i < array.length; i++) {
      hash = 0x1fffffff & hash + array[i];
      hash = 0x1fffffff & hash + ((0x7ffff & hash) << 10);
      hash = hash ^ hash >> 6;
    }
    hash = 0x1fffffff & hash + ((0x3ffffff & hash) << 3);
    hash = hash ^ hash >> 11;
    return 0x1fffffff & hash + ((0x3fff & hash) << 15);
  }
  function stringHashCode(value, hash = 0) {
    for (let i = 0; i < value.length; i++) {
      hash = 0x1fffffff & hash + value.charCodeAt(i);
      hash = 0x1fffffff & hash + ((0x7ffff & hash) << 10);
      hash = hash ^ hash >> 6;
    }
    hash = 0x1fffffff & hash + ((0x3ffffff & hash) << 3);
    hash = hash ^ hash >> 11;
    return 0x1fffffff & hash + ((0x3fff & hash) << 15);
  }
  function booleanHashCode(value, hash = 0) {
    return (value ? 2 * 3 * 23 * 3761 : 269 * 811) ^ hash;
  }
  function intHashCode(value, hash = 0) {
    return (value & 0x1fffffff) ^ hash;
  }
  function nullHashCode(hash) {
    return hash;
  }
  function objectHashCode(value, salt) {
    if (value.hashCode) {
      return value.hashCode(salt);
    }
    return Math.random() * 0x1fffffff | 0;
  }
  module.exports.stringHashCode = stringHashCode;

  module.exports.classHasMethod = (clazz, name) => {
    return _prototypeHasMethod(clazz.prototype, name);
  };
  function _prototypeHasMethod(proto, name) {
    return proto && (proto[name] || _prototypeHasMethod(proto.__proto__, name));
  }
  module.exports.classHasProperty = (clazz, name) => {
    return _prototypeHasProperty(clazz.prototype, name);
  };
  function _prototypeHasProperty(proto, name) {
    return proto && (proto.hasOwnProperty(name) || _prototypeHasProperty(proto.__proto__, name));
  }
});
