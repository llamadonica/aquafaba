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
define('iterables', ['core'], (core) => {
  let exports = {};
  const T = Symbol('_T');

  const COUNT = Symbol('_count');
  const OFFSET = Symbol('_offset');
  const MAP_FN = Symbol('_mapFn');
  const CURRENT = Symbol('_current');

  let _GenIterator__T = core.makeGenericType((t) =>
    class extends core.Object {
      constructor(count, mapFn) {
        super();
        this[COUNT] = count;
        this[OFFSET] = -1;
        this[MAP_FN] = mapFn || ((x) => x);
        this[CURRENT] = undefined;

        this[T] = t;
        if (!mapFn &&
            t != core.types.any &&
            t != core.types.double &&
            t != core.types.int) {
          throw new core.StateError(
              '_GenIterator<T>: mapFn was not provided and type was not a' +
              ' supertype of int');
        }
      }
      static get name() {
        return `_GenIterator<${t.name}>`;
      }
      static get implements() {
        return [exports.Iterator__T(t)];
      }
      get current() {
        if (this[OFFSET] < 0 || this[OFFSET] >= this[COUNT]) {
          throw new core.StateError(
              '_GenIterator<T>: iterator is off track');
        }
        if (this[CURRENT] === undefined) {
          this[CURRENT] = this[MAP_FN](this[OFFSET]);
        }
        return this[CURRENT];
      }
      moveNext() {
        this[OFFSET]++;
        delete this[CURRENT];
        if (this[OFFSET] >= this[COUNT]) return false;
        return true;
      }
    }
  );
  let GenIterable__T = core.makeGenericType((t) =>
    class extends exports.$IterableMixin__T(core.Object, t) {
      constructor(count, mapFn) {
        super();
        this[COUNT] = count;
        this[MAP_FN] = mapFn || ((x) => x);

        this[T] = t;
        if (!mapFn &&
            t != core.types.any &&
            t != core.types.double &&
            t != core.types.int) {
          throw new core.StateError(
              '_GenIterator<T>: mapFn was not provided and type was not a' +
              ' supertype of int');
        }
      }
      static get name() {
        return `_GenIterable<${t.name}>`;
      }
      get iterator() {
        return new (_GenIterator__T(t))(this[COUNT], this[MAP_FN]);
      }
    }
  );

  exports.Iterable__T = core.makeGenericType((t) =>
    class extends core.Object {
      constructor() {
        super();
        this[T] = t;
      }
      static get generate() {
        return GenIterable__T(t);
      }

      static get name() {
        return `Iterable<${t.name}>`;
      }
      static check(obj, target) {
        core.assert(() => target !== exports.Iterable__T(t),
        "Iterable is abstract and can't be called directly");
        core.assert(() => 'first' in obj,
        "Iterable must implement `first` property");
        core.assert(() => 'isEmpty' in obj,
        "Iterable must implement `isEmpty` property");
        core.assert(() => 'isNotEmpty' in obj,
        "Iterable must implement `isNotEmpty` property");
        core.assert(() => 'iterator' in obj,
        "Iterable must implement `iterator` property");
        core.assert(() => 'last' in obj,
        "Iterable must implement `last` property");
        core.assert(() => 'length' in obj,
        "Iterable must implement `length` property");
        core.assert(() => 'single' in obj,
        "Iterable must implement `single` property");
        core.assert(() => obj.any !== undefined,
        "Iterable must implement `any` function");
        core.assert(() => obj.contains !== undefined,
        "Iterable must implement `contains` function");
        core.assert(() => obj.elementAt !== undefined,
        "Iterable must implement `elementAt` function");
        core.assert(() => obj.every !== undefined,
        "Iterable must implement `every` function");
        core.assert(() => obj.expand !== undefined,
        "Iterable must implement `expand` function");
        core.assert(() => obj.firstWhere !== undefined,
        "Iterable must implement `firstWhere function");
        core.assert(() => obj.fold !== undefined,
        "Iterable must implement `fold` function");
        core.assert(() => obj.forEach !== undefined,
        "Iterable must implement `forEach` function");
        core.assert(() => obj.join !== undefined,
        "Iterable must implement `join` function");
        core.assert(() => obj.lastWhere !== undefined,
        "Iterable must implement `lastWhere` function");
        core.assert(() => obj.map !== undefined,
        "Iterable must implement `map<S>` function");
        core.assert(() => obj.reduce !== undefined,
        "Iterable must implement `reduce<S>` function");
        core.assert(() => obj.singleWhere !== undefined,
        "Iterable must implement `singleWhere` function");
        core.assert(() => obj.skip !== undefined,
        "Iterable must implement `skip` function");
        core.assert(() => obj.skipWhile !== undefined,
        "Iterable must implement `skipWhile` function");
        core.assert(() => obj.take !== undefined,
        "Iterable must implement `take` function");
        core.assert(() => obj.takeWhile !== undefined,
        "Iterable must implement `takeWhile` function");

        core.assert(() => obj.ofType !== undefined,
        "Iterable must implement `ofType<E>``");
        core.assert(() => obj.compareLengthTo !== undefined,
        "Iterable must implement `compareLengthTo`");
        // core.assert(() => obj.toList !== undefined,
        // "Iterable must implement `toList` function");
        // core.assert(() => obj.toSet !== undefined,
        // "Iterable must implement `toSet` function");
        // There aren't any lists or sets yet :(
        core.assert(() => obj.where !== undefined,
        "Iterable must implement `where` function");
        obj[Symbol.iterator] = () => core.as(obj.iterator, exports.Iterator__T(t));
      }
    }
  );
  let iteratorClass;
  iteratorClass = (t) => class extends core.Object {
    constructor() {
      super();
      this[T] = t;
    }
    static $isSupertypeOf(type) {
      for (let baseType of type[core.TYPE_INFO][core.SUPERTYPES]) {
        if (baseType.$isGeneric &&
            baseType.$classDefinition == iteratorClass &&
            core.isSupertypeOf(t, baseType.$typeArguments[0])) return true;
      }
      return false;
    }
    static check(obj, target) {
      core.assert(() => target !== exports.Iterator__T(t),
      "Iterator is abstract and can't be called directly");
      core.assert(() => 'current' in obj,
      "Iterator must implement `current` property");
      core.assert(() => obj.moveNext !== undefined,
      "Iterator must implement `moveNext` function");
      obj.next = () => {
        if (!obj.moveNext()) {
          return {done:true};
        }
        return {
          done:false,
          value:obj.current
        };
      };
    }
    static get name() {
      return `Iterarator<${t.name}>`;
    }
  };
  exports.Iterator__T = core.makeGenericType(iteratorClass);
  const NATIVE_ITERATOR = Symbol('_nativeIterator');
  exports.WrapIterator = class _WrapIterator extends core.Object {
    constructor(nativeIterator) {
      super();
      this[NATIVE_ITERATOR] = nativeIterator;
    }
    static get implements() {
      return [exports.Iterator__T(core.types.any)];
    }
    static get name() {
      return '_WrapIterator';
    }
    moveNext() {
      let {done, value} = this[NATIVE_ITERATOR].next();
      this[CURRENT] = value;
      if (done) return false;
    }
    get current() {
      return this[CURRENT];
    }
  }


  exports.IterableMixin__T = core.makeGenericType((t) =>
    class extends exports.Iterable__T(t) {
      static get name() {
        return `IterableMixin+${t.name}`
      }
    }
  );
  exports.$IterableMixin__T = core.makeGenericType((p,t) =>
    class extends p {
      /** @type {String} */
      static get name() {
        return `${p.name}+$IterableMixin<${t.name}>`;
      }
      static get implements() {
        var originalImplements = p.implements ? p.implements.slice(0) : [];
        originalImplements.push(exports.IterableMixin__T(t));
        return originalImplements;
      }
      /** @type {!any} */
      get first() {
        var iterator = this.iterator;
        if (!iterator.moveNext())
          throw new core.StateError('Iterable had no elements.');
        return iterator.current;
      }
      /** @type {!bool} */
      get isEmpty() {
        var iterator = this.iterator;
        return (!iterator.moveNext());
      }
      /** @type {!bool} */
      get isNotEmpty() {
        return !this.isEmpty;
      }
      /** @type {!any} */
      get last() {
        var iterator = this.iterator;
        if (!iterator.moveNext())
          throw new core.StateError('Iterable had no elements.');
        let last;
        do {
          last = iterator.current;
        } while (iterator.moveNext());
        return last;
      }
      /** @type {int} */
      get length() {
        var iterator = this.iterator;
        let len = 0;
        while (iterator.moveNext()) {
          len++;
        }
        return len;
      }
      /** @type {!any} */
      get single() {
        var iterator = this.iterator;
        if (!iterator.moveNext()) {
          throw new core.StateError('Iterable had no elements.');
        }
        let result = iterator.current;
        if (iterator.moveNext()) {
          throw new core.StateError('Iterable had more than one element.');
        }
        return result;
      }
      /**
       * Get the first instance of an iterable that meets predicate.
       * @param {Predicate} fn
       * @return {!any}
       */
      any(fn = () => true) {
        let iterator = this.iterator;
        while (iterator.moveNext()) {
          if (fn(iterator.current)) {
            return true;
          }
        }
        return false;
      }
      contains(val) {
        return this.any((other) => core.equals(val, other));
      }
      /**
       * Get the element at the specified index.
       * @param {int} index
       */
      elementAt(index) {
        let iterator = this.iterator;
        let innerIndex = 0;
        while (innerIndex < index) {
          if (!iterator.moveNext()) {
            throw new core.StateError(`Iterable index ${index} out of bounds.`);
          }
          innerIndex++;
        }
        return iterator.current;
      }
      every(fn) {
        let iterator = this.iterator;
        while (iterator.moveNext()) {
          if (!fn(iterator.current)) {
            return false;
          }
        }
        return true;
      }
      expand(fn) {
        return new _WrapIterable(function* () {
          for (let value of this) {
            for (let result of fn(value)) {
              yield result;
            }
          }
        });
      }
      /**
       * Return the first object meeting a specific predicate.
       * @param {Predicate} fn
       * @param {Lazy} orElse
       */
      firstWhere(fn, {orElse = null} = {}) {
        let innerIterable = this.where(fn);
        if (innerIterable.isEmpty && orElse) {
          return orElse();
        } else if (innerIterable.isEmpty) {
          throw new core.StateError('No element in list matching predicate.');
        }
        return innerIterable.first;
      }
      fold(initialValue, combineFn) {
        let iterator = this.iterator;
        while (iterator.moveNext()) {
          initialValue = combineFn(initialValue, iterator.current);
        }
        return initialValue;
      }
      /**
       * Apply a function repeatedly to each member of an `Iterable`.
       * @param  {(input: any): bool} fn
       * @returns {void}
       */
      forEach(fn) {
        let iterator = this.iterator;
        while (iterator.moveNext()) {
          fn(iterator.current);
        }
      }
      /**
       * Join the element with a specic element.
       * @param {?String} separator
       * @returns {String}
       */
      join(separator = '') {
        let buffer = '';
        let iterator = this.iterator;
        if (!iterator.moveNext()) {
          return buffer;
        }
        buffer += iterator.current.toString();
        while (iterator.moveNext()) {
          buffer += (separator || '') + iterator.current.toString();
        }
        return buffer;
      }
      /**
       * Get the last element meeting the specified predicate.
       * @param {Predicate} predicate
       * @param {?Lazy} orElse
       * @returns {any}
       */
      lastWhere(predicate, {orElse = null} = {}) {
        let innerIterable = this.where(fn);
        if (innerIterable.isEmpty && orElse) {
          return orElse();
        } else if (innerIterable.isEmpty) {
          throw new core.StateError('No element in list matching predicate.');
        }
        return innerIterable.last;
      }
      /**
       *
       */
      map(mapper) {
        return _WrapIterable(function* () {
          for (let value of this) {
            yield mapper(value);
          }
        });
      }
      reduce(combine) {
        let iterator = this.iterator;
        if (!iterator.moveNext()) {
          throw new core.StateError('No element in Iterable');
        }
        let value = iterator.current;
        while (iterator.moveNext()) {
          value = combine(value, iterator.current);
        }
        return value;
      }
      singleWhere(fn) {
        let iterator = this.where(fn).iterator;
        if (!iterator.moveNext()) {
          throw new core.StateError('No element in list matching predicate.');
        }
        let result = iterator.current;
        if (iterator.moveNext()) {
          throw new core.StateError('More than 1 element in list matching predicate.');
        }
        return result;
      }
      skip(n) {
        return new _WrapIterable(function* () {
          let n_i = n;
          for (let val of this) {
            if (n_i <= 0) {
              yield val;
            } else {
              n_i--;
            }
          }
        });
      }
      skipWhile(condition) {
        return new _WrapIterable(function* () {
          let yielding = false;
          for (let val of this) {
            if (yielding) {
              yield val;
            } else if (!condition(val)) {
              yielding = true;
              yield val;
            }
          }
        });
      }
      take(n) {
        return new _WrapIterable(function* () {
          let n_i = n;
          for (let val of this) {
            if (n_i <= 0) return;
            yield val;
            n_i--;
          }
        });
      }
      takeWhile(condition) {
        return new _WrapIterable(function* () {
          for (let val of this) {
            if (!condition(val)) return;
            yield val;
          }
        });
      }
      ofType(t) {
        return function () {
          return _WrapIterable(function* () {
            for (let val of this) {
              if (core.isInstanceOf(val, t)) yield val;
            }
          });
        };
      }
      compareLengthTo(n) {
        var iterator = this.iterator;
        let len = 0;
        while (iterator.moveNext() && len <= n) {
          len++;
        }
        if (len < n) return -1;
        if (len == n) return 0;
        return 1;
      }
      where(condition) {
        return _WrapIterable(function* () {
          for (let val of this) {
            if (condition(val)) yield val;
          }
        });
      }
    }
  );

  const NATIVE_ITERABLE = Symbol('_nativeIterable');
  exports.WrapIterable = class _WrapIterable extends exports.$IterableMixin__T(core.Object, core.types.any) {
    constructor(nativeIterable) {
      super();
      this[NATIVE_ITERABLE] = nativeIterable;
    }
    static get name() {
      return '_WrapIterable';
    }
    get iterator() {
      return new _WrapIterator(this[NATIVE_ITERATOR][Symbol.iterator]);
    }
  };

  const INNER_ARRAY = Symbol('_innerArray');
  exports.List__T = core.makeGenericType((t) =>
    class extends core.Object {
      constructor(values) {
        super();
        this[T] = t;
        this[INNER_ARRAY] = values ? values.slice(0) : [];
      }
      [core.getOperator](index) {
        return this[INNER_ARRAY][index];
      }
      [core.setOperator](index, value) {
        this[INNER_ARRAY][index] = value;
      }
    }
  )

  return exports;
});
