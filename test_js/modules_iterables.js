// @requires bower_components/imd/imd.js

(function(s,a,c,q){s[a]=s[a]||function(i,m,f){q.push([i,m,f,c._currentScript||
c.currentScript]);};q=s[a].q=s[a].q||[];})(window,"define",document);

define(['../iterables.js', '../core.js'], function (iterables,core) {
  suite('Iterable tests', function () {
    test('Library loads', (done) => {
      done();
    });
    test('Wrapping iterables works - sequence', (done) => {
      let iterable = iterables.Iterable.generate(256);
      let x = -1;
      for (let i of iterable) {
        assert.equal(i, x + 1);
        x = i;
      }
      done();
    });
    test('Wrapping iterables works - length', (done) => {
      let iterable = iterables.Iterable.generate(256);
      assert.equal(iterable.length, 256);
      done();
    });
    test('Wrapping iterables works - getter', (done) => {
      let iterable = iterables.Iterable.generate(256);
      assert.equal(iterable[core.getOperator](255), 255);
      done();
    });
    test('Wrapping iterables works - filtering', (done) => {
      let iterable = iterables.Iterable.generate(256).filter(x => x < 25);
      assert.equal(iterable.length, 25);
      done();
    });
    test('Wrapping iterables works - mapping', (done) => {
      let iterable = iterables.Iterable.generate(256).map(x => x * 25);
      assert.equal(iterable[core.getOperator](5), 125);
      done();
    });
  });
});
