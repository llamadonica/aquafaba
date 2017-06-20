// @requires bower_components/imd/imd.js

(function(s,a,c,q){s[a]=s[a]||function(i,m,f){q.push([i,m,f,c._currentScript||
c.currentScript]);};q=s[a].q=s[a].q||[];})(window,"define",document);

(function (root, factory) {
  var onWebcomponentsReady = function () {
    throw new Error("WebComponents aren't loaded so they will never be ready :(");
  }
  if ('registerElement' in document
      && 'import' in document.createElement('link')
      && 'content' in document.createElement('template')) {
    onWebcomponentsReady = function (cb) { cb(); };
  } else {
    (function () {
      var cbs = [];
      onWebcomponentsReady = function (cb) { cbs.push(cb); };
      window.addEventListener('WebComponentsReady', function () {
        for (var i = 0; i < cbs.length; i++) {
          cbs[i]();
        }
        onWebcomponentsReady = function (cb) { cb(); };
      });
    })();
    var e = document.createElement('script');
    e.src = '/bower_components/webcomponentsjs/webcomponents-lite.min.js';
    document.body.appendChild(e);
  }
  onWebcomponentsReady(() => {
    if(typeof define === "function" && define.amd) {
      define(["./iterables.js", "./core.js"], factory);
    } else if(typeof module === "object" && module.exports) { // eslint-disable-line no-undef
      factory(require("iterables"), require("core")); // eslint-disable-line no-undef
    } else {
      root.Aquafaba = root.Aquafaba || {};
      if (!root.Aquafaba.core) {
        throw new Error("Aquafaba.core was not found");
      }
      if (!root.Aquafaba.iterables) {
        throw new Error("Aquafaba.iterables was not found");
      }
      factory(root.Aquafaba.iterables, root.Aquafaba.core);
    }
  });
})(this, function (iterables,core) {
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
