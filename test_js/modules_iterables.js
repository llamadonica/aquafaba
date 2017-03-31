// @requires bower_components/imd/imd.js

define(['iterables', 'core'], function (iterables, core) {
  suite('Iterable tests', function () {
    class FailIterator extends iterables.Iterator__T(core.types.any) {

    }
    test('Library loads', (done) => {
      done();
    });
    test('Iterators without the require methods fail', (done) => {
      assert.throws(() => new FailIterator());
      done();
    });
    test('Iterators can be wrapped', (done) => {
      var iterator = new iterables.Iterator(([1,2,3,4,5])[Symbol.iterator]());
      assert(core.isInstanceOf(iterator, iterables.Iterator__T(core.types.any)));
      iterator.moveNext();
      assert.equal(iterator.current, 1);
      done();
    });
    test('Can create a list', (done) => {
      var list = new (iterables.List__T(core.types.int))([1,2,3]);
      assert.equal(list[core.getOperator](0), 1);
      done();
    })
  });
});
