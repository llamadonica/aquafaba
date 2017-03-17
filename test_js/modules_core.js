// @requires bower_components/imd/imd.js

define(['core'], function (core) {
  var Iterable__T = core.makeGenericType((T) => {
    return class extends core.Object {
      static get name() { return `Iterable<${T.name}>`; }
    }
  });
  var ListBase__T = core.makeGenericType((T) => {
    return class extends core.Object {
      static get name() { return `ListBase<${T.name}>`; }
    }
  });
  var List__T = core.makeGenericType((T) => {
    return class extends core.Object {
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
    test('Anything is a subtype of any', function (done) {
      assert(core.isInstanceOf(34, core.types.any));
      assert(core.isInstanceOf(34.43434, core.types.any));
      assert(core.isInstanceOf([], core.types.any));
      assert(core.isInstanceOf(new (List__T(String))(), core.types.any));
      done();
    });
    test('Number is a subtype of double', function (done) {
      assert(core.isInstanceOf(34, core.types.double));
      assert(core.isInstanceOf(34.43434, core.types.double));
      done();
    });
    test('Strings work', function (done) {
      assert(core.isInstanceOf('Foo', core.types.String));
      done();
    });
    test('Existing types work', function (done) {
      assert(core.isInstanceOf([], Array));
      assert(core.isInstanceOf([], Object));
      done();
    });
    test('Implementing generic types', function (done) {
      assert(core.isInstanceOf(new (List__T(String))(), List__T(String)));
      done();
    });
    test('Overriding subtypes', function (done) {
      assert(!core.isInstanceOf(new (List__T(String))(), List__T(core.types.any)));
      done();
    });
  });
});
