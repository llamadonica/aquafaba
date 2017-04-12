// @requires bower_components/imd/imd.js

function setPerformance(x) {
  if (window.performance && window.performance.mark) {
    performance.mark(x);
  }
}

// let performanceOberver = new PerformanceObserver(list =>
//   list.getEntries().forEach(entry => console.log(`${entry.name}: ${entry.startTime}`)));
// performanceOberver.observe({entryTypes: ["mark"]});

(function(s,a,c,q){s[a]=s[a]||function(i,m,f){q.push([i,m,f,c._currentScript||
c.currentScript]);};q=s[a].q=s[a].q||[];})(window,"define",document);

define(['collection', 'iterables'], function (collection, iterables) {
  suite('Collection tests', function () {
    function mapGen(from, to) {
      let map = new collection.LinkedHashMap();
      for (let i = from; i < to; i++) {
        map.set(i,i);
      }
      //console.log(`Created a new map with ${map.size} elements`);
      return map;

    }
    function addAll(toMap, fromMap) {
      for (let [k,v] of fromMap.entries()) {
        //console.log(`Setting map[${k}] = ${v}`);
        toMap.set(k,v);
        //console.log(`Size is now ${toMap.size}`);
      }
    }
    function addAllQuick(toMap, fromMap) {
      toMap.setAll(fromMap);
    }
    function isEven(n) {
      return (n & 1) == 0;
    }
    function isOdd(n) {
      return (n & 1) == 1;
    }
    const adders = [
      {name: 'one at a time', fn: addAll},
      {name: 'quickly', fn: addAllQuick}
    ];
    function testAdder(mapFactory, testName, adderName, adderFn) {
      suite(adderName, () => {
        test(`Growing to largish capacity for ${testName} with ${adderName}`, (done) => {
          setPerformance(`Start 1000 inserts ${testName} with ${adderName}`);
          let map = mapFactory();
          for (let i = 0; i < 256; i++) {
            //console.log(`Setting map[${i}] = ${i}`);
            map.set(i,i);
            //console.log(`Size is now ${map.size}`);
          }
          adderFn(map, mapGen(256, 512));
          let secondMap = mapFactory(mapGen(512,1000));
          //console.log(`Second map is ${secondMap.size} elements`);
          adderFn(map, secondMap);
          assert.equal(map.size, 1000);
          for (let i = 0; i < 1000; i += 2) {
            map.delete(i);
          }
          assert.equal(map.size, 500);
          assert.isFalse(map.keys().some(isEven));
          assert.isTrue(map.keys().every(isOdd));
          adderFn(map, mapGen(0,1000));
          assert.equal(map.size, 1000);
          setPerformance(`End 1000 inserts ${testName} with ${adderName}`);
          done();
        });
      });
    }
    function testMap(mapFactory, testName, notNullSafe = false) {
      suite(testName, () => {
        test(`Basic getting and setting for ${testName}`, function (done) {
          var x = new collection.HashMap();
          assert.equal(x.size, 0);
          x.set('one', 1);
          assert.equal(x.size, 1);
          assert.equal(x.get('one'), 1);
          done();
        });
        for (let adder of adders) {
          testAdder(mapFactory, testName, adder.name, adder.fn);
        }
        test(`Deleting many elements for ${testName}`, (done) => {
          setPerformance(`Start 1000 inserts 1000 deletes ${testName}`);
          let map = mapFactory();
          map.set(0,0);
          for (let i = 0; i < 1000; i++) {
            map.set(i+1, i+1);
            map.delete(i);
            assert.equal(map.size, 1);
          }
          setPerformance(`End 1000 inserts 1000 deletes ${testName}`);
          done();
        });
        // Cuckoo hashing can't really deal with large numbers of badly formed
        // hashes.
        test(`Concurrent modification is illegal for ${testName}`, (done) => {
          let map = mapFactory();
          map.set(0,0);
          map.set(1,1);
          let iter = map.keys()[Symbol.iterator]();
          iter.next();
          map.set(1,9);
          // Updating an existing key isn't a modification.
          iter.next();
          map.set(2,2);
          // But this is:
          assert.throws(() => iter.next(),
                        iterables.ConcurrentModificationException);
          done();
        });
        test(`Concurrent modification is illegal for ${testName}`, (done) => {
          let map = mapFactory();
          map.set(0,0);
          map.set(1,9);
          map.set(2,2);
          assert.equal(map.size, 3);
          let iter = map.keys()[Symbol.iterator]();
          iter.next();
          iter.next();
          iter.next();
          map.set(3,3);
          // But this is:
          assert.throws(() => iter.next(),
                        iterables.ConcurrentModificationException);
          done();
        });
        test(`Removing a value that's not there isn't a concurrent modification for ${testName}`, (done) => {
          let map = mapFactory();
          map.set(0,0);
          map.set(1,9);
          map.set(2,2);
          map.set(3,3);
          assert.equal(map.size, 4);
          let iter = map.keys()[Symbol.iterator]();
          iter.next();
          map.delete(1000);
          let {value} = iter.next();
          map.delete(value);
          // value won't change. Ho hum.
          assert.throws(() => iter.next(),
                        iterables.ConcurrentModificationException);
          done();
        });
        test(`Changing a value isn't a concurrent modification for ${testName}`, (done) => {
          let map = mapFactory();
          map.set(0,0);
          map.set(1,1);
          map.set(2,2);
          assert.equal(map.size, 3);
          let iter = map.keys()[Symbol.iterator]();
          let {value} = iter.next();
          map.set(value, value * 2);
          ({value} = iter.next());
          // value won't change. Ho hum.
          assert.equal(map.get(value), value);
          done();
        });
        test(`Modification during set if absent is not an error for ${testName}`, (done) => {
          let map = mapFactory();
          map.set(0,0);
          map.set(1,1);
          map.set(2,2);
          assert.equal(map.size, 3);
          map.setIfAbsent(4, () => {
            map.set(5,5);
            map.set(4,-1);
            return 4;
          });
          assert.equal(map.get(4), 4);
          assert.equal(map.get(5), 5);
          done();
        });
        test(`Adding many existing keys isn't a modification ${testName}`, (done) => {
          let map = mapFactory();
          let map2 = mapFactory();
          map.set(0,0);
          map.set(1,1);
          map.set(2,2);
          map.set(4,4);
          map.set(5,5);
          for (let [key, value] of map.entries()) {
            map2.set(key, value);
          }
          let iter = map.keys()[Symbol.iterator]();
          iter.next();
          addAll(map, map2);
          // Should not throw.
          iter.next();
          done();
        });
        test(`Put if absent doesn't lose values across resize ${testName}`, (done) => {
          let map = mapFactory();
          map.setIfAbsent("S", () => 0);
          map.setIfAbsent("T", () => 0);
          map.setIfAbsent("U", () => 0);
          map.setIfAbsent("C", () => 0);
          map.setIfAbsent("a", () => 0);
          map.setIfAbsent("b", () => 0);
          map.setIfAbsent("c", () => 0);
          map.setIfAbsent("d", () => 0);
          map.setIfAbsent("e", () => 0);
          map.setIfAbsent("f", () => 0);
          map.setIfAbsent("g", () => 0);
          map.setIfAbsent("h", () => 0);
          assert.isTrue(map.has("h"));
          done();
        });
        test('Put if absent works as well as set', (done) => {
          let map = mapFactory();
          for (let i = 0; i < 128; i++) {
            map.setIfAbsent(i, () => i);
            assert.isTrue(map.has(i));
            map.setIfAbsent(i, () => -1);
          }
          map.entries().forEach(([key, value]) => assert.equal(key, value));
          done();
        });
        test('Updating exisitng elements is not a modification.', (done) => {
          for (let i = 1; i < 128; i++) {
            let map = mapFactory(mapGen(0,i));
            map.forEach((value, key) => {
              assert.equal(key, map.get(key));
              map.set(key, key + 1);
              map.delete(1000);
              map.setIfAbsent(key, () => {throw "SHOULD NOT BE EMPTY."});
            });
            for (let key of map.keys()) {
              assert.equal(key + 1, map.get(key));
              map.set(key, map.get(key) + 1);
              map.delete(1000);
              map.setIfAbsent(key, () => {throw "SHOULD NOT BE EMPTY."});
            }
            let iterator = map.entries()[Symbol.iterator]();
            iterator.next();
            for (let key = 0; key < i; key++) {
              assert.equal(key + 2, map.get(key));
              map.set(key, key + 3);
              map.delete(1000);
              map.setIfAbsent(key, () => {throw "SHOULD NOT BE EMPTY."});
            }
            iterator.next();
            for (let key = 1; key < i; key++) {
              assert.equal(key + 3, map.get(key));
              map.delete(key);
            }
            iterator = map.keys()[Symbol.iterator]();
            iterator.next();
            map.set(0,2);
            iterator.next();
          }
          done();
        });
        if (!notNullSafe) {
          test('Null can be used as key', (done) => {
            let map = mapFactory();
            map.set(null,0)
            assert.equal(1, map.size);
            assert.isTrue(map.has(null));
            assert.isNull(map.keys().first);
            assert.isNull(map.keys().last);
            map.set(null,1);
            assert.equal(1, map.size);
            assert.isTrue(map.has(null));
            map.delete(null);
            assert.isTrue(map.entries().isEmpty);
            assert.isFalse(map.has(null));

            // Created using map.from.
            map = mapFactory((() => {
              let innerMap = new collection.HashMap();
              innerMap.set(null, 1);
              return innerMap;
            })());
            assert.equal(1, map.size);
            assert.isTrue(map.has(null));
            assert.isNull(map.keys().first);
            assert.isNull(map.keys().last);
            map.set(null, 2);
            assert.equal(1, map.size);
            assert.isTrue(map.has(null));
            map.delete(null);
            assert.isTrue(map.entries().isEmpty);
            assert.isFalse(map.has(null));

            let innerMap = new collection.HashMap();
            innerMap.set(1,0);
            innerMap.set(2,0);
            innerMap.set(3,0);
            innerMap.set(null, 0);
            innerMap.set(4,0);
            innerMap.set(5,0);
            innerMap.set(6,0);
            assert.equal(7, innerMap.size);
            map = mapFactory(innerMap);
            for (let i = 7; i < 128; i++) {
              map.set(i,0);
            }
            assert.equal(128, map.size);
            assert.isTrue(map.has(null));
            map.set(null, 1);
            assert.equal(128, map.size);
            assert.isTrue(map.has(null));
            map.delete(null);
            assert.equal(127, map.size);
            assert.isFalse(map.has(null));
            done();
          });
        }
      });
    }
    test('Loads', function (done) {
      done();
    });
    suite('Maps', () => {
      for (let {name, mapFactory, notNullSafe} of [
        {name: 'HashMap', mapFactory: (map) => new collection.HashMap(map)},
        {name: 'LinkedHashMap', mapFactory: (map) => new collection.LinkedHashMap(map)},
        {name: 'SplayTreeMap', mapFactory: (map) => new collection.SplayTreeMap(map), notNullSafe: true},
        {name: 'native Map', mapFactory: (map) => new collection.WrapMap(map)},
      ]) {
        testMap(mapFactory, name, notNullSafe);
      }
    });
  });
});
