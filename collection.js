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
  const _CUCKOO = Symbol('_cuckoo');
  const _RESIZE = Symbol('_resze');
  const _MAX_BEFORE_RESIZE = Symbol('_maxBeforeResize');

  class _CuckooHashCollection {
    constructor(size = 1) {
      this[_SIZE] = nextBestPrime(size);
      this[_SALT1] = new core.HashSalt();
      this[_SALT2] = new core.HashSalt();
      this[_REV] = 0;
      this.clear();
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
    clear() {
      if (this[_COUNT]) {
        this[_REV]++;
      }
      this[_COUNT] = 0;
      this[_CELLS] = new Array(_CuckooHashCollection.MAX_ITEMS_PER_CELL * this[_SIZE]);
      this[_MAX_BEFORE_RESIZE] = (_CuckooHashCollection.MAX_LOAD * this[_SIZE])|0;
      this[_MAX_ATTEMPTS] = 12 + _log2(this[_SIZE]);
    }
    [_GET_CELL_OFFSET](hashable, forInsert = false, insertSpec, butNot) {
      let i = core.hashCode(hashable, this[_SALT1]) % this[_SIZE];
      let ixInsert = i;
      if (forInsert) {
        insertSpec.mustKick = true;
        insertSpec.update = false;
        insertSpec.ix = Number.POSITIVE_INFINITY;
      }
      for (let ix = i; ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
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
        }
      }
      i = core.hashCode(hashable, this[_SALT2]) % this[_SIZE];
      if (ixInsert == butNot) {
        ixInsert = i;
      }
      for (let ix = i; ix < i + _CuckooHashCollection.MAX_ITEMS_PER_CELL; ix++) {
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
      this[_CELLS][ix] = null;
    }
    [_UPSERT](hashable, cell) {
      let insertSpec = {
        update: false,
        mustKick: false,
        ix: -1,
      };
      let cuckooAttemptsRemaining = this[_MAX_ATTEMPTS];
      let butNot;
      for (;;) {
        this[_GET_CELL_OFFSET](hashable, true, insertSpec, butNot);
        if (insertSpec.update) {
          let oldCell = this[_CELLS][ix];
          this[_CELLS][enserSpec.ix] = cell;
          this[_REV]++;
          return oldCell;
        }
        if (!insertSpec.mustKick) {
          this[_CELLS][insertSpec.ix] = cell;
          this[_REV]++;
          this[_COUNT]++;
          return;
        }
        if (cuckooAttemptsRemainin <= 0 || this[_COUNT] > this[_MAX_BEFORE_RESIZE]) {
          this[_RESIZE]();
          continue;
        }
        // We have to kick a neighbor out.
        let oldCell = this[_CELLS][ix];
        butNot = ix;
        this[_CELLS][ix] = cell;
        cuckooAttemptsRemainin--;
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
      this.clear();
      for (let cell of oldCells) {
        if (!cell) continue;
        this[_UPSERT](this[_GET_CELL_HASHABLE](cell), cell);
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
  }

  const _MAP = Symbol('_map');
  const _INDEX = Symbol('_index');
  const _FN = Symbol('_fn');
  class _CuckooHashCollectionIterator {
    constructor(map, fn = x => x) {
      this[_MAP] = map;
      this[_INDEX] = 0;
      this[_FN] = fn;
      this[_REV] = map[_REV];
    }
    next() {
      let cell;
      if (this[_REV] != this[_MAP][_REV]) {
        throw new iterables.ConcurrentModificationException('Map was modified during iteration.');
      }
      do {
        this[_INDEX]++;
      }  while (
        (this[_INDEX]) <
            this[_MAP][_SIZE] * _CuckooHashCollection.MAX_ITEMS_PER_CELL
        &&
        !(cell = this[_MAP][_CELLS][this[_INDEX]]));
      if (!cell) return {done: true};
      return {done: false, value: this[_FN](cell)};
    }
  }
  class _CuckooHashCollectionIterableBase {
    constructor(map, fn = x => x) {
      this[_MAP] = map;
      this[_FN] = fn;
    }
    [Symbol.iterator]() {
      return new _CuckooHashCollectionIterator(map, fn);
    }
  }
  let _CuckooHashCollectionIterable =
    iterables.IterableMixin(_CuckooHashCollectionIterableBase);
  const _GEN_KVPAIR_CELL = Symbol('_genKVPair');
  let HashMap = exports.HashMap = class HashMap extends _CuckooHashCollection {
    constructor(sizeOrMap) {
      if (typeof sizeOrMap === 'undefined') {
        super();
      } else if (typeof sizeOrMap === 'number') {
        super(sizeOrMap);
      } else if (sizeOrMap.size) {
        super(sizeOrMap.size);
      }
      if (sizeOrMap && sizeOrMap.keys && sizeOrMap.get) {
        for (let key of sizeOrMap.keys) {
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
      this[_UPSERT](key, this[_GEN_KVPAIR_CELL](key, value));
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
      for (let key of sizeOrMap.keys) {
        this.set(key, sizeOrMap.get(key));
      }
    }
    get entries() {
      return new _CuckooHashCollectionIterable(this, (x) => [x.key, x.value]);
    }
    get keys() {
      return new _CuckooHashCollectionIterable(this, (x) => x.key);
    }
    get values() {
      return new _CuckooHashCollectionIterable(this, (x) => x.value);
    }
  }

  let _lt = []; _ltLog = [];
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
    let tt;
    if (tt = val >> 16) {
      let t;
      return (t = tt >> 8) ? _ltLog[t] << 24 : _ltLog[tt] << 16;
    }
    return (t = val >> 8) ? _ltLog[t] << 8 : _ltLog[val];

  }
  function _qLog2(val, current, tryAll) {
    if (tryAll) return current >> 1;
    let tt;
    if (tt = val >> 16) {
      let t;
      return (t = tt >> 8) ? _lt[t] << 24 : _lt[tt] << 16;
    }
    return (t = val >> 8) ? _lt[t] << 8 : _lt[val];
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
    return primeSizes[binarySearch(num, primeSizes, (a,b) => a == b ? 0 : (a > b ? 1 : 0))];
  }
  function binarySearch(num, list, compareFn) {
    let maxIndex = list.length - 1;
    let minimum = 0;
    let currentIndex = _qLog2(maxIndex);
    let offset = 0;
    let tryAll = false;
    while (currentIndex > 0) {
      if (compareFn(list[minimum + currentIndex], num) == 0) return minimum + currentIndex;
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
