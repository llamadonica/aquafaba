// @requires bower_components/imd/imd.js

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
      define(["./core.js"], factory);
    } else if(typeof module === "object" && module.exports) { // eslint-disable-line no-undef
      factory(require("core")); // eslint-disable-line no-undef
    } else {
      root.Aquafaba = root.Aquafaba || {};
      if (!root.Aquafaba.core) {
        throw new Error("Aquafaba.core was not found");
      }
      factory(root.Aquafaba.core);
    }
  })
})(this, (core) => {
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
