define('convert', ['core'], function(core) {
  var exports = {};
  const F = Symbol('_F');
  const T = Symbol('_T');


  var Converter = exports.Converter = class Converter extends core.Object {
    constructor() {
      super();
    }
    static check(obj, target) {
      core.assert(() => target !== Converter,
      "Converter is abstract and can't be called directly");
      core.assert(() => obj.convert !== undefined,
      "Converter must implement `convert` function");
      core.assert(() => obj.fuse !== undefined,
      "Converter must implement `fuse` function");
    }
  };

  let Converter__FT = core.makeGenericType((f,t) => {
    var baseClass;
    baseClass = class extends Converter {
      constructor() {
        super();
        if (this.constructor === baseClass) {
          throw new TypeError(
            "Converter is abstract and can't be called directly");
        }
      }
      static check(obj) {
        obj[F] = f;
        obj[T] = t;
        if (obj.convert === undefined) {
          throw new TypeError("Converter must implement `convert` function");
        }
      }
      fuse(otherConverter) {
        if (this[F] != otherConverter[T]) {
          throw new TypeError(
              `${this[F]} was not a ${otherConverter[T]} in fuse`);
        }
        return new (
            _FusedConverter__FT(
                this[F], otherConverter[T]))(this, otherConverter);
      }
    }
    return baseClass;
  });
  exports.Converter__FT = Converter__FT;

  exports.Utf8Encoder = class Utf8Encoder
      extends Converter__FT(String, Uint8Array) {
    convert(value) {
      let utf8 = [];
      for (let i=0; i < value.length; i++) {
        let charcode = value.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
          0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
          0x80 | ((charcode>>6) & 0x3f),
          0x80 | (charcode & 0x3f));
        } else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
          | (value.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return new Uint8Array(utf8);
    }
  };

  exports.Utf8Decoder = class Utf8Decoder
      extends Converter__FT(Uint8Array, String) {
    convert(value, tolerant = false) {
      let stringResult = '';
      let iterator = value[Symbol.iterator]();
      let result = iterator.next();
      while (!result.done) {
        try {
          let codePoint = 0;
          let addPart = (offset) => {
            result = iterator.next();
            if (result.done) {
              throw new DecoderException('Reached early EOF in UTF8');
            } else if (result.value < 0x80) {
              throw new DecoderException(`Unexpected codepoint 0x${result.value.toString(16)}`);
            }
            codePoint |= (result.value & 0x3f) << offset;
          };
          if (result.value >= 0xf0) {
            //take 4 bytes.
            codePoint |= (result.value & 0x0f) << 18;
            addPart(12);
            addPart(6);
            addPart(0);
          } else if (result.value >= 0xe0) {
            codePoint |= (result.value & 0x0f) << 12;
            addPart(6);
            addPart(0);
          } else if (result.value >= 0xc0) {
            codePoint |= (result.value & 0x0f) << 6;
            addPart(0);
          } else if (result.value < 0x80) {
            codePoint = result.value;
          } else {
            result = iterator.next();
            throw new DecoderException(`Unexpected codepoint 0x${result.value.toString(16)}`);
          }
          stringResult += String.fromCodePoint(codePoint);
          result = iterator.next();
        } catch (e) {
          if (tolerant) continue;
          throw e;
        }
      }
      return stringResult;
    }
  };
  let TypedArray = Uint8Array.__proto__;
  const BASE64_INT_TO_CODE = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R',
    'S','T','U','V','W','X','Y','Z','a','b','c','d','e','f','g','h','i','j',
    'k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','0','1',
    '2','3','4','5','6','7','8','9','+','/',];
  exports.Base64Encoder = class Base64Encoder
      extends Converter__FT(TypedArray, String) {
    constructor() { super(); }
    convert(value) {
      let realArray = new Uint8Array(value.buffer);
      let tick = 0;
      let remainder = 0;
      let result = '';
      let addCodepoint = (codepoint) => {
        let val;
        remainder |= codepoint;
        switch (tick) {
          case 0:
            val = (remainder & 0xfc) >> 2;
            remainder = (remainder & 0x03) << 8;
            result += BASE64_INT_TO_CODE[val];
            tick = 1;
            break;
          case 1:
            val = (remainder & 0x3f0) >> 4;
            remainder = (remainder & 0x0f) << 8;
            result += BASE64_INT_TO_CODE[val];
            tick = 2;
            break;
          case 2:
            val = (remainder & 0xfc0) >> 6;
            result += BASE64_INT_TO_CODE[val];
            val = (remainder & 0x3f);
            result += BASE64_INT_TO_CODE[val];
            remainder = 0;
            tick = 0;
            break;
          default:
            core.assert(() => false, "Assert not reached");
        }
      }
      for (let codepoint of realArray) {
        addCodepoint(codepoint);
      }
      if (tick != 0) {
        addCodepoint(0);
        if (tick == 0) {
          result += '=';
        } else {
          result += '=='
        }
      }
      return result;
    }
  };

  exports.Base64Decoder = class Base64Decoder
      extends Converter__FT(String, TypedArray) {
    constructor() { super(); }
    static get BASE64_CODE_TO_INT() {
      return core.lazyGet(() => {
        let i = 0;
        let result = {};
        for (let codepoint of BASE64_INT_TO_CODE) {
          result[codepoint] = i++;
        }
        return result;
      })();
    }
    /**
     * Converts a base64 encoded string to a corresponding typed array.
     *
     * @param {string} value
     *
     * @returns {TypedArray}
     */
    convert(value) {
      let result = [];
      let round = 0;
      let currentNumber = 0;
      for (let i = 0; i < value.length; i++) {
        let char = value.substr(i, 1);
        let charIndex = exports.Base64Decoder.BASE64_CODE_TO_INT[char];
        if (char == '=' ) {
          if (round != 0 && round < 4) {
            currentNumber <<= ((4 - round)*6);
            if (round == 3) {
              result.push(
                ((currentNumber >> 16) & 0xff),
                ((currentNumber >> 8) & 0xff));
            } else if (round == 2) {
              result.push(
                ((currentNumber >> 16) & 0xff));
            } else {
              throw new DecoderException('Inappropriate place for padding');
            }
            currentNumber = 0;
          }
          round = 0;
        } else if (charIndex != null) {
          currentNumber = (currentNumber << 6) | charIndex;
          if (++round == 4) {
            round = 0;
            result.push(
              ((currentNumber >> 16) & 0xff),
              ((currentNumber >> 8) & 0xff),
              (currentNumber & 0xff));
            currentNumber = 0;
          }
        }
      }
      return new Uint8Array(result);
    }
  };

  const CONVERTER_A_FIELD = Symbol('_converterA');
  const CONVERTER_B_FIELD = Symbol('_converterB');

  let _FusedConverter__FT = (f,t) => class extends Converter__FT(f,t) {
    constructor(converterA, converterB) {
      super();
      this[CONVERTER_A_FIELD] = converterA;
      this[CONVERTER_B_FIELD] = converterB;
    }
    convert(value) {
      return this[CONVERTER_B_FIELD].convert(this[CONVERTER_A_FIELD].convert(value));
    }
  };

  class DecoderException extends core.Object {
    constructor(message) {
      super();
      this.message = message;
    }
  }
  return exports;

});
