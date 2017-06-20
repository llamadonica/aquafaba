/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
(function (root, factory) {
  if(typeof define === "function" && define.amd) {
    define(["./core.js", "./iterables.js", "module"], factory);
  } else if(typeof module === "object" && module.exports) { // eslint-disable-line no-undef
    factory(require("core"), require("iterables"), module); // eslint-disable-line no-undef
  } else {
    root.Aquafaba = root.Aquafaba || {};
    if (!root.Aquafaba.core) {
      throw new Error("Aquafaba.core was not found");
    }
    if (!root.Aquafaba.iterables) {
      throw new Error("Aquafaba.iterables was not found");
    }
    let moduleProxy = {exports: {}};
    factory(root.Aquafaba.core, root.Aquafaba.iterables, moduleProxy);
    root.Aquafaba.collection = moduleProxy.exports;
  }
})(this, (core, iterables, module) => {
  module.exports = {};

  const _SIZE = Symbol('_size');
  const _SALT1 = Symbol('_salt1');
  const _SALT2 = Symbol('_salt2');
  const _COUNT = Symbol('_count');
  const _CELLS = Symbol('_cells');
  const _MAX_ATTEMPTS = Symbol('_maxAttempts');
  const _MAX_LOAD = 0.80;
  const _BUMP_FACTOR = 0.50;
  const _MAX_ITEMS_PER_CELL = 3;
  const _REV = Symbol('_rev');
  const _GET_EXISTING_CELLS_NEW_OFFSET = Symbol('_getExistingCellsNewOffset');
  const _GET_LOOKUP_OFFSET = Symbol('_getLookupOffset');
  const _GET_INSERT_OFFSET = Symbol('_getInsertOffset');
  const _REMOVE_AT = Symbol('_removeAt');
  const _GET_CELL_HASHABLE = Symbol('_getCellHashable');
  const _UPSERT = Symbol('_upsert');
  const _RESIZE = Symbol('_resze');
  const _MAX_BEFORE_RESIZE = Symbol('_maxBeforeResize');
  const _INITIAL_CLEAR = Symbol('_initialSetup');
  const _INTERNAL_CLEAR = Symbol('_internalClear');
  const _REINSERT = Symbol('_reinsert');
  const _GET_LOOKUP_OFFSET_FOR_CACHE_KEY = Symbol('_getLookupOffsetForCacheKey');
  const _ENTRIES = Symbol('_entries');
  const _DELEGATE = Symbol('_delegate');
  const _NATIVE_ENTRIES = Symbol('_nativeEntries');

  class _WrapMapIterator {
    constructor(map, delegate) {
      this[_DELEGATE] = delegate;
      this[_REV] = map[_REV];
      this[_MAP] = map;
    }
    next() {
      if (this[_REV] != this[_MAP][_REV]) {
        throw new iterables.ConcurrentModificationException();
      }
      return this[_DELEGATE].next();
    }
  }
  class _WrapMapIterableBase {
    constructor(map) {
      this[_ENTRIES] = map[_NATIVE_ENTRIES]();
      this[_MAP] = map;
    }
    [Symbol.iterator]() {
      return new _WrapMapIterator(this[_MAP], this[_ENTRIES][Symbol.iterator]());
    }
    get length() {
      return this[_MAP].size;
    }

  }

  let _WrapMapIterable = iterables.EfficientLengthMixin(_WrapMapIterableBase);
  let WRAP_CONTENTS = Symbol('_wrapMapContents');

  module.exports.WrapMap = class WrapMap {
    constructor(sizeOrMap) {
      if (sizeOrMap instanceof Map) {
        this[WRAP_CONTENTS] = new Map(sizeOrMap);
      } else {
        this[WRAP_CONTENTS] = new Map();
      }
      if (sizeOrMap && sizeOrMap.entries) {
        this.setAll(sizeOrMap);
      }
      this[_REV] = 0;
    }
    setAll(map) {
      for (let [key,value] of map.entries()) {
        this.set(key,value);
      }
    }
    set(key, value) {
      if (!this.has(key)) {
        this[_REV]++;
      }
      this[WRAP_CONTENTS].set(key,value);
    }
    setIfAbsent(key, valueFactory) {
      if (!this.has(key)) {
        this[_REV]++;
        this[WRAP_CONTENTS].set(key,valueFactory());
      }
    }
    get size() {
      return this[WRAP_CONTENTS].size;
    }
    get(key) {
      return this[WRAP_CONTENTS].get(key);
    }
    has(key) {
      return this[WRAP_CONTENTS].has(key);
    }
    delete(key) {
      if (this.has(key)) {
        this[_REV]++;
      }
      this[WRAP_CONTENTS].delete(key);
    }
    clear() {
      if (this.size > 0) {
        this[_REV]++;
      }
      this[WRAP_CONTENTS].clear();
    }
    [_NATIVE_ENTRIES]() {
      return this[WRAP_CONTENTS].entries();
    }
    entries() {
      return new _WrapMapIterable(this);
    }
    keys() {
      return this.entries().map(([key]) => key);
    }
    values() {
      return this.entries().map(kvPair => kvPair[1]);
    }
    forEach(callback, thisArg) {
      this[WRAP_CONTENTS].forEach(callback, thisArg);
    }
  };

  /* A strut type to enable the key to be cached */
  class _HashCachingKey {
    constructor(key) {
      this.key = key;
      this.cachedSalts = new WeakMap();
    }
    hashCode(salt) {
      if (this.cachedSalts.has(salt)) {
        return this.cachedSalts.get(salt);
      }
      let hashCode = core.hashCode(this.key, salt);
      this.cachedSalts.set(salt, hashCode);
      return hashCode;
    }

  }
  class _CuckooHashCollection {
    constructor(size = 1) {
      this[_SIZE] = nextBestPrime(size);
      this[_SALT1] = core.HashSalt.firstCommon;
      this[_SALT2] = core.HashSalt.secondCommon;
      this[_REV] = 0;
      this[_INTERNAL_CLEAR]();
      this[_INITIAL_CLEAR]();
    }
    static get MAX_ITEMS_PER_CELL() {
      return _MAX_ITEMS_PER_CELL;
    }
    static get MAX_LOAD() {
      return _MAX_LOAD;
    }
    static get BUMP_FACTOR() {
      return _BUMP_FACTOR;
    }
    [_INITIAL_CLEAR]() {
      if (this[_COUNT]) {
        this[_REV]++;
      }
      this[_COUNT] = 0;
    }
    [_INTERNAL_CLEAR]() {
      this[_CELLS] = new Array(_CuckooHashCollection.MAX_ITEMS_PER_CELL * this[_SIZE]);
      this[_MAX_BEFORE_RESIZE] = (_CuckooHashCollection.MAX_LOAD * _CuckooHashCollection.MAX_ITEMS_PER_CELL * this[_SIZE])|0;
      this[_MAX_ATTEMPTS] = 12 + _log2(this[_SIZE]);
    }
    clear() {
      this[_INTERNAL_CLEAR]();
      this[_INITIAL_CLEAR]();
    }
    // Get the new cell of an existing offset.
    [_GET_EXISTING_CELLS_NEW_OFFSET](hashable, butNot) {
      let i1 = (hashable.key.hashCode(this[_SALT1]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      let ixToInsert;
      if (i1 != butNot) {
        ixToInsert = i1;
        for (let ix = i1;  ix < i1 + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
          if (!this[_CELLS][ix]) {
            return {mustKick: false, ix: ix};
          }
        }
      }
      let i2 = (hashable.key.hashCode(this[_SALT2]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      if (i2 != butNot || i1 == i2) {
        ixToInsert = i2;
        for (let ix = i2;  ix < i2 + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
          if (!this[_CELLS][ix]) {
            return {mustKick: false, ix: ix};
          }
        }
      }
      assert(() => ixToInsert != null);
      return {mustKick: true, ix: ixToInsert};
    }
    [_GET_LOOKUP_OFFSET_FOR_CACHE_KEY](hashKey) {
      let i = (hashKey.hashCode(this[_SALT1]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      // console.log(`Looking for ${hashable} at index ${i}`);
      for (let ix = i; ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (!this[_CELLS][ix]) {
          break;
        }
        if (core.equals(hashKey.key, this[_GET_CELL_HASHABLE](this[_CELLS][ix]).key)) {
          return ix;
        }
      }
      i = (hashKey.hashCode( this[_SALT2]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      // console.log(`Looking for ${hashable} at index ${i}`);
      for (let ix = i; ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (!this[_CELLS][ix]) {
          break;
        }
        if (core.equals(hashKey.key, this[_GET_CELL_HASHABLE](this[_CELLS][ix]).key)) {
          ix;
        }
      }
      return -1;
    }
    [_GET_INSERT_OFFSET](hashable) {
      let i1 = (core.hashCode(hashable, this[_SALT1]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      let firstIx = i1, firstEmptyIx;
      for (let ix = i1; ix < i1 + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (this[_CELLS][ix] && core.equals(hashable, this[_GET_CELL_HASHABLE](this[_CELLS][ix]).key)) {
          return {update: true, ix: ix};
        } else if (!this[_CELLS][ix]) {
          firstEmptyIx = firstEmptyIx == null ? ix : firstEmptyIx;
        }
      }
      let i2 = (core.hashCode(hashable, this[_SALT2]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      for (let ix = i2; ix < i2 + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (this[_CELLS][ix] && core.equals(hashable, this[_GET_CELL_HASHABLE](this[_CELLS][ix]).key)) {
          return {update: true, ix: ix};
        } else if (!this[_CELLS][ix]) {
          firstEmptyIx = firstEmptyIx == null ? ix : firstEmptyIx;
        }
      }
      if (firstEmptyIx != null) {
        return {update: false, mustKick: false, ix: firstEmptyIx };
      }
      return {update: false, mustKick: true, ix: firstIx};
    }
    [_GET_LOOKUP_OFFSET](hashable) {
      let i = (core.hashCode(hashable, this[_SALT1]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      // console.log(`Looking for ${hashable} at index ${i}`);
      for (let ix = i; ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (!this[_CELLS][ix]) {
          break;
        }
        if (core.equals(hashable, this[_GET_CELL_HASHABLE](this[_CELLS][ix]).key)) {
          return ix;
        }
      }
      i = (core.hashCode(hashable, this[_SALT2]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      // console.log(`Looking for ${hashable} at index ${i}`);
      for (let ix = i; ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (!this[_CELLS][ix]) {
          break;
        }
        if (core.equals(hashable, this[_GET_CELL_HASHABLE](this[_CELLS][ix]).key)) {
          return ix;
        }
      }
      return -1;
    }
    [_REMOVE_AT](ix) {
      if (this[_CELLS][ix]) {
        this[_COUNT]--;
        this[_REV]++;
      }
      let ixPathEnd = ix - (ix % _CuckooHashCollection.MAX_ITEMS_PER_CELL) + _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      let ixToReplaceMe;
      for (ixToReplaceMe = ix; ixToReplaceMe < ixPathEnd - 1; ixToReplaceMe++) {
        if (!this[_CELLS][ixToReplaceMe + 1]) {
          break;
        }
      }
      // ixToReplaceMe will now be the last node that can be moved closer to
      // or my own value, if none was found.
      let result = this[_CELLS][ix];
      this[_CELLS][ix] = this[_CELLS][ixToReplaceMe];
      this[_CELLS][ixToReplaceMe] = null;
      return result;
    }
    [_UPSERT](hashable, value) {
      let {update, mustKick, ix} = this[_GET_INSERT_OFFSET](hashable);
      let cuckooAttemptsRemaining = this[_MAX_ATTEMPTS];
      if (update) {
        this[_CELLS][ix].value = value;
        return;
      }
      let insertionCell = this[_GEN_KVPAIR_CELL](new _HashCachingKey(hashable), value);
      insertionCell.ix = ix;
      // Can you kick it?
      // console.log(`Inserting ${insertionCell.key.key} = ${insertionCell.value} -> ${ix}`);
      while (mustKick) {
        // Yes you can!
        let oldCell = this[_CELLS][ix];
        this[_CELLS][ix] = insertionCell;
        let butNot = ix;
        if (cuckooAttemptsRemaining <= 0 || this[_COUNT] > this[_MAX_BEFORE_RESIZE]) {
          this[_RESIZE](cuckooAttemptsRemaining <= 0);
          butNot = -1;
          cuckooAttemptsRemaining = this[_MAX_ATTEMPTS];
        }
        cuckooAttemptsRemaining--;
        ({mustKick, ix} = this[_GET_EXISTING_CELLS_NEW_OFFSET](insertionCell = oldCell, butNot));
        insertionCell.ix = ix;
        // console.log(`Relocating ${insertionCell.key.key} = ${insertionCell.value} -> ${ix}`);
      }
      this[_CELLS][ix] = insertionCell;
      this[_REV]++;
      this[_COUNT]++;
    }
    [_REINSERT](cell) {
      let {mustKick, ix} = this[_GET_EXISTING_CELLS_NEW_OFFSET](cell, -1);
      // console.log(`Moving ${cell.key.key} = ${cell.value} -> ${ix} after resize`);
      let cuckooAttemptsRemaining = this[_MAX_ATTEMPTS];
      cell.ix = ix;
      while (mustKick) {
        let oldCell = this[_CELLS][ix];
        this[_CELLS][ix] = cell;
        let butNot = ix;
        if (cuckooAttemptsRemaining <= 0 || this[_COUNT] > this[_MAX_BEFORE_RESIZE]) {
          this[_RESIZE](cuckooAttemptsRemaining <= 0);
          butNot = -1;
          cuckooAttemptsRemaining = this[_MAX_ATTEMPTS];
        }
        cuckooAttemptsRemaining--;
        ({mustKick, ix} = this[_GET_EXISTING_CELLS_NEW_OFFSET](cell = oldCell, butNot));
        cell.ix = ix;
        // console.log(`Relocating ${cell.key.key} = ${cell.value} -> ${ix} after resize (rare).`);
      }
      this[_CELLS][ix] = cell;
    }

    [_RESIZE](resalt = false, targetSize = 0) {
      // console.log(`Resizing`);
      let oldCells = this[_CELLS];
      let oldSize = this[_SIZE];
      targetSize = targetSize || (oldSize / _CuckooHashCollection.BUMP_FACTOR)|0;
      this[_SIZE] = nextBestPrime(targetSize);
      if (resalt) {
        this[_SALT1] = new core.HashSalt();
        this[_SALT2] = new core.HashSalt();
      }
      this[_INTERNAL_CLEAR]();
      for (let cell of oldCells) {
        if (!cell) continue;
        this[_REINSERT](cell);
      }
    }
  }
  const _KEY = Symbol('_key');
  const _VALUE = Symbol('_value');
  class KVPair {
    constructor(key, value) {
      this[_KEY] = key;
      this[_VALUE] = value;
    }
    get key() {
      return this[_KEY];
    }
    get value() {
      return this[_VALUE];
    }
    set value(newValue) {
      this[_VALUE] = newValue;
    }
  }

  const _NEXT = Symbol('_next');
  const _PREV = Symbol('_prev');

  let LinkedListNodeMixin = core.makeGenericType((p) => {
    return class extends p {
      constructor(...args) {
        super(...args);
        this[_NEXT] = null;
        this[_PREV] = null;
      }
      insertAfter(node) {
        this.remove();
        this[_NEXT] = node[_NEXT];
        this[_PREV] = node;
        node[_NEXT] = this;
        if (this[_NEXT]) this[_NEXT][_PREV] = this;
      }
      insertBefore(node) {
        this.remove();
        this[_PREV] = node[_PREV];
        this[_NEXT] = node;
        node[_PREV] = this;
        if (this[_PREV]) this[_PREV][_NEXT] = this;
      }
      remove() {
        if (this[_NEXT]) this[_NEXT][_PREV] = this[_PREV];
        if (this[_PREV]) this[_PREV][_NEXT] = this[_NEXT];
        this[_NEXT] = this[_PREV] = null;
      }
    }
  });
  let KVNodeLinkedListNode = LinkedListNodeMixin(KVPair);

  const _MAP = Symbol('_map');
  const _INDEX = Symbol('_index');
  const _FN = Symbol('_fn');
  const _I = Symbol('_i');
  class _CuckooHashCollectionIterator {
    constructor(map, fn = x => x) {
      this[_MAP] = map;
      this[_INDEX] = -1;
      this[_FN] = fn;
      this[_REV] = map[_REV];
      this[_I] = 0;
    }
    next() {
      let cell;
      if (this[_REV] != this[_MAP][_REV]) {
        throw new iterables.ConcurrentModificationException(
            'Map was modified during iteration.');
      }
      do {
        this[_INDEX]++;
      }  while (
        (this[_INDEX]) <
            this[_MAP][_SIZE] * _CuckooHashCollection.MAX_ITEMS_PER_CELL
        &&
        !(cell = this[_MAP][_CELLS][this[_INDEX]]));
      if (!cell) {
        let map = this[_MAP];
        let i = this[_I];
        core.assert(() => i == map.size, "Expected number of elements yielded to be same as list length");
        return {done: true};
      }
      this[_I]++;
      return {done: false, value: this[_FN](cell)};
    }
  }
  class _CuckooHashCollectionIterableBase {
    constructor(map, fn = x => x) {
      this[_MAP] = map;
      this[_FN] = fn;
    }
    [Symbol.iterator]() {
      return new _CuckooHashCollectionIterator(this[_MAP], this[_FN]);
    }
    get length() {
      return this[_MAP].size;
    }
  }

  let _CuckooHashCollectionIterable =
    iterables.EfficientLengthMixin(_CuckooHashCollectionIterableBase);

  const _CURRENT = Symbol('_current');

  class _LinkedListIterator {
    constructor(rootNode, fn = x => x) {
      this[_ROOT_NODE] = rootNode;
      this[_CURRENT] = rootNode;
      this[_FN] = fn;
    }
    next() {
      this[_CURRENT] = this[_CURRENT][_NEXT];
      if (!this[_CURRENT]) {
        throw new iterables.IterableException(
            'I seem to have gone off the rails');
      }
      if (this[_CURRENT] != this[_ROOT_NODE]) {
        return {done:false, value: this[_FN](this[_CURRENT])};
      }
      return {done: true};
    }
  }

  const _ROOT_NODE = Symbol('_rootNode');
  class _LinkedListIterableBase {
    constructor(rootNode, fn = x => x) {
      this[_ROOT_NODE] = rootNode;
      this[_FN] = fn;
    }
    [Symbol.iterator]() {
      return new _LinkedListIterator(this[_ROOT_NODE], this[_FN]);
    }
  }
  // let _LinkedListIterable =iterables.IterableMixin(_LinkedListIterableBase);

  const _GEN_KVPAIR_CELL = Symbol('_genKVPair');
  const _GEN_ITERABLE = Symbol('_genIterable');

  let HashMap = module.exports.HashMap = class HashMap extends _CuckooHashCollection {
    constructor(sizeOrMap) {
      let size = 1;
      if (typeof sizeOrMap === 'number') {
        size = sizeOrMap;
      } else if (sizeOrMap instanceof HashMap) {
        size = sizeOrMap[_SIZE] - 1;
      } else if (sizeOrMap && sizeOrMap.size) {
        size = ((sizeOrMap.size / _CuckooHashCollection.MAX_LOAD)|0);
      }
      super(size);
      if (sizeOrMap instanceof HashMap) {
        // Short circuit when the other type was already in our format.
        // Saves a bit of rehashing.
        this[_SALT1] = sizeOrMap[_SALT1];
        this[_SALT2] = sizeOrMap[_SALT2];
        this[_SIZE] = sizeOrMap[_SIZE];
        this[_COUNT] = sizeOrMap[_COUNT];
        for (let cell of sizeOrMap[_GEN_ITERABLE]()) {
          this[_CELLS][cell.ix] = this[_GEN_KVPAIR_CELL](cell.key, cell.value);
        }
        return;
      }
      if (sizeOrMap && sizeOrMap.keys && sizeOrMap.get) {
        for (let [key, value] of sizeOrMap.entries()) {
          this.set(key, value);
        }
      }
    }
    [_GEN_KVPAIR_CELL](key, value) {
      return new KVPair(key, value);
    }
    [_GET_CELL_HASHABLE](/** @type{KVPair} */ cell) {
      return cell.key;
    }
    get(key) {
      let ix = this[_GET_LOOKUP_OFFSET](key);
      if (ix < 0) return;
      return this[_CELLS][ix].value;
    }
    has(key) {
      let ix = this[_GET_LOOKUP_OFFSET](key);
      return ix >= 0;
    }
    set(key, value) {
      this[_UPSERT](key, value);
    }
    setIfAbsent(key, valueFactory) {
      if (!this.has(key)) {
        this.set(key, valueFactory());
      }
    }
    delete(key) {
      let ix = this[_GET_LOOKUP_OFFSET](key)
      if (ix < 0) return;
      return this[_REMOVE_AT](ix).value;
    }
    get size() {
      return this[_COUNT];
    }
    setAll(map) {
      // This is very conservative. It will only grow the list
      // When the quantity of new inserts is actually greater than
      // the existing. We could also do a shrink after?
      // There's not a great way to do shortcuts. Resalting is way too
      // common.
      let newMinimumSize = map.size / _CuckooHashCollection.MAX_LOAD | 0;
      if (newMinimumSize > this[_SIZE]) {
        this[_RESIZE](false, newMinimumSize);
      }
      for (let [key, value] of map.entries()) {
        this.set(key, value);
      }
    }
    [_GEN_ITERABLE](fn = x => x) {
      return new _CuckooHashCollectionIterable(this, fn);
    }
    entries() {
      return this[_GEN_ITERABLE]((x) => [x.key.key, x.value]);
    }
    keys() {
      return this[_GEN_ITERABLE]((x) => x.key.key);
    }
    values() {
      return this[_GEN_ITERABLE]((x) => x.value);
    }
    forEach(callback, thisArg) {
      return this[_GEN_ITERABLE]((x) => x).forEach((entry) => {
        callback.apply(thisArg, [entry.value, entry.key.key]);
      });
    }
  }

  class _LinkedHashMapIterator extends _LinkedListIterator {
    constructor(rootNode, fn = x => x) {
      super(rootNode, fn);
      this[_REV] = rootNode[_REV];
      this[_MAP] = rootNode;
      this[_I] = 0;
    }
    next() {
      if (this[_REV] != this[_MAP][_REV]) {
        throw new iterables.ConcurrentModificationException(
            'Map was modified during iteration.');
      }
      let result = super.next();
      core.assert(() => !result.done || this[_I] == this[_MAP].size)
      if (!result.done) this[_I]++;
      return result;
    }
  }

  class _LinkedHashMapIterableBase extends _LinkedListIterableBase {
    constructor(map, fn = x => x) {
      super(map, fn);
      this[_MAP] = map;
    }
    get length() {
      return this[_MAP].size;
    }
    [Symbol.iterator]() {
      return new _LinkedHashMapIterator(this[_MAP], this[_FN]);
    }
  }
  let _LinkedHashMapIterable = iterables.EfficientLengthMixin(_LinkedHashMapIterableBase);

  module.exports.LinkedHashMap = class LinkedHashMap extends HashMap {
    constructor(sizeOrMap) {
      super(sizeOrMap);
    }
    [_INITIAL_CLEAR]() {
      super[_INITIAL_CLEAR]();
      this[_PREV] = this;
      this[_NEXT] = this;
    }
    [_GEN_KVPAIR_CELL](key, value) {
      let result = new KVNodeLinkedListNode(key, value);
      result.insertBefore(this);
      return result;
    }
    [_REMOVE_AT](ix) {
      let result = super[_REMOVE_AT](ix);
      result.remove();
      return result;
    }
    [_GEN_ITERABLE](fn = x => x) {
      let result = new _LinkedHashMapIterable(this, fn);
      return result;
    }
  };


  let _lt = [];
  let _ltLog = [];
  function _ltPush(val, log) {
    for (let i = 0; i < val; i++) {
      _lt.push(val); _ltLog.push(log);
    }
  }
  _lt.push(0); _ltLog.push(-1);
  _ltPush(0x01, 0);
  _ltPush(0x02, 1);
  _ltPush(0x04, 2);
  _ltPush(0x08, 3);
  _ltPush(0x10, 4);
  _ltPush(0x20, 5);
  _ltPush(0x40, 6);
  _ltPush(0x80, 7);
  function _log2(val) {
    let tt; let t;
    if ((tt = val >> 16)) {
      return ((t = tt >> 8)) ? _ltLog[t] << 24 : _ltLog[tt] << 16;
    }
    return ((t = val >> 8)) ? _ltLog[t] << 8 : _ltLog[val];

  }
  function _qLog2(val, current, tryAll) {
    if (tryAll) return current >> 1;
    let tt; let t;
    if ((tt = val >> 16)) {
      return ((t = tt >> 8)) ? _lt[t] << 24 : _lt[tt] << 16;
    }
    return ((t = val >> 8)) ? _lt[t] << 8 : _lt[val];
  }
  let primeSizes =      [ Number.NEGATIVE_INFINITY
                        , 19
                        , 31
                        , 37
                        , 43
                        , 47
                        , 53
                        , 61
                        , 67
                        , 79
                        , 89
                        , 97
                        , 107
                        , 113
                        , 127
                        , 137
                        , 149
                        , 157
                        , 167
                        , 181
                        , 193
                        , 211
                        , 233
                        , 257
                        , 281
                        , 307
                        , 331
                        , 353
                        , 389
                        , 409
                        , 421
                        , 443
                        , 467
                        , 503
                        , 523
                        , 563
                        , 593
                        , 631
                        , 653
                        , 673
                        , 701
                        , 733
                        , 769
                        , 811
                        , 877
                        , 937
                        , 1039
                        , 1117
                        , 1229
                        , 1367
                        , 1543
                        , 1637
                        , 1747
                        , 1873
                        , 2003
                        , 2153
                        , 2311
                        , 2503
                        , 2777
                        , 3079
                        , 3343
                        , 3697
                        , 5281
                        , 6151
                        , 7411
                        , 9901
                        , 12289
                        , 18397
                        , 24593
                        , 34651
                        , 49157
                        , 66569
                        , 73009
                        , 98317
                        , 118081
                        , 151051
                        , 196613
                        , 246011
                        , 393241
                        , 600011
                        , 786433
                        , 1050013
                        , 1572869
                        , 2203657
                        , 3145739
                        , 4000813
                        , 6291469
                        , 7801379
                        , 10004947
                        , 12582917
                        , 19004989
                        , 22752641
                        , 25165843
                        , 39351667
                        , 50331653
                        , 69004951
                        , 83004629
                        , 100663319
                        , 133004881
                        , 173850851
                        , 201326611
                        , 293954587
                        , 402653189
                        , 550001761
                        , 702952391
                        , 805306457
                        , 1102951999
                        , 1402951337
                        , 1610612741
                        , 1902802801
                        , 2147483647
                        , 3002954501
                        , 3902954959
                        , 4294967291
                        , 5002902979
                        , 6402754181
                        , 8589934583
                        , 17179869143
                        , 34359738337
                        , 68719476731
                        , 137438953447
                        , 274877906899
                        , Number.POSITIVE_INFINITY ];
  function nextBestPrime(num) {
    return primeSizes[binarySearch(num, primeSizes, (a,b) => a == b ? 0 : (a > b ? 1 : -1))];
  }
  function binarySearch(num, list, compareFn) {
    let maxIndex = list.length - 2;
    let minimum = 0;
    let currentIndex = _qLog2(maxIndex);
    let tryAll = false;
    while (currentIndex > 0) {
      if (compareFn(list[minimum + currentIndex], num) == 0) {
        return minimum + currentIndex;
      }
      if (compareFn(list[minimum + currentIndex], num) > 0) {
        maxIndex = currentIndex - 1;
        tryAll = true;
        currentIndex = _qLog2(maxIndex, currentIndex, tryAll);
      } else {
        minimum += currentIndex;
        maxIndex = maxIndex - currentIndex;
        currentIndex = _qLog2(maxIndex, currentIndex, tryAll);
      }
    }
    return minimum + 1;
  }

  const _LEFT = Symbol('_left');
  const _RIGHT = Symbol('_right');
  const _PARENT = Symbol('_parent');

  const _CONTENTS = Symbol('_contents');
  const _ROOT = Symbol('_root');
  class _SplayTreeNode {
    constructor(data) {
      this[_LEFT] = null;
      this[_RIGHT] = null;
      this[_PARENT] = null;
      this[_CONTENTS] = data;
    }
  }

  const _OFFTRACK = Symbol('_offtrack');

  class _SplayTreeIterator {
    constructor(rootNode, fn = x => x) {
      this[_REV] = rootNode[_REV];
      this[_MAP] = rootNode;
      this[_NEXT] = null;
      this[_OFFTRACK] = true;
      this[_FN] = fn;
    }
    next() {
      if (this[_REV] != this[_MAP][_REV]) {
        throw new iterables.ConcurrentModificationException(
            'Map was modified during iteration.');
      }
      if (this[_OFFTRACK]) {
        this[_NEXT] = this[_MAP][_LEFTMOST_CHILD];
        if (this[_NEXT] == null) return {done: true};
        this[_OFFTRACK] = false;
        return {done: false, value: this[_FN](this[_NEXT])}
      }
      // We have right children. Go to the left-most child of our right node.
      if (this[_NEXT][_RIGHT] != null) {
        let temp = this[_NEXT][_RIGHT];
        while (temp[_LEFT] != null) {
          temp = temp[_LEFT];
        }
        this[_NEXT] = temp;
        return {done: false, value: this[_FN](this[_NEXT])};
      }
      // We don't have right children. Our next node, is the lowest-level
      // parent such that we are in its left branch.
      var childBranch = this[_NEXT];
      var parentBranch = childBranch[_PARENT];
      for (;;) {
        if (parentBranch == null) {
          // We're not on any left branch, so we must be done.
          this[_OFFTRACK] = true;
          return {done: true};
        }
        if (parentBranch[_LEFT] == childBranch) {
          this[_NEXT] = parentBranch;
          return {done: false, value: this[_FN](this[_NEXT])};
        }
        childBranch = parentBranch;
        parentBranch = childBranch[_PARENT];
      }
    }
  }

  class _SplayTreeIterableBase {
    constructor(map, fn = x => x) {
      this[_MAP] = map;
      this[_FN] = fn;
    }
    get length() {
      return this[_MAP][_COUNT];
    }
    [Symbol.iterator]() {
      return new _SplayTreeIterator(this[_MAP], this[_FN]);
    }
  }
  let _SplayTreeIterable = iterables.EfficientLengthMixin(_SplayTreeIterableBase);

  const _COMPARISON_FN = Symbol('_comparisonFn');
  const _GET_KEY = Symbol('_getKey');
  const _GET_VALUE = Symbol('_getValue');
  const _SPLAY = Symbol('_splay');
  const _LEFTMOST_CHILD = Symbol('_leftmostChild');
  const _RIGHTMOST_CHILD = Symbol('_rightmostChild');
  const _INEQUALITY_QUERY = Symbol('_inequalityQuery');
  const _CHECK_ALL_CELLS = Symbol('_checkAllCells');

  class _SplayTree {
    constructor(comparisonFn = _SplayTree.comparisonFn) {
      this[_ROOT] = null;
      this[_COUNT] = 0;
      this[_REV] = 0;
      this[_COMPARISON_FN] = comparisonFn;
      this[_LEFTMOST_CHILD] = null;
      this[_RIGHTMOST_CHILD] = null;
    }
    static comparisonFn(a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    }
    [_CHECK_ALL_CELLS]() {
      return;
      /*
      let visited = new Set();
      function checkNonRoot (cell, parent) {
        core.assert(() => !visited.has(cell), `cell at ${cell[_CONTENTS][_KEY]} is reachable 2 ways`);
        visited.add(cell);
        core.assert(() => cell[_PARENT] === parent, `cell at ${cell[_CONTENTS][_KEY]} does not know his parent`) ;
        if (cell[_LEFT]) checkNonRoot(cell[_LEFT], cell);
        if (cell[_RIGHT]) checkNonRoot(cell[_RIGHT], cell);
        return true;
      }
      let originalThis = this;
      core.assert(() => checkNonRoot(originalThis[_ROOT], null));
      core.assert(() => visited.size == originalThis[_COUNT], `tree is not the correct size`);
      */

    }
    [_REMOVE_AT](key) {
      if (this[_COUNT] == 0) return null;
      let c = this[_SPLAY](key);
      if (c != 0) return null;

      if (this[_ROOT] == this[_RIGHTMOST_CHILD]) {
        let next = this[_ROOT][_LEFT];
        while (next && next[_RIGHT]) {
          next = next[_RIGHT];
        }
        this[_RIGHTMOST_CHILD] = next;
      }
      if (this[_ROOT] == this[_LEFTMOST_CHILD]) {
        let next = this[_ROOT][_RIGHT];
        while (next && next[_LEFT]) {
          next = next[_LEFT];
        }
        this[_LEFTMOST_CHILD] = next;
      }

      let originalValue = this[_GET_VALUE](this[_ROOT]);

      if (this[_ROOT][_LEFT] == null) {
        this[_ROOT] = this[_ROOT][_RIGHT];
        if (this[_ROOT])
          this[_ROOT][_PARENT] = null;
      } else {
        let newRight = this[_ROOT][_RIGHT];
        let newLeft = this[_ROOT][_LEFT];
        let temp = newLeft;
        while (temp[_RIGHT] != null) {
          temp = temp[_RIGHT];
        }
        if (temp != newLeft) {
          temp[_PARENT][_RIGHT] = temp[_LEFT];
          if (temp[_LEFT]) {
            temp[_LEFT][_PARENT] = temp[_PARENT];
          }
          temp[_LEFT] = newLeft;
          newLeft[_PARENT] = temp;
        } // Otherwise, left has no right branches.
        temp[_RIGHT] = newRight;
        if (newRight) {
          newRight[_PARENT] = temp;
        }
        this[_ROOT] = temp;
        temp[_PARENT] = null;
        // this[_SPLAY](key);
        // We don't need to do a full splay here because we know how it will
        // turn out.
      }
      this[_REV]++;
      this[_COUNT]--;
      this[_CHECK_ALL_CELLS]();
      return originalValue;
    }

    [_UPSERT](contents, key) {
      if (this[_COUNT] == 0) {
        this[_REV]++;
        this[_LEFTMOST_CHILD] =
            this[_RIGHTMOST_CHILD] =
            this[_ROOT] =
            new _SplayTreeNode(contents);
        this[_COUNT]++;
        return;
      }
      let c = this[_SPLAY](key);
      if (c == 0) {
        this[_ROOT][_CONTENTS] = contents;
        return;
      }
      let n = new _SplayTreeNode(contents);
      if (c < 0) {
        if (this[_ROOT] == this[_LEFTMOST_CHILD]) {
          this[_LEFTMOST_CHILD] = n;
        }
        n[_LEFT] = this[_ROOT][_LEFT];
        n[_RIGHT] = this[_ROOT];
        if (n[_LEFT])
          n[_LEFT][_PARENT] = n;
        n[_RIGHT][_PARENT] = n;

        this[_ROOT][_LEFT] = null;
      } else {
        if (this[_ROOT] == this[_RIGHTMOST_CHILD]) {
          this[_RIGHTMOST_CHILD] = n;
        }
        n[_RIGHT] = this[_ROOT][_RIGHT];
        n[_LEFT] = this[_ROOT];
        n[_LEFT][_PARENT] = n;
        if (n[_RIGHT])
          n[_RIGHT][_PARENT] = n;
        this[_ROOT][_RIGHT] = null;
      }
      this[_REV]++;
      this[_ROOT] = n;
      this[_COUNT] ++;
      this[_CHECK_ALL_CELLS]();
    }

    [_SPLAY](key) {
      let t = this[_ROOT];
      let r; let l; let lFirst; let rFirst;
      core.assert(() => t != null, '_root must not be null');
      let c;
      for (;;) {
        // To prevent duplicate calls on the same cell. Be sure to
        c = this[_COMPARISON_FN](key, this[_GET_KEY](t));
        if (c < 0 && t[_LEFT] == null) {
          break;
        } else if (c < 0) {
          let ci = this[_COMPARISON_FN](key, this[_GET_KEY](t[_LEFT]));
          if (ci < 0) {
            let y = t[_LEFT];
            t[_LEFT] = y[_RIGHT];
            if (t[_LEFT])
              t[_LEFT][_PARENT] = t;
            y[_RIGHT] = t;
            t[_PARENT] = y;
            t = y;
            if (!t[_LEFT]) {
              c = ci;
              break;
            }
          }
          if (r) {
            r[_LEFT] = t;
            t[_PARENT] = r;
          } else {
            lFirst = t;
          }
          r = t;
          t = t[_LEFT];
        } else if (c > 0 && t[_RIGHT] == null) {
          break;
        } else if (c >0){
          let ci = this[_COMPARISON_FN](key, this[_GET_KEY](t[_RIGHT]));
          if (ci > 0) {
            let y = t[_RIGHT];
            t[_RIGHT] = y[_LEFT];
            if (t[_RIGHT])
              t[_RIGHT][_PARENT] = t;
            y[_LEFT] = t;
            t[_PARENT] = y;
            t = y;
            if (!t[_RIGHT]) {
              c = ci;
              break;
            }
          }
          if (l) {
            l[_RIGHT] = t;
            t[_PARENT] = l;
          } else {
            rFirst = t;
          }
          l = t;
          t = t[_RIGHT];
        } else {
          break;
        }
      }
      if (l) {
        l[_RIGHT] = t[_LEFT];
        t[_LEFT] = rFirst;
        rFirst[_PARENT] = t;
        if (l[_RIGHT])
          l[_RIGHT][_PARENT] = l;
      }
      if (r) {
        r[_LEFT] = t[_RIGHT];
        t[_RIGHT] = lFirst;
        lFirst[_PARENT] = t;
        if (r[_LEFT])
          r[_LEFT][_PARENT] = r;
      }
      this[_ROOT] = t;
      t[_PARENT] = null;
      this[_CHECK_ALL_CELLS]();
      return c;
    }
    [_INEQUALITY_QUERY](key, offTargetCheck, proximalKey, distalKey) {
      if (this[_COUNT] == 0) return null;
      let c = this[_SPLAY](key);
      // If the root is already bigger than the key return it.
      if (offTargetCheck(c)) {
        // We should really resplay here, because the odds are that the next
        // lookup will be for the same key again.
        let closerCentroid = this[_ROOT][distalKey];
        let temp = closerCentroid;
        if (closerCentroid == null) return null;
        while (temp[proximalKey] != null) {
          temp = temp[proximalKey];
        }
        // temp._left must be null.
        // Move any right children af our node, to be the new immediate child
        // of p1
        if (temp != closerCentroid) {
          temp[_PARENT][proximalKey] = temp[distalKey];
          if (temp[distalKey]) {
            temp[distalKey][_PARENT] = temp[_PARENT];
          }
          temp[distalKey] = closerCentroid;
          closerCentroid[_PARENT] = temp;
        }
        // Move the old root to be the new root's left branch.
        temp[proximalKey] = this[_ROOT];
        this[_ROOT][_PARENT] = temp;
        // Move the right of the old root to be the right of the new branch.
        this[_ROOT][distalKey] = null;
        // Make the new root the root
        this[_ROOT] = temp;
        temp[_PARENT] = null;
      }
      this[_CHECK_ALL_CELLS]();
      return this[_ROOT];
    }
  }

  class _SplayTreeMapCell {
    constructor(key, value) {
      this[_KEY] = key;
      this[_VALUE] = value;
    }
    get key() {
      return this[_KEY];
    }
    get value() {
      return this[_VALUE];
    }
  }


  module.exports.SplayTreeMap = class SplayTreeMap extends _SplayTree {
    constructor(sizeOrMap, comparisonFn = _SplayTree.comparisonFn) {
      super(comparisonFn);
      if (sizeOrMap && sizeOrMap.keys && sizeOrMap.get) {
        for (let [key, value] of sizeOrMap.entries()) {
          this.set(key, value);
        }
      }
    }
    get size() {
      return this[_COUNT];
    }
    get(key) {
      if (this[_COUNT] == 0) return null;
      let c = this[_SPLAY](key);
      if (c != 0) return null;
      return this[_ROOT][_CONTENTS][_VALUE];
    }
    has(key) {
      if (this[_COUNT] == 0) return null;
      let c = this[_SPLAY](key);
      return c == 0;
    }
    set(key, value) {
      let contents = new _SplayTreeMapCell(key, value);
      this[_UPSERT](contents, key);
    }
    setIfAbsent(key, valueFactory) {
      if (!this.has(key)) {
        this.set(key, valueFactory())
      }
    }
    delete(key) {
      var contents = this[_REMOVE_AT](key);
      if (contents == null) return null;
      return contents.value;
    }
    [_GET_VALUE](contents) {
      return contents[_CONTENTS].value;
    }
    [_GET_KEY](contents) {
      return contents[_CONTENTS].key;
    }
    setAll(map) {
      for (let [key, value] of map.entries()) {
        this.set(key, value);
      }
    }
    [_GEN_ITERABLE](fn = x => x) {
      return new _SplayTreeIterable(this, fn);
    }
    entries() {
      return this[_GEN_ITERABLE]((x) => [x[_CONTENTS].key, x[_CONTENTS].value]);
    }
    keys() {
      return this[_GEN_ITERABLE]((x) => x[_CONTENTS].key);
    }
    values() {
      return this[_GEN_ITERABLE]((x) => x[_CONTENTS].value);
    }
    forEach(callback, thisArg) {
      return this[_GEN_ITERABLE]((x) => x[_CONTENTS]).forEach((entry) => {
        callback.apply(thisArg, [entry.value, entry.key]);
      });
    }

    firstEntryAfter(key) {
      let result = this[_INEQUALITY_QUERY](key, (c) => c >= 0, _LEFT, _RIGHT);
      if (result == null) return null;
      return [result[_CONTENTS].key, result[_CONTENTS].value]
    }
    lastEntryBefore(key) {
      let result = this[_INEQUALITY_QUERY](key, (c) => c <= 0, _RIGHT, _LEFT);
      if (result == null) return null;
      return [result[_CONTENTS].key, result[_CONTENTS].value]
    }

  }
});
