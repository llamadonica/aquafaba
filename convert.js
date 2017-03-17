define('convert', ['core'], function(core) {
  let exports = {};
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
        if (new.target === baseClass) {
          throw new TypeError(
            "Converter is abstract and can't be called directly");
          }
          if (this.convert === undefined) {
            throw new TypeError("Converter must implement `convert` function");
          }
          this[F] = f;
          this[T] = t;
        }
        fuse(otherConverter) {
          if (this[F] != otherConverter[T]) {
            throw new TypeError(`${this[F]} was not a ${otherConverter[T]} in fuse`);
          }
          return new (_FusedConverter__FT(this[F], otherConverter[T]))(this, otherConverter);
        }
      }
      return baseClass;
    });
    exports.Converter__FT = Converter__FT;
    exports.Utf8Encoder = class Utf8Encoder
    extends Converter__FT(String, Uint8Array) {
      constructor() { super(); }
      convert(value) {
        let utf8 = [];
        for (let i=0; i < value.length; i++) {
          let charcode = value.charCodeAt(i);
          if (charcode < 0x80) utf8.push(charcode);
          else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
            0x80 | (charcode & 0x3f));
          }
          else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
            0x80 | ((charcode>>6) & 0x3f),
            0x80 | (charcode & 0x3f));
          }
          // surrogate pair
          else {
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
      constructor() {super();}
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
        this.message = messsage;
      }

    }
    return exports;

  });
