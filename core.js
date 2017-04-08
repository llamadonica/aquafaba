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

  let AssertionException = exports.AssertionException =
      class AssertionException {
    constructor(message) {
      this.message = message;
    }
    toString() {
      return `IterableException: ${this.message}`;
    }
  }

  exports.assert = (fn, message) => {
    if (!fn()) throw new AssertionException(message || 'Assertion failed');
  };
  exports.makeGenericType = (fn) => {
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

  exports.lazyGet = (fn) => {
    let value;
    return () => {
      if (value === undefined) {
        value = fn();
      }
      return value;
    }
  };
  exports.equals = (that, other) => {
    if (that == null && other == null) return true;
    if (that[exports.equalOperator]) {
      return that[exports.equalOperator](other);
    }
    return that === other;
  };

  let cachedHashCodes = new WeakMap();

  exports.hashCode = (value) => {
    if (value == null) return nullHashCode();
    let hashCode;
    if (typeof value === 'string') {
      return stringHashCode(value);
    }
    if (typeof value === 'boolean') {
      return booleanHashCode(value);
    }
    if (typeof value === 'number' && ((value|0) == value)) {
      return intHashCode(value);
    }
    if (typeof value === 'number') {
      return floatHashCode(value);
    }
    if (cachedHashCodes.has(value)) {
      return cachedHashCodes.get(value);
    }
    cachedHashCodes.set(value, hashCode = objectHashCode(value));
    return hashCode;
  }

  exports.getOperator = Symbol('operator[]');
  exports.setOperator = Symbol('operator[]=');
  exports.equalOperator = Symbol('operator==');

  function floatHashCode(value) {
    let array = new Int32Array(new Float64Array([value]).buffer);
    let hash = 0;
    for (let i = 0; i < array.length; i++) {
      hash = 0x1fffffff & hash + array[i];
      hash = 0x1fffffff & hash + ((0x7ffff & hash) << 10);
      hash = hash ^ hash >> 6;
    }
    hash = 0x1fffffff & hash + ((0x3ffffff & hash) << 3);
    hash = hash ^ hash >> 11;
    return 0x1fffffff & hash + ((0x3fff & hash) << 15);
  }
  function stringHashCode(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = 0x1fffffff & hash + value.charCodeAt(i);
      hash = 0x1fffffff & hash + ((0x7ffff & hash) << 10);
      hash = hash ^ hash >> 6;
    }
    hash = 0x1fffffff & hash + ((0x3ffffff & hash) << 3);
    hash = hash ^ hash >> 11;
    return 0x1fffffff & hash + ((0x3fff & hash) << 15);
  }
  function booleanHashCode(value) {
    return value ? 2 * 3 * 23 * 3761 : 269 * 811;
  }
  function intHashCode(value) {
    return value & 0x1fffffff;
  }
  function nullHashCode() {
    return 0;
  }
  function objectHashCode(value) {
    if (value.hasOwnProperty('hashCode')) {
      return value.hashCode;
    }
    return Math.random() * 0x3fffffff | 0;
  }
  let cachedHashCodesAlternate = new WeakMap();
  exports.hashCodeAlternate = (value) => {
    if (value == null) return nullHashCodeAlternate();
    let hashCode;
    if (typeof value === 'string') {
      return stringHashCodeAlternate(value);
    }
    if (typeof value === 'boolean') {
      return booleanHashCodeAlternate(value);
    }
    if (typeof value === 'number' && ((value|0) == value)) {
      return floatHashCodeAlternate((-1)*value + 0.5)
    }
    if (typeof value === 'number') {
      let innerValue = (-1)*value + 0.5;
      if ((innerValue|0) == innerValue) {
        return intHashCode(innerValue);
      }
      return floatHashCodeAlternate(innerValue);
    }
    if (cachedHashCodesAlternate.has(value)) {
      return cachedHashCodesAlternate.get(value);
    }
    cachedHashCodesAlternate.set(value, hashCode = objectHashCode(value));
    return hashCode;
  }
  function floatHashCodeAlternate(value) {
    let array = new Int32Array(new Float64Array([value]).buffer);
    let hash = 0;
    for (let i = 0; i < array.length; i++) {
      hash = 0x1fffffff & hash + array[i];
      hash = 0x1fffffff & hash + ((0xfffff & hash) << 11);
      hash = hash ^ hash >> 6;
    }
    hash = 0x1fffffff & hash + ((0x7fffff & hash) << 5);
    hash = hash ^ hash >> 11;
    return 0x1fffffff & hash + ((0x1ffff & hash) << 13);
  }
  function stringHashCodeAlternate(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = 0x1fffffff & hash + value.charCodeAt(i);
      hash = 0x1fffffff & hash + ((0xfffff & hash) << 11);
      hash = hash ^ hash >> 6;
    }
    hash = 0x1fffffff & hash + ((0x7fffff & hash) << 5);
    hash = hash ^ hash >> 11;
    return 0x1fffffff & hash + ((0x1ffff & hash) << 13);
  }
  function booleanHashCodeAlternate(value) {
    return value ? 2 * 3 * 5 * 91 * 3761 : 867 * 811;
  }
  function nullHashCodeAlternate() {
    return 0x832ef932
  }

  exports.classHasMethod = (clazz, name) => {
    return _prototypeHasMethod(clazz.prototype, name);
  };
  function _prototypeHasMethod(proto, name) {
    return proto && (proto[name] || _prototypeHasMethod(proto.__proto__, name));
  }
  exports.classHasProperty = (clazz, name) => {
    return _prototypeHasProperty(clazz.prototype, name);
  };
  function _prototypeHasProperty(proto, name) {
    return proto && (proto.hasOwnProperty(name) || _prototypeHasProperty(proto.__proto__, name));
  }


  return exports;
});
