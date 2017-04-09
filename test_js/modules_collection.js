// @requires bower_components/imd/imd.js

define(['collection'], function (collection) {
  suite('Collection tests', function () {
    // function mapGen(from, to) {
    //   let map = new collection.HashMap();
    //   for (let i = from; i < to; i++) {
    //     map.set(i,i);
    //   }
    //   return map;
    // }
    // function testMap(mapFactory, testName) {
    //   test(`Making big maps for ${testName}`, (done) => {
    //     let map = mapFactory();
    //     for (let i = 0; i < 256; i++) {
    //       map.set(i,i);
    //     }
    //   });
    // }
    test('Loads', function (done) {
      done();
    });
    test('Basic getting and setting', function (done) {
      var x = new collection.HashMap();
      assert.equal(x.size, 0);
      x.set('one', 1);
      assert.equal(x.size, 1);
      assert.equal(x.get('one'), 1);
      done();
    });
  });
});
