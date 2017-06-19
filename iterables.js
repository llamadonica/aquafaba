/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
/**
 * @callback Action1
 * @param {!any} val1
 * @return {void}
 */
/**
 * @callback Predicate
 * @param {any} val
 * @return {bool}
 */
/**
 * @callback Lazy
 * @return {!any}
 */
(function (root, factory) {
  if(typeof define === "function" && define.amd) {
    define(["./core.js", "module"], factory);
  } else if(typeof module === "object" && module.exports) { // eslint-disable-line no-undef
    factory(require("core"), module); // eslint-disable-line no-undef
  } else {
    root.Aquafaba = root.Aquafaba || {};
    if (!root.Aquafaba.core) {
      throw new Error("Aquafaba.core was not found");
    }
    let moduleProxy = {exports: {}};
    factory(root.Aquafaba.core, moduleProxy);
    root.Aquafaba.iterables = moduleProxy.exports;
  }
})(this, (core, module) => {
  module.exports = {};
  module.exports.Iterable = class Iterable {
    static [Symbol.hasInstance](obj) {
      return (!!obj[Symbol.iterator]);
    }
    static generate(n, fn = (val) => val) {
      return new (IterableMixin(WrapIterableBase))(
        function* () {
          for (var i = 0; i < n; i++) {
            yield fn(i);
          }
        });
    }
    static generateInfinite(fn = (val) => val) {
      return new (IterableMixin(WrapIterableBase))(
        function* () {
          let i = 0;
          for (;;) {
            yield fn(i++);
          }
        });
    }
  }

  module.exports.ConcurrentModificationException =
      class ConcurrentModificationException {
    constructor(message) {
      this.message = message;
    }
    toString() {
      return `ConcurrentModificationException: ${this.message}`;
    }
  };
  let IterableException = module.exports.IterableException = class IterableException {
    constructor(message) {
      this.message = message;
    }
    toString() {
      return `IterableException: ${this.message}`;
    }
  };

  let _DELEGATE = Symbol('_delegate');
  let _FILTER_BASE = Symbol('_filterBase');
  let WrapIterableBase = module.exports.WrapIterableBase = class WrapIterableBase {
    constructor(delegate) {
      this[_DELEGATE] = delegate;
    }
    [Symbol.iterator]() {
      return this[_DELEGATE]()[Symbol.iterator]();
    }
  }
  let _LENGTH = Symbol('_length');
  let WrapIterableEfficientLengthBase =
      module.exports.WrapIterableEfficientLengthBase =
      class WrapIterableEfficientLengthBase extends WrapIterableBase {
    constructor(delegate, length) {
      super(delegate);
      this[_LENGTH] = length;
    }
    get length() {
      return this[_LENGTH];
    }
  }
  /**
   * A utility mixin, designed to implement a lot of convenience methods
   * for any type that already implements Iterable.
   */
  let EfficientLengthMixin = module.exports.EfficientLengthMixin =
      core.makeGenericType(_EfficientLengthMixiner);
  function _EfficientLengthMixiner(p) {
    let mixedin = class extends p {
      constructor(...args) {
        super(...args);
      }
      static get name() {
        return `EfficientLengthMixin$<${p.name}>`;
      }
    };
    if (!core.classHasProperty(p,'isEmpty')) {
      mixedin = class extends mixedin {
        get isEmpty() {
          return this.length == 0;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasProperty(p,'isNotEmpty')) {
      mixedin = class extends mixedin {
        get isNotEmpty() {
          return this.length != 0;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasMethod(p,'compareLengthTo')) {
      mixedin.prototype.compareLengthTo = function (n) {
        let i = this.length;
        if (i < n) return -1;
        if (i > n) return 1;
        return 0;
      };
    }
    if (!core.classHasMethod(p,'map')) {
      mixedin.prototype.map = function (callback, thisArg) {
        let outerThis = this;
        return new (IterableMixin(EfficientLengthMixin(WrapIterableEfficientLengthBase)))(function* () {
          let i = 0;
          for (let value of outerThis) {
            yield callback.apply(thisArg, [value, i, this]);
            i++;
          }
        }, this.length);
      };
    }
    return _IterableMixiner(mixedin);
  }
  let IterableMixin = module.exports.IterableMixin = core.makeGenericType(_IterableMixiner);
  function _IterableMixiner(p) {
    let mixedin = class extends p {
      constructor(...args) {
        super(...args);
      }
      static get name() {
        return `IterableMixin$<${p.name}>`;
      }
    };
    if (!core.classHasProperty(p, 'first')) {
      mixedin = class extends mixedin {
        get first() {
          let iterator = this[Symbol.iterator]();
          let {value, done} = iterator.next();
          if (done) {
            throw new IterableException('Iterable had no elements.');
          }
          return value;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasProperty(p,'isEmpty')) {
      mixedin = class extends mixedin {
        get isEmpty() {
          let iterator = this[Symbol.iterator]();
          let {done} = iterator.next();
          return done;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasProperty(p,'isNotEmpty')) {
      mixedin = class extends mixedin {
        get isNotEmpty() {
          let iterator = this[Symbol.iterator]();
          let {done} = iterator.next();
          return !done;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasProperty(p, 'last')) {
      mixedin = class extends mixedin {
        get last() {
          let iterator = this[Symbol.iterator]();
          let {value, done} = iterator.next();
          let nextValue;
          if (done) {
            throw new IterableException('Iterable had no elements.');
          }
          while(!done) {
            ({value: nextValue, done} = iterator.next());
            value = done ? value : nextValue;
          }
          return value;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasProperty(p, 'length')) {
      mixedin = class extends mixedin {
        get length() {
          let iterator = this[Symbol.iterator]();
          let i = 0;
          let {done} = iterator.next();
          while (!done) {
            i++;
            ({done} = iterator.next());
          }
          return i;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasProperty(p, 'singleValue')) {
      mixedin = class extends mixedin {
        get singleValue() {
          let iterator = this[Symbol.iterator]();
          let {value, done} = iterator.next();
          if (done) {
            throw new IterableException('Iterable had no elements.');
          }
          ({done} = iterator.next());
          if(!done) {
            throw new IterableException('Iterable had more than 1 element.');
          }
          return value;
        }
        static get name() {
          return `IterableMixin$<${p.name}>`;
        }
      };
    }
    if (!core.classHasMethod(p, 'firstOrDefault')) {
      mixedin.prototype.firstOrDefault = function(callback, thisArg = undefined) {
        let iterator = this[Symbol.iterator]();
        let {value, done} = iterator.next();
        if (done) {
          return callback ? callback.apply(thisArg, []) : undefined;
        }
        return value;
      };
    }
    if (!core.classHasMethod(p, _FILTER_BASE)) {
      mixedin.prototype[_FILTER_BASE] = function(callback, thisArg = undefined) {
        let outerThis = this;
        return new (IterableMixin(WrapIterableBase))(function* () {
          let i = 0;
          for (let value of outerThis) {
            if (callback.apply(thisArg, [value, i, this])) {
              yield {value: value, index: i};
            }
            i++;
          }
        });
      };
    }

    if (!core.classHasMethod(p,'some')) {
      mixedin.prototype.some = function(callback, thisArg = undefined) {
        return this[_FILTER_BASE](callback, thisArg).isNotEmpty;
      };
    }
    if (!core.classHasMethod(p,'includes')) {
      mixedin.prototype.includes = function (searchElement, fromIndex = 0) {
        return this.some((el, ix) => ix >= fromIndex && searchElement == el);
      };
    }
    if (!core.classHasMethod(p, core.getOperator)) {
      mixedin.prototype[core.getOperator] = function (index) {
        let iterator = this[Symbol.iterator]();
        let i = 0;
        let {value, done} = iterator.next();
        while (i < index) {
          ({value, done} = iterator.next());
          i++;
          if (done) {
            throw new RangeError('Iterable index was out of range');
          }
        }
        return value;
      };
    }

    if (!core.classHasMethod(p, 'every')) {
      mixedin.prototype.every = function (callback, thisArg) {
        let iterator = this[Symbol.iterator]();
        let i = 0;
        let {value, done} = iterator.next();
        while (!done) {
          if (!callback.apply(thisArg, [value, i, this])) return false;
          i++;
          ({value, done} = iterator.next());
        }
        return true;
      };
    }
    if (!core.classHasMethod(p, 'indexOf')) {
      mixedin.prototype.indexOf = function (searchElement, fromIndex = 0) {
        return this[_FILTER_BASE]((el, ix) => ix >= fromIndex && el == searchElement).map((x) => x.index).firstOrDefault(() => -1);
      };
    }
    if (!core.classHasMethod(p,'join')) {
      mixedin.prototype.join = function (separator = ',') {
        let iterator = this[Symbol.iterator]();
        let {value, done} = iterator.next();
        if (done) return '';
        let buffer = value.toString();
        ({value, done} = iterator.next());
        while (!done) {
          buffer += (separator || '') + value.toString();
        }
        return buffer;
      };
    }

    if (!core.classHasMethod(p,'filter')) {
      mixedin.prototype.filter = function (callback, thisArg) {
        return this[_FILTER_BASE](callback, thisArg).map((x) => x.value);
      };
    }
    if (!core.classHasMethod(p, 'find')) {
      mixedin.prototype.find = function (callback, thisArg) {
        return this[_FILTER_BASE](callback, thisArg)
            .map((x) => x.value)
            .firstOrDefault(() => undefined);
      };
    }
    if (!core.classHasMethod(p, 'findIndex')) {
      mixedin.prototype.findIndex = function (callback, thisArg) {
        return this[_FILTER_BASE](callback, thisArg)
            .map((x) => x.index)
            .firstOrDefault(() => -1);
      };
    }
    if (!core.classHasMethod(p, 'forEach')) {
      mixedin.prototype.forEach = function (callback, thisArg) {
        let iterator = this[Symbol.iterator]();
        let i = 0;
        let {value, done} = iterator.next();
        while (!done) {
          callback.apply(thisArg, [value, i, this]);
          i++;
          ({value, done} = iterator.next());
        }
      };
    }
    if (!core.classHasMethod(p, 'reduce')) {
      mixedin.prototype.reduce = function (callback, initialValue) {
        let iterator = this[Symbol.iterator]();
        let i = 0;
        let {value, done} = iterator.next();
        if (!initialValue && done) {
          throw new IterableException('No initial value and no elements in reduce');
        } else if (!initialValue) {
          initialValue = value;
          i++;
          ({value, done} = iterator.next());
        }

        while (!done) {
          initialValue = callback.apply(null, [initialValue, value, i, this]);
          i++;
          ({value, done} = iterator.next());
        }
      };
    }
    if (!core.classHasMethod(p,'map')) {
      mixedin.prototype.map = function (callback, thisArg) {
        let outerThis = this;
        return new (IterableMixin(WrapIterableBase))(function* () {
          let i = 0;
          for (let value of outerThis) {
            yield callback.apply(thisArg, [value, i, this]);
            i++;
          }
        });
      };
    }
    if (!core.classHasMethod(p,'compareLengthTo')) {
      mixedin.prototype.compareLengthTo = function (n) {
        let iterator = this[Symbol.iterator]();
        let i = 0;
        let {done} = iterator.next();
        while (!done && i <= n) {
          i++;
          ({done} = iterator.next());
        }
        if (i < n) return -1;
        if (i > n) return 1;
        return 0;
      };
    }
    return mixedin;
    // TODO: implement skip, skipWhile, take, takeWhile
    // and lastIndexOf
  }
});
