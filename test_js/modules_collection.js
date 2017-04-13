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
    function testMap(mapFactory, testName) {
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
      });
    }
    test('Loads', function (done) {
      done();
    });
    for (let {name, mapFactory} of [
      {name: 'HashMap', mapFactory: (map) => new collection.HashMap(map)},
      {name: 'LinkedHashMap', mapFactory: (map) => new collection.LinkedHashMap(map)},
      {name: 'native Map', mapFactory: (map) => new collection.WrapMap(map)},
    ]) {
      testMap(mapFactory, name);
    }
  });
});
