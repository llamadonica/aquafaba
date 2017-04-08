/**
 * @license
 * Copyright (c) 2017 Adam Stark. All rights reserved.
 * This code may only be used under the BSD style license found at LICENSE.txt
 */
define('uuid', [], function () {
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
          return Math.floor((1 + Math.random()) * 0x10000)
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
