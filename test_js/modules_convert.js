(function(s,a,c,q){s[a]=s[a]||function(i,m,f){q.push([i,m,f,c._currentScript||
c.currentScript]);};q=s[a].q=s[a].q||[];})(window,"define",document);
define(['../convert.js'], function (convert) {
  function uint8Equals(valueA, valueB) {
    var iterA = valueA[Symbol.iterator]();
    var iterB = valueB[Symbol.iterator]();
    var resA = iterA.next();
    var resB = iterB.next();
    while (!resA.done && !resB.done) {
      assert.equal(resA.value, resB.value);
      resA = iterA.next(); resB = iterB.next();
    }
    assert.equal(resA.done, resB.done);
  }

  suite('Convert tests', function () {
    test('Basic encode', function (done) {
      let converter = new convert.Utf8Encoder();
      let result = converter.convert('Hello world.');
      uint8Equals(
        result,
        [72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 46]);
      done();
    });
    test('Surrogate pair encode', function (done) {
      let converter = new convert.Utf8Encoder();
      let result = converter.convert('😀😀😀');
      uint8Equals(
        result,
        [240, 159, 152, 128, 240, 159, 152, 128, 240, 159, 152, 128]);
      done();
    });
    test('3 byte encode', function (done) {
      let converter = new convert.Utf8Encoder();
      let result = converter.convert('ばか');
      uint8Equals(
        result,
        [227, 129, 176, 227, 129, 139]);
      done();
    })
    test('2 byte encode', function (done) {
      let converter = new convert.Utf8Encoder();
      let result = converter.convert('þɝɝΔ');
      uint8Equals(
        result,
        [195, 190, 201, 157, 201, 157, 206, 148]);
      done();
    });
    test('Basic encode/decode', (done) => {
      let passThrough = new convert.Utf8Encoder().fuse(new convert.Utf8Decoder());
      let str = 'Hello world.';
      assert.equal(passThrough.convert(str), str);
      done();
    });
    test('Surrogate pair encode/decode', (done) => {
      let passThrough = new convert.Utf8Encoder().fuse(new convert.Utf8Decoder());
      let str = '😀😀😀Hello world.';
      assert.equal(passThrough.convert(str), str);
      done();
    });
    test('3-byte encode/decode', (done) => {
      let passThrough = new convert.Utf8Encoder().fuse(new convert.Utf8Decoder());
      let str = 'ばかHello world.';
      assert.equal(passThrough.convert(str), str);
      done();
    });
    test('2 byte encode/decode', (done) => {
      let passThrough = new convert.Utf8Encoder().fuse(new convert.Utf8Decoder());
      let str = 'þɝɝΔHello world.';
      assert.equal(passThrough.convert(str), str);
      done();
    });
    test('Encodes base64', (done) => {
      let stringToBase64Encoder = new convert.Utf8Encoder().fuse(new convert.Base64Encoder());
      assert.equal(stringToBase64Encoder.convert('any carnal pleasure'), 'YW55IGNhcm5hbCBwbGVhc3VyZQ==');
      done();
    });
    test('Decodes base64', (done) => {
      let stringToBase64Decoder = new convert.Base64Decoder().fuse(new convert.Utf8Decoder());
      assert.equal(stringToBase64Decoder.convert('YW55IGNhcm5hbCBwbGVhc3VyZQ=='), 'any carnal pleasure');
      done();
    })
  });
});
