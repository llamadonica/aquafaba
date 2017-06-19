/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
(function (root, factory) {
  if(typeof define === "function" && define.amd) {
    define([], factory);
  } else if(typeof module === "object" && module.exports) { // eslint-disable-line no-undef
    module.exports = factory(); // eslint-disable-line no-undef
  } else {
    root.Aquafaba = root.Aquafaba || {};
    root.Aquafaba.uuid = factory();
  }
})(this, function () {
  let exports = {};
  exports.v4 = () => {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
    }
    function s3() {
      return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(2);
    }
    function s35() {
      return (Math.floor((1 + Math.random()) * 0x10000) & 0x1bfff | 0x18000)
          .toString(16)
          .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-4' + s3() + '-' +
           s35() + '-' + s4() + s4() + s4();
  };
  return exports;
});
