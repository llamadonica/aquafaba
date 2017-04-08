// @requires bower_components/imd/imd.js

define(['core'], function (core) {
  var Iterable__T = core.makeGenericType((T) => {
    return class extends Object {
      static get name() { return `Iterable<${T.name}>`; }
    }
  });
  var ListBase__T = core.makeGenericType((T) => {
    return class extends Object {
      static get name() { return `ListBase<${T.name}>`; }
    }
  });
  var List__T = core.makeGenericType((T) => {
    return class extends Object {
      constructor() {
        super();
      }
      static get implements() {
        return [Iterable__T(T), ListBase__T(T)];
      }
      static get name() { return `List<${T.name}>`; }
    }
  });
  suite('Core tests', function () {
    test('Using a generic type multiple types is equivalent', function (done) {
      assert.equal(Iterable__T(String), Iterable__T(String));
      done();
    });
    test('Using a generic type multiple types is equivalent', function (done) {
      assert.equal(List__T(String), List__T(String));
      done();
    });
  });
});
