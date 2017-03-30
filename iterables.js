/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
define('iterables', ['core'], (core) => {
  let exports = {};
  const T = Symbol('_T');

  exports.Iterable__T = core.makeGenericType((t) =>
    class extends core.Object {
      constructor() {
        super();
        this[T] = t;
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
  exports.Iterator__T = core.makeGenericType((t) =>
    class extends core.Object {
      constructor() {
        super();
        this[T] = t;
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
    }
  );
  const NATIVE_ITERATOR = Symbol('_nativeIterator');
  const CURRENT = Symbol('_current');
  class _WrapIterator extends core.Object {
    constructor(nativeIterator) {
      super();
      this[NATIVE_ITERATOR] = nativeIterator;
    }
    static get implements() {
      return [exports.Iterator__T(core.types.any), exports.Iterator];
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
  exports.Iterator = class extends exports.Iterator__T(core.types.any) {
    constructor(nativeIterator) {
      return new _WrapIterator(nativeIterator);
    }
  };

  exports.IterableMixin__T = core.makeGenericType((t) =>
    class extends exports.Iterable__T {
      static get name() {
        return `IterableMixin${t.name}`
      }
    }
  );
  exports.$IterableMixin__T = core.makeGenericType((p,t) =>
    class extends p {
      static get name() {
        return `${p.name}+$IterableMixin<${t.name}>`;
      }
      static get implements() {
        var originalImplements = p.implements ? p.implements.slice(0) : [];
        originalImplements.push(exports.IterableMixin__T(t));
        return originalImplements;
      }
      get first() {
        var iterator = this.iterator;
        if (!iterator.moveNext())
          throw new core.StateError('Iterable had no elements.');
        return iterator.current;
      }
      get isEmpty() {
        var iterator = this.iterator;
        return (!iterator.moveNext());
      }
      get isNotEmpty() {
        return !this.isEmpty;
      }
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
      get length() {
        var iterator = this.iterator;
        let len = 0;
        while (iterator.moveNext()) {
          len++;
        }
        return len;
      }

    }
  );

  const INNER_ARRAY = Symbol('_innerArray');
  exports.List__T = core.makeGenericType((t) =>
    class extends core.Object {
      constructor(values) {
        super();
        this[T] = t;
        this[INNER_ARRAY] = values ? values.slice(0) : [];
      }
      getOperator(index) {
        return this[INNER_ARRAY][index];
      }
      setOperator(index, value) {
        this[INNER_ARRAY][index] = value;
      }
    }
  )

  return exports;
});
