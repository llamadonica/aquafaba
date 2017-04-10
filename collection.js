/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
define('collection', ['core','iterables'], (core, iterables) => {
  let exports = {};

  const _SIZE = Symbol('_size');
  const _SALT1 = Symbol('_salt1');
  const _SALT2 = Symbol('_salt2');
  const _COUNT = Symbol('_count');
  const _CELLS = Symbol('_cells');
  const _MAX_ATTEMPTS = Symbol('_maxAttempts');
  const _MAX_LOAD = 0.88;
  const _BUMP_FACTOR = 0.73;
  const _MAX_ITEMS_PER_CELL = 3;
  const _REV = Symbol('_rev');
  const _GET_CELL_OFFSET = Symbol('_getCellOffset');
  const _REMOVE_AT = Symbol('_removeAt');
  const _GET_CELL_HASHABLE = Symbol('_getCellHashable');
  const _UPSERT = Symbol('_upsert');
  const _RESIZE = Symbol('_resze');
  const _MAX_BEFORE_RESIZE = Symbol('_maxBeforeResize');
  const _INITIAL_CLEAR = Symbol('_initialSetup');
  const _INTERNAL_CLEAR = Symbol('_internalClear');

  class _CuckooHashCollection {
    constructor(size = 1) {
      this[_SIZE] = nextBestPrime(size);
      this[_SALT1] = new core.HashSalt();
      this[_SALT2] = new core.HashSalt();
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
    [_INITIAL_CLEAR]() {}
    [_INTERNAL_CLEAR]() {
      if (this[_COUNT]) {
        this[_REV]++;
      }
      this[_COUNT] = 0;
      this[_CELLS] = new Array(_CuckooHashCollection.MAX_ITEMS_PER_CELL * this[_SIZE]);
      this[_MAX_BEFORE_RESIZE] = (_CuckooHashCollection.MAX_LOAD * _CuckooHashCollection.MAX_ITEMS_PER_CELL * this[_SIZE])|0;
      this[_MAX_ATTEMPTS] = 12 + _log2(this[_SIZE]);
    }
    clear() {
      this[_INTERNAL_CLEAR]();
      this[_INITIAL_CLEAR]();
    }
    [_GET_CELL_OFFSET](hashable, forInsert = false, insertSpec, butNot,
                       keyMayExist) {
      let i = (core.hashCode(hashable, this[_SALT1]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      let ixInsert = i;
      if (forInsert) {
        insertSpec.mustKick = true;
        insertSpec.update = false;
        insertSpec.ix = Number.POSITIVE_INFINITY;
      }
      // Check all the keys. If i == butNot (which means we are being booted
      // as a result of a cuckoo operation), skip this entry. After a cuckoo,
      // butNot will always be the first cell in the first bucket or the first
      // cell in the second.
      //
      // If we know that no entry exists, or if we find the entry
      // return the correct cell right away. Otherwise, keep going in case
      // we do find the entry.
      for (let ix = i; i != butNot && ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (this[_CELLS][ix] && core.equals(hashable, this[_GET_CELL_HASHABLE](this[_CELLS][ix]))) {
          if (forInsert) {
            insertSpec.update = true;
            insertSpec.mustKick = false;
            insertSpec.ix = ix;
          }
          return ix;
        }
        if (forInsert && !this[_CELLS][ix] && ix < insertSpec.ix) {
          insertSpec.mustKick = false;
          insertSpec.update = false;
          insertSpec.ix = ix;
          if (!keyMayExist) return -1;
        }
      }
      i = (core.hashCode(hashable, this[_SALT2]) % this[_SIZE]) * _CuckooHashCollection.MAX_ITEMS_PER_CELL;
      if (ixInsert == butNot) {
        ixInsert = i;
      }
      for (let ix = i; i != butNot && ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
        if (this[_CELLS][ix] && core.equals(hashable, this[_GET_CELL_HASHABLE](this[_CELLS][ix]))) {
          if (forInsert) {
            insertSpec.update = true;
            insertSpec.mustKick = false;
            insertSpec.ix = ix;
          }
          return ix;
        }
        if (forInsert && !this[_CELLS][ix] && ix < insertSpec.ix) {
          insertSpec.mustKick = false;
          insertSpec.update = false;
          insertSpec.ix = ix;
          if (!keyMayExist) return -1;
        }
      }
      if (forInsert && insertSpec.ix >= (_CuckooHashCollection.MAX_ITEMS_PER_CELL * this[_SIZE])) {
        insertSpec.mustKick = true;
        insertSpec.update = false;
        insertSpec.ix = ixInsert;
        return ixInsert;
      }
      return -1;
    }
    [_REMOVE_AT](ix) {
      if (this[_CELLS][ix]) {
        this[_COUNT]--;
        this[_REV]++;
      }
      let result = this[_CELLS][ix];
      this[_CELLS][ix] = null;
      return result;
    }
    [_UPSERT](hashable, value, cell) {
      let insertSpec = {
        update: false,
        mustKick: false,
        ix: -1,
      };
      let cuckooAttemptsRemaining = this[_MAX_ATTEMPTS];
      let butNot;
      let keyMayExist = true;
      for (;;) {
        this[_GET_CELL_OFFSET](hashable, true, insertSpec, butNot, keyMayExist);
        if (insertSpec.update) {
          let oldCell = this[_CELLS][insertSpec.ix];
          this[_CELLS][insertSpec.ix].value = value;
          return oldCell;
        }
        // On the first run, we now know that no existing cell would work.
        // so it's time to create one. On subsequent runs, don't create
        // a new cell.
        cell = cell || this[_GEN_KVPAIR_CELL](hashable, value);
        if (!insertSpec.mustKick) {
          this[_CELLS][insertSpec.ix] = cell;
          this[_REV]++;
          this[_COUNT]++;
          return;
        }
        if (cuckooAttemptsRemaining <= 0 || this[_COUNT] > this[_MAX_BEFORE_RESIZE]) {
          this[_RESIZE]();
          continue;
        }
        // We have to kick a neighbor out.
        let oldCell = this[_CELLS][insertSpec.ix];
        butNot = insertSpec.ix;
        this[_CELLS][insertSpec.ix] = cell;
        cuckooAttemptsRemaining--;
        cell = oldCell;
        hashable = this[_GET_CELL_HASHABLE](cell);
      }
    }
    [_RESIZE]() {
      let oldCells = this[_CELLS];
      let oldSize = this[_SIZE];
      this[_SIZE] = nextBestPrime((oldSize / _CuckooHashCollection.BUMP_FACTOR)|0);
      this[_SALT1] = new core.HashSalt();
      this[_SALT2] = new core.HashSalt();
      this[_INTERNAL_CLEAR]();
      for (let cell of oldCells) {
        if (!cell) continue;
        this[_UPSERT](this[_GET_CELL_HASHABLE](cell), null, cell);
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
        core.assert(() => this[_I] == this[_MAP].size,
               "Expected number of elements yielded to be same as list length");
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
  let _LinkedListIterable = iterables.IterableMixin(_LinkedListIterableBase);

  const _GEN_KVPAIR_CELL = Symbol('_genKVPair');
  const _GEN_ITERABLE = Symbol('_genIterable');

  let HashMap = exports.HashMap = class HashMap extends _CuckooHashCollection {
    constructor(sizeOrMap) {
      let size = 1;
      if (typeof sizeOrMap === 'number') {
        let size = sizeOrMap;
      } else if (sizeOrMap && sizeOrMap.size) {
        size = ((sizeOrMap.size / _CuckooHashCollection.MAX_LOAD)|0);
      }
      super(size);
      if (sizeOrMap && sizeOrMap.keys && sizeOrMap.get) {
        for (let key of sizeOrMap.keys()) {
          this.set(key, sizeOrMap.get(key));
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
      let ix = this[_GET_CELL_OFFSET](key)
      if (ix < 0) return;
      return this[_CELLS][ix].value;
    }
    set(key, value) {
      this[_UPSERT](key, value);
    }
    delete(key) {
      let ix = this[_GET_CELL_OFFSET](key)
      if (ix < 0) return;
      return this[_REMOVE_AT](ix).value;
    }
    get size() {
      return this[_COUNT];
    }
    setAll(map) {
      for (let key of map.keys) {
        this.set(key, map.get(key));
      }
    }
    [_GEN_ITERABLE](fn = x => x) {
      return new _CuckooHashCollectionIterable(this, fn);
    }
    entries() {
      return this[_GEN_ITERABLE]((x) => [x.key, x.value]);
    }
    keys() {
      return this[_GEN_ITERABLE]((x) => x.key);
    }
    values() {
      return this[_GEN_ITERABLE]((x) => x.value);
    }
  }

  class _LinkedListHashMapIterator extends _LinkedListIterator {
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
      assert(() => !result.done || this[_I] == this[_MAP].size)
      if (!result.done) this[_I]++;
      return result;
    }
  }

  class _LinkedListHashMapIterableBase extends _LinkedListIterableBase {
    constructor(map, fn = x => x) {
      super(map, fn);
      this[_MAP] = map;
    }
    get length() {
      return this[_MAP].size;
    }
    [Symbol.iterator]() {
      return new _LinkedListHashMapIterator(this[_MAP], this[_FN]);
    }
  }
  let _LinkedListHashMapIterable = iterables.EfficientLengthMixin(_LinkedListHashMapIterableBase);

  exports.LinkedListHashMap = class LinkedListHashMap extends HashMap {
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
      let result = new _LinkedListHashMapIterable(this, fn);
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

  return exports;
});
