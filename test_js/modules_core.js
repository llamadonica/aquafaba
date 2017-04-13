// @requires bower_components/imd/imd.js

(function(s,a,c,q){s[a]=s[a]||function(i,m,f){q.push([i,m,f,c._currentScript||
c.currentScript]);};q=s[a].q=s[a].q||[];})(window,"define",document);

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
    test('Hashes collisions with one salt do not predict hash collisions with another salt', function (done) {
      // Known collisions with our hash function.
      let str1 = "uczixavlfisrqkqohlyeopdycktgxvcf";
      let str2 = "syssrkzedxifvqktsyvuksodbmhnsbwx";
      assert.equal(core.stringHashCode(str1, 0), core.stringHashCode(str2, 0));
      assert.notEqual(core.stringHashCode(str1, 1), core.stringHashCode(str2, 1));
      assert.notEqual(core.stringHashCode(str1, 2), core.stringHashCode(str2, 2));
      done();
    });
  });
});
