// @requires bower_components/imd/imd.js

function setPerformance(x) {
  if (window.performance && window.performance.mark) {
    performance.mark(x);
  }
}

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
    function isEven(n) {
      return (n & 1) == 0;
    }
    function isOdd(n) {
      return (n & 1) == 1;
    }
    function testMap(mapFactory, testName) {
      test(`Basic getting and setting for ${testName}`, function (done) {
        var x = new collection.HashMap();
        assert.equal(x.size, 0);
        x.set('one', 1);
        assert.equal(x.size, 1);
        assert.equal(x.get('one'), 1);
        done();
      });
      test(`Growing to largish capacity for ${testName}`, (done) => {
        setPerformance(`Start 1000 inserts ${testName}`);
        let map = mapFactory();
        for (let i = 0; i < 256; i++) {
          //console.log(`Setting map[${i}] = ${i}`);
          map.set(i,i);
          //console.log(`Size is now ${map.size}`);
        }
        addAll(map, mapGen(256, 512));
        let secondMap = mapFactory(mapGen(512,1000));
        //console.log(`Second map is ${secondMap.size} elements`);
        addAll(map, secondMap);
        assert.equal(map.size, 1000);
        for (let i = 0; i < 1000; i += 2) {
          map.delete(i);
        }
        assert.equal(map.size, 500);
        assert.isFalse(map.keys().some(isEven));
        assert.isTrue(map.keys().every(isOdd));
        addAll(map, mapGen(0,1000));
        assert.equal(map.size, 1000);
        setPerformance(`End 1000 inserts ${testName}`);
        done();
      });
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
    }
    test('Loads', function (done) {
      done();
    });
    for (let {name, mapFactory} of [
      {name: 'HashMap', mapFactory: (map) => new collection.HashMap(map)},
      {name: 'LinkedListHashMap', mapFactory: (map) => new collection.LinkedHashMap(map)},
      // {name: 'native Map', mapFactory: (map) => new Map(map)},
    ]) {
      testMap(mapFactory, name);
    }
  });
});
