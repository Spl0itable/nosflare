var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target2, value) => __defProp(target2, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
};

// node_modules/msgpackr/unpack.js
function checkedRead(options) {
  try {
    if (!currentUnpackr.trusted && !sequentialMode) {
      let sharedLength = currentStructures.sharedLength || 0;
      if (sharedLength < currentStructures.length)
        currentStructures.length = sharedLength;
    }
    let result;
    if (currentUnpackr.randomAccessStructure && src[position] < 64 && src[position] >= 32 && readStruct) {
      result = readStruct(src, position, srcEnd, currentUnpackr);
      src = null;
      if (!(options && options.lazy) && result)
        result = result.toJSON();
      position = srcEnd;
    } else
      result = read();
    if (bundledStrings) {
      position = bundledStrings.postBundlePosition;
      bundledStrings = null;
    }
    if (sequentialMode)
      currentStructures.restoreStructures = null;
    if (position == srcEnd) {
      if (currentStructures && currentStructures.restoreStructures)
        restoreStructures();
      currentStructures = null;
      src = null;
      if (referenceMap)
        referenceMap = null;
    } else if (position > srcEnd) {
      throw new Error("Unexpected end of MessagePack data");
    } else if (!sequentialMode) {
      let jsonView;
      try {
        jsonView = JSON.stringify(result, (_, value) => typeof value === "bigint" ? `${value}n` : value).slice(0, 100);
      } catch (error) {
        jsonView = "(JSON view not available " + error + ")";
      }
      throw new Error("Data read, but end of buffer not reached " + jsonView);
    }
    return result;
  } catch (error) {
    if (currentStructures && currentStructures.restoreStructures)
      restoreStructures();
    clearSource();
    if (error instanceof RangeError || error.message.startsWith("Unexpected end of buffer") || position > srcEnd) {
      error.incomplete = true;
    }
    throw error;
  }
}
function restoreStructures() {
  for (let id in currentStructures.restoreStructures) {
    currentStructures[id] = currentStructures.restoreStructures[id];
  }
  currentStructures.restoreStructures = null;
}
function read() {
  let token = src[position++];
  if (token < 160) {
    if (token < 128) {
      if (token < 64)
        return token;
      else {
        let structure = currentStructures[token & 63] || currentUnpackr.getStructures && loadStructures()[token & 63];
        if (structure) {
          if (!structure.read) {
            structure.read = createStructureReader(structure, token & 63);
          }
          return structure.read();
        } else
          return token;
      }
    } else if (token < 144) {
      token -= 128;
      if (currentUnpackr.mapsAsObjects) {
        let object = {};
        for (let i = 0; i < token; i++) {
          let key = readKey();
          if (key === "__proto__")
            key = "__proto_";
          object[key] = read();
        }
        return object;
      } else {
        let map = /* @__PURE__ */ new Map();
        for (let i = 0; i < token; i++) {
          map.set(read(), read());
        }
        return map;
      }
    } else {
      token -= 144;
      let array = new Array(token);
      for (let i = 0; i < token; i++) {
        array[i] = read();
      }
      if (currentUnpackr.freezeData)
        return Object.freeze(array);
      return array;
    }
  } else if (token < 192) {
    let length = token - 160;
    if (srcStringEnd >= position) {
      return srcString.slice(position - srcStringStart, (position += length) - srcStringStart);
    }
    if (srcStringEnd == 0 && srcEnd < 140) {
      let string = length < 16 ? shortStringInJS(length) : longStringInJS(length);
      if (string != null)
        return string;
    }
    return readFixedString(length);
  } else {
    let value;
    switch (token) {
      case 192:
        return null;
      case 193:
        if (bundledStrings) {
          value = read();
          if (value > 0)
            return bundledStrings[1].slice(bundledStrings.position1, bundledStrings.position1 += value);
          else
            return bundledStrings[0].slice(bundledStrings.position0, bundledStrings.position0 -= value);
        }
        return C1;
      case 194:
        return false;
      case 195:
        return true;
      case 196:
        value = src[position++];
        if (value === void 0)
          throw new Error("Unexpected end of buffer");
        return readBin(value);
      case 197:
        value = dataView.getUint16(position);
        position += 2;
        return readBin(value);
      case 198:
        value = dataView.getUint32(position);
        position += 4;
        return readBin(value);
      case 199:
        return readExt(src[position++]);
      case 200:
        value = dataView.getUint16(position);
        position += 2;
        return readExt(value);
      case 201:
        value = dataView.getUint32(position);
        position += 4;
        return readExt(value);
      case 202:
        value = dataView.getFloat32(position);
        if (currentUnpackr.useFloat32 > 2) {
          let multiplier = mult10[(src[position] & 127) << 1 | src[position + 1] >> 7];
          position += 4;
          return (multiplier * value + (value > 0 ? 0.5 : -0.5) >> 0) / multiplier;
        }
        position += 4;
        return value;
      case 203:
        value = dataView.getFloat64(position);
        position += 8;
        return value;
      case 204:
        return src[position++];
      case 205:
        value = dataView.getUint16(position);
        position += 2;
        return value;
      case 206:
        value = dataView.getUint32(position);
        position += 4;
        return value;
      case 207:
        if (currentUnpackr.int64AsType === "number") {
          value = dataView.getUint32(position) * 4294967296;
          value += dataView.getUint32(position + 4);
        } else if (currentUnpackr.int64AsType === "string") {
          value = dataView.getBigUint64(position).toString();
        } else if (currentUnpackr.int64AsType === "auto") {
          value = dataView.getBigUint64(position);
          if (value <= BigInt(2) << BigInt(52))
            value = Number(value);
        } else
          value = dataView.getBigUint64(position);
        position += 8;
        return value;
      case 208:
        return dataView.getInt8(position++);
      case 209:
        value = dataView.getInt16(position);
        position += 2;
        return value;
      case 210:
        value = dataView.getInt32(position);
        position += 4;
        return value;
      case 211:
        if (currentUnpackr.int64AsType === "number") {
          value = dataView.getInt32(position) * 4294967296;
          value += dataView.getUint32(position + 4);
        } else if (currentUnpackr.int64AsType === "string") {
          value = dataView.getBigInt64(position).toString();
        } else if (currentUnpackr.int64AsType === "auto") {
          value = dataView.getBigInt64(position);
          if (value >= BigInt(-2) << BigInt(52) && value <= BigInt(2) << BigInt(52))
            value = Number(value);
        } else
          value = dataView.getBigInt64(position);
        position += 8;
        return value;
      case 212:
        value = src[position++];
        if (value == 114) {
          return recordDefinition(src[position++] & 63);
        } else {
          let extension = currentExtensions[value];
          if (extension) {
            if (extension.read) {
              position++;
              return extension.read(read());
            } else if (extension.noBuffer) {
              position++;
              return extension();
            } else
              return extension(src.subarray(position, ++position));
          } else
            throw new Error("Unknown extension " + value);
        }
      case 213:
        value = src[position];
        if (value == 114) {
          position++;
          return recordDefinition(src[position++] & 63, src[position++]);
        } else
          return readExt(2);
      case 214:
        return readExt(4);
      case 215:
        return readExt(8);
      case 216:
        return readExt(16);
      case 217:
        value = src[position++];
        if (srcStringEnd >= position) {
          return srcString.slice(position - srcStringStart, (position += value) - srcStringStart);
        }
        return readString8(value);
      case 218:
        value = dataView.getUint16(position);
        position += 2;
        if (srcStringEnd >= position) {
          return srcString.slice(position - srcStringStart, (position += value) - srcStringStart);
        }
        return readString16(value);
      case 219:
        value = dataView.getUint32(position);
        position += 4;
        if (srcStringEnd >= position) {
          return srcString.slice(position - srcStringStart, (position += value) - srcStringStart);
        }
        return readString32(value);
      case 220:
        value = dataView.getUint16(position);
        position += 2;
        return readArray(value);
      case 221:
        value = dataView.getUint32(position);
        position += 4;
        return readArray(value);
      case 222:
        value = dataView.getUint16(position);
        position += 2;
        return readMap(value);
      case 223:
        value = dataView.getUint32(position);
        position += 4;
        return readMap(value);
      default:
        if (token >= 224)
          return token - 256;
        if (token === void 0) {
          let error = new Error("Unexpected end of MessagePack data");
          error.incomplete = true;
          throw error;
        }
        throw new Error("Unknown MessagePack token " + token);
    }
  }
}
function createStructureReader(structure, firstId) {
  function readObject() {
    if (readObject.count++ > inlineObjectReadThreshold) {
      let readObject2 = structure.read = new Function("r", "return function(){return " + (currentUnpackr.freezeData ? "Object.freeze" : "") + "({" + structure.map((key) => key === "__proto__" ? "__proto_:r()" : validName.test(key) ? key + ":r()" : "[" + JSON.stringify(key) + "]:r()").join(",") + "})}")(read);
      if (structure.highByte === 0)
        structure.read = createSecondByteReader(firstId, structure.read);
      return readObject2();
    }
    let object = {};
    for (let i = 0, l = structure.length; i < l; i++) {
      let key = structure[i];
      if (key === "__proto__")
        key = "__proto_";
      object[key] = read();
    }
    if (currentUnpackr.freezeData)
      return Object.freeze(object);
    return object;
  }
  __name(readObject, "readObject");
  readObject.count = 0;
  if (structure.highByte === 0) {
    return createSecondByteReader(firstId, readObject);
  }
  return readObject;
}
function loadStructures() {
  let loadedStructures = saveState(() => {
    src = null;
    return currentUnpackr.getStructures();
  });
  return currentStructures = currentUnpackr._mergeStructures(loadedStructures, currentStructures);
}
function readStringJS(length) {
  let result;
  if (length < 16) {
    if (result = shortStringInJS(length))
      return result;
  }
  if (length > 64 && decoder)
    return decoder.decode(src.subarray(position, position += length));
  const end = position + length;
  const units = [];
  result = "";
  while (position < end) {
    const byte1 = src[position++];
    if ((byte1 & 128) === 0) {
      units.push(byte1);
    } else if ((byte1 & 224) === 192) {
      const byte2 = src[position++] & 63;
      units.push((byte1 & 31) << 6 | byte2);
    } else if ((byte1 & 240) === 224) {
      const byte2 = src[position++] & 63;
      const byte3 = src[position++] & 63;
      units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
    } else if ((byte1 & 248) === 240) {
      const byte2 = src[position++] & 63;
      const byte3 = src[position++] & 63;
      const byte4 = src[position++] & 63;
      let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
      if (unit > 65535) {
        unit -= 65536;
        units.push(unit >>> 10 & 1023 | 55296);
        unit = 56320 | unit & 1023;
      }
      units.push(unit);
    } else {
      units.push(byte1);
    }
    if (units.length >= 4096) {
      result += fromCharCode.apply(String, units);
      units.length = 0;
    }
  }
  if (units.length > 0) {
    result += fromCharCode.apply(String, units);
  }
  return result;
}
function readArray(length) {
  let array = new Array(length);
  for (let i = 0; i < length; i++) {
    array[i] = read();
  }
  if (currentUnpackr.freezeData)
    return Object.freeze(array);
  return array;
}
function readMap(length) {
  if (currentUnpackr.mapsAsObjects) {
    let object = {};
    for (let i = 0; i < length; i++) {
      let key = readKey();
      if (key === "__proto__")
        key = "__proto_";
      object[key] = read();
    }
    return object;
  } else {
    let map = /* @__PURE__ */ new Map();
    for (let i = 0; i < length; i++) {
      map.set(read(), read());
    }
    return map;
  }
}
function longStringInJS(length) {
  let start = position;
  let bytes = new Array(length);
  for (let i = 0; i < length; i++) {
    const byte = src[position++];
    if ((byte & 128) > 0) {
      position = start;
      return;
    }
    bytes[i] = byte;
  }
  return fromCharCode.apply(String, bytes);
}
function shortStringInJS(length) {
  if (length < 4) {
    if (length < 2) {
      if (length === 0)
        return "";
      else {
        let a = src[position++];
        if ((a & 128) > 1) {
          position -= 1;
          return;
        }
        return fromCharCode(a);
      }
    } else {
      let a = src[position++];
      let b = src[position++];
      if ((a & 128) > 0 || (b & 128) > 0) {
        position -= 2;
        return;
      }
      if (length < 3)
        return fromCharCode(a, b);
      let c = src[position++];
      if ((c & 128) > 0) {
        position -= 3;
        return;
      }
      return fromCharCode(a, b, c);
    }
  } else {
    let a = src[position++];
    let b = src[position++];
    let c = src[position++];
    let d = src[position++];
    if ((a & 128) > 0 || (b & 128) > 0 || (c & 128) > 0 || (d & 128) > 0) {
      position -= 4;
      return;
    }
    if (length < 6) {
      if (length === 4)
        return fromCharCode(a, b, c, d);
      else {
        let e = src[position++];
        if ((e & 128) > 0) {
          position -= 5;
          return;
        }
        return fromCharCode(a, b, c, d, e);
      }
    } else if (length < 8) {
      let e = src[position++];
      let f = src[position++];
      if ((e & 128) > 0 || (f & 128) > 0) {
        position -= 6;
        return;
      }
      if (length < 7)
        return fromCharCode(a, b, c, d, e, f);
      let g = src[position++];
      if ((g & 128) > 0) {
        position -= 7;
        return;
      }
      return fromCharCode(a, b, c, d, e, f, g);
    } else {
      let e = src[position++];
      let f = src[position++];
      let g = src[position++];
      let h = src[position++];
      if ((e & 128) > 0 || (f & 128) > 0 || (g & 128) > 0 || (h & 128) > 0) {
        position -= 8;
        return;
      }
      if (length < 10) {
        if (length === 8)
          return fromCharCode(a, b, c, d, e, f, g, h);
        else {
          let i = src[position++];
          if ((i & 128) > 0) {
            position -= 9;
            return;
          }
          return fromCharCode(a, b, c, d, e, f, g, h, i);
        }
      } else if (length < 12) {
        let i = src[position++];
        let j = src[position++];
        if ((i & 128) > 0 || (j & 128) > 0) {
          position -= 10;
          return;
        }
        if (length < 11)
          return fromCharCode(a, b, c, d, e, f, g, h, i, j);
        let k = src[position++];
        if ((k & 128) > 0) {
          position -= 11;
          return;
        }
        return fromCharCode(a, b, c, d, e, f, g, h, i, j, k);
      } else {
        let i = src[position++];
        let j = src[position++];
        let k = src[position++];
        let l = src[position++];
        if ((i & 128) > 0 || (j & 128) > 0 || (k & 128) > 0 || (l & 128) > 0) {
          position -= 12;
          return;
        }
        if (length < 14) {
          if (length === 12)
            return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l);
          else {
            let m = src[position++];
            if ((m & 128) > 0) {
              position -= 13;
              return;
            }
            return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m);
          }
        } else {
          let m = src[position++];
          let n = src[position++];
          if ((m & 128) > 0 || (n & 128) > 0) {
            position -= 14;
            return;
          }
          if (length < 15)
            return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n);
          let o = src[position++];
          if ((o & 128) > 0) {
            position -= 15;
            return;
          }
          return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o);
        }
      }
    }
  }
}
function readOnlyJSString() {
  let token = src[position++];
  let length;
  if (token < 192) {
    length = token - 160;
  } else {
    switch (token) {
      case 217:
        length = src[position++];
        break;
      case 218:
        length = dataView.getUint16(position);
        position += 2;
        break;
      case 219:
        length = dataView.getUint32(position);
        position += 4;
        break;
      default:
        throw new Error("Expected string");
    }
  }
  return readStringJS(length);
}
function readBin(length) {
  return currentUnpackr.copyBuffers ? (
    // specifically use the copying slice (not the node one)
    Uint8Array.prototype.slice.call(src, position, position += length)
  ) : src.subarray(position, position += length);
}
function readExt(length) {
  let type = src[position++];
  if (currentExtensions[type]) {
    let end;
    return currentExtensions[type](src.subarray(position, end = position += length), (readPosition) => {
      position = readPosition;
      try {
        return read();
      } finally {
        position = end;
      }
    });
  } else
    throw new Error("Unknown extension type " + type);
}
function readKey() {
  let length = src[position++];
  if (length >= 160 && length < 192) {
    length = length - 160;
    if (srcStringEnd >= position)
      return srcString.slice(position - srcStringStart, (position += length) - srcStringStart);
    else if (!(srcStringEnd == 0 && srcEnd < 180))
      return readFixedString(length);
  } else {
    position--;
    return asSafeString(read());
  }
  let key = (length << 5 ^ (length > 1 ? dataView.getUint16(position) : length > 0 ? src[position] : 0)) & 4095;
  let entry = keyCache[key];
  let checkPosition = position;
  let end = position + length - 3;
  let chunk;
  let i = 0;
  if (entry && entry.bytes == length) {
    while (checkPosition < end) {
      chunk = dataView.getUint32(checkPosition);
      if (chunk != entry[i++]) {
        checkPosition = 1879048192;
        break;
      }
      checkPosition += 4;
    }
    end += 3;
    while (checkPosition < end) {
      chunk = src[checkPosition++];
      if (chunk != entry[i++]) {
        checkPosition = 1879048192;
        break;
      }
    }
    if (checkPosition === end) {
      position = checkPosition;
      return entry.string;
    }
    end -= 3;
    checkPosition = position;
  }
  entry = [];
  keyCache[key] = entry;
  entry.bytes = length;
  while (checkPosition < end) {
    chunk = dataView.getUint32(checkPosition);
    entry.push(chunk);
    checkPosition += 4;
  }
  end += 3;
  while (checkPosition < end) {
    chunk = src[checkPosition++];
    entry.push(chunk);
  }
  let string = length < 16 ? shortStringInJS(length) : longStringInJS(length);
  if (string != null)
    return entry.string = string;
  return entry.string = readFixedString(length);
}
function asSafeString(property) {
  if (typeof property === "string")
    return property;
  if (typeof property === "number" || typeof property === "boolean" || typeof property === "bigint")
    return property.toString();
  if (property == null)
    return property + "";
  if (currentUnpackr.allowArraysInMapKeys && Array.isArray(property) && property.flat().every((item) => ["string", "number", "boolean", "bigint"].includes(typeof item))) {
    return property.flat().toString();
  }
  throw new Error(`Invalid property type for record: ${typeof property}`);
}
function saveState(callback) {
  if (onSaveState)
    onSaveState();
  let savedSrcEnd = srcEnd;
  let savedPosition = position;
  let savedStringPosition = stringPosition;
  let savedSrcStringStart = srcStringStart;
  let savedSrcStringEnd = srcStringEnd;
  let savedSrcString = srcString;
  let savedStrings = strings;
  let savedReferenceMap = referenceMap;
  let savedBundledStrings = bundledStrings;
  let savedSrc = new Uint8Array(src.slice(0, srcEnd));
  let savedStructures = currentStructures;
  let savedStructuresContents = currentStructures.slice(0, currentStructures.length);
  let savedPackr = currentUnpackr;
  let savedSequentialMode = sequentialMode;
  let value = callback();
  srcEnd = savedSrcEnd;
  position = savedPosition;
  stringPosition = savedStringPosition;
  srcStringStart = savedSrcStringStart;
  srcStringEnd = savedSrcStringEnd;
  srcString = savedSrcString;
  strings = savedStrings;
  referenceMap = savedReferenceMap;
  bundledStrings = savedBundledStrings;
  src = savedSrc;
  sequentialMode = savedSequentialMode;
  currentStructures = savedStructures;
  currentStructures.splice(0, currentStructures.length, ...savedStructuresContents);
  currentUnpackr = savedPackr;
  dataView = new DataView(src.buffer, src.byteOffset, src.byteLength);
  return value;
}
function clearSource() {
  src = null;
  referenceMap = null;
  currentStructures = null;
}
var decoder, src, srcEnd, position, EMPTY_ARRAY, strings, stringPosition, currentUnpackr, currentStructures, srcString, srcStringStart, srcStringEnd, bundledStrings, referenceMap, currentExtensions, dataView, defaultOptions, _C1Type, C1Type, C1, sequentialMode, inlineObjectReadThreshold, readStruct, onLoadedStructures, onSaveState, _Unpackr, Unpackr, validName, createSecondByteReader, readFixedString, readString8, readString16, readString32, fromCharCode, keyCache, recordDefinition, errors, typedArrays, glbl, TEMP_BUNDLE, mult10, defaultUnpackr, unpack, unpackMultiple, decode, FLOAT32_OPTIONS, f32Array, u8Array;
var init_unpack = __esm({
  "node_modules/msgpackr/unpack.js"() {
    try {
      decoder = new TextDecoder();
    } catch (error) {
    }
    position = 0;
    EMPTY_ARRAY = [];
    strings = EMPTY_ARRAY;
    stringPosition = 0;
    currentUnpackr = {};
    srcStringStart = 0;
    srcStringEnd = 0;
    currentExtensions = [];
    defaultOptions = {
      useRecords: false,
      mapsAsObjects: true
    };
    _C1Type = class _C1Type {
    };
    __name(_C1Type, "C1Type");
    C1Type = _C1Type;
    C1 = new C1Type();
    C1.name = "MessagePack 0xC1";
    sequentialMode = false;
    inlineObjectReadThreshold = 2;
    try {
      new Function("");
    } catch (error) {
      inlineObjectReadThreshold = Infinity;
    }
    _Unpackr = class _Unpackr {
      constructor(options) {
        if (options) {
          if (options.useRecords === false && options.mapsAsObjects === void 0)
            options.mapsAsObjects = true;
          if (options.sequential && options.trusted !== false) {
            options.trusted = true;
            if (!options.structures && options.useRecords != false) {
              options.structures = [];
              if (!options.maxSharedStructures)
                options.maxSharedStructures = 0;
            }
          }
          if (options.structures)
            options.structures.sharedLength = options.structures.length;
          else if (options.getStructures) {
            (options.structures = []).uninitialized = true;
            options.structures.sharedLength = 0;
          }
          if (options.int64AsNumber) {
            options.int64AsType = "number";
          }
        }
        Object.assign(this, options);
      }
      unpack(source, options) {
        if (src) {
          return saveState(() => {
            clearSource();
            return this ? this.unpack(source, options) : _Unpackr.prototype.unpack.call(defaultOptions, source, options);
          });
        }
        if (!source.buffer && source.constructor === ArrayBuffer)
          source = typeof Buffer !== "undefined" ? Buffer.from(source) : new Uint8Array(source);
        if (typeof options === "object") {
          srcEnd = options.end || source.length;
          position = options.start || 0;
        } else {
          position = 0;
          srcEnd = options > -1 ? options : source.length;
        }
        stringPosition = 0;
        srcStringEnd = 0;
        srcString = null;
        strings = EMPTY_ARRAY;
        bundledStrings = null;
        src = source;
        try {
          dataView = source.dataView || (source.dataView = new DataView(source.buffer, source.byteOffset, source.byteLength));
        } catch (error) {
          src = null;
          if (source instanceof Uint8Array)
            throw error;
          throw new Error("Source must be a Uint8Array or Buffer but was a " + (source && typeof source == "object" ? source.constructor.name : typeof source));
        }
        if (this instanceof _Unpackr) {
          currentUnpackr = this;
          if (this.structures) {
            currentStructures = this.structures;
            return checkedRead(options);
          } else if (!currentStructures || currentStructures.length > 0) {
            currentStructures = [];
          }
        } else {
          currentUnpackr = defaultOptions;
          if (!currentStructures || currentStructures.length > 0)
            currentStructures = [];
        }
        return checkedRead(options);
      }
      unpackMultiple(source, forEach) {
        let values, lastPosition = 0;
        try {
          sequentialMode = true;
          let size = source.length;
          let value = this ? this.unpack(source, size) : defaultUnpackr.unpack(source, size);
          if (forEach) {
            if (forEach(value, lastPosition, position) === false)
              return;
            while (position < size) {
              lastPosition = position;
              if (forEach(checkedRead(), lastPosition, position) === false) {
                return;
              }
            }
          } else {
            values = [value];
            while (position < size) {
              lastPosition = position;
              values.push(checkedRead());
            }
            return values;
          }
        } catch (error) {
          error.lastPosition = lastPosition;
          error.values = values;
          throw error;
        } finally {
          sequentialMode = false;
          clearSource();
        }
      }
      _mergeStructures(loadedStructures, existingStructures) {
        if (onLoadedStructures)
          loadedStructures = onLoadedStructures.call(this, loadedStructures);
        loadedStructures = loadedStructures || [];
        if (Object.isFrozen(loadedStructures))
          loadedStructures = loadedStructures.map((structure) => structure.slice(0));
        for (let i = 0, l = loadedStructures.length; i < l; i++) {
          let structure = loadedStructures[i];
          if (structure) {
            structure.isShared = true;
            if (i >= 32)
              structure.highByte = i - 32 >> 5;
          }
        }
        loadedStructures.sharedLength = loadedStructures.length;
        for (let id in existingStructures || []) {
          if (id >= 0) {
            let structure = loadedStructures[id];
            let existing = existingStructures[id];
            if (existing) {
              if (structure)
                (loadedStructures.restoreStructures || (loadedStructures.restoreStructures = []))[id] = structure;
              loadedStructures[id] = existing;
            }
          }
        }
        return this.structures = loadedStructures;
      }
      decode(source, options) {
        return this.unpack(source, options);
      }
    };
    __name(_Unpackr, "Unpackr");
    Unpackr = _Unpackr;
    __name(checkedRead, "checkedRead");
    __name(restoreStructures, "restoreStructures");
    __name(read, "read");
    validName = /^[a-zA-Z_$][a-zA-Z\d_$]*$/;
    __name(createStructureReader, "createStructureReader");
    createSecondByteReader = /* @__PURE__ */ __name((firstId, read0) => {
      return function() {
        let highByte = src[position++];
        if (highByte === 0)
          return read0();
        let id = firstId < 32 ? -(firstId + (highByte << 5)) : firstId + (highByte << 5);
        let structure = currentStructures[id] || loadStructures()[id];
        if (!structure) {
          throw new Error("Record id is not defined for " + id);
        }
        if (!structure.read)
          structure.read = createStructureReader(structure, firstId);
        return structure.read();
      };
    }, "createSecondByteReader");
    __name(loadStructures, "loadStructures");
    readFixedString = readStringJS;
    readString8 = readStringJS;
    readString16 = readStringJS;
    readString32 = readStringJS;
    __name(readStringJS, "readStringJS");
    __name(readArray, "readArray");
    __name(readMap, "readMap");
    fromCharCode = String.fromCharCode;
    __name(longStringInJS, "longStringInJS");
    __name(shortStringInJS, "shortStringInJS");
    __name(readOnlyJSString, "readOnlyJSString");
    __name(readBin, "readBin");
    __name(readExt, "readExt");
    keyCache = new Array(4096);
    __name(readKey, "readKey");
    __name(asSafeString, "asSafeString");
    recordDefinition = /* @__PURE__ */ __name((id, highByte) => {
      let structure = read().map(asSafeString);
      let firstByte = id;
      if (highByte !== void 0) {
        id = id < 32 ? -((highByte << 5) + id) : (highByte << 5) + id;
        structure.highByte = highByte;
      }
      let existingStructure = currentStructures[id];
      if (existingStructure && (existingStructure.isShared || sequentialMode)) {
        (currentStructures.restoreStructures || (currentStructures.restoreStructures = []))[id] = existingStructure;
      }
      currentStructures[id] = structure;
      structure.read = createStructureReader(structure, firstByte);
      return structure.read();
    }, "recordDefinition");
    currentExtensions[0] = () => {
    };
    currentExtensions[0].noBuffer = true;
    currentExtensions[66] = (data) => {
      let headLength = data.byteLength % 8 || 8;
      let head = BigInt(data[0] & 128 ? data[0] - 256 : data[0]);
      for (let i = 1; i < headLength; i++) {
        head <<= BigInt(8);
        head += BigInt(data[i]);
      }
      if (data.byteLength !== headLength) {
        let view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let decode2 = /* @__PURE__ */ __name((start, end) => {
          let length = end - start;
          if (length <= 40) {
            let out = view.getBigUint64(start);
            for (let i = start + 8; i < end; i += 8) {
              out <<= BigInt(64n);
              out |= view.getBigUint64(i);
            }
            return out;
          }
          let middle = start + (length >> 4 << 3);
          let left = decode2(start, middle);
          let right = decode2(middle, end);
          return left << BigInt((end - middle) * 8) | right;
        }, "decode");
        head = head << BigInt((view.byteLength - headLength) * 8) | decode2(headLength, view.byteLength);
      }
      return head;
    };
    errors = {
      Error,
      EvalError,
      RangeError,
      ReferenceError,
      SyntaxError,
      TypeError,
      URIError,
      AggregateError: typeof AggregateError === "function" ? AggregateError : null
    };
    currentExtensions[101] = () => {
      let data = read();
      if (!errors[data[0]]) {
        let error = Error(data[1], { cause: data[2] });
        error.name = data[0];
        return error;
      }
      return errors[data[0]](data[1], { cause: data[2] });
    };
    currentExtensions[105] = (data) => {
      if (currentUnpackr.structuredClone === false)
        throw new Error("Structured clone extension is disabled");
      let id = dataView.getUint32(position - 4);
      if (!referenceMap)
        referenceMap = /* @__PURE__ */ new Map();
      let token = src[position];
      let target2;
      if (token >= 144 && token < 160 || token == 220 || token == 221)
        target2 = [];
      else if (token >= 128 && token < 144 || token == 222 || token == 223)
        target2 = /* @__PURE__ */ new Map();
      else if ((token >= 199 && token <= 201 || token >= 212 && token <= 216) && src[position + 1] === 115)
        target2 = /* @__PURE__ */ new Set();
      else
        target2 = {};
      let refEntry = { target: target2 };
      referenceMap.set(id, refEntry);
      let targetProperties = read();
      if (!refEntry.used) {
        return refEntry.target = targetProperties;
      } else {
        Object.assign(target2, targetProperties);
      }
      if (target2 instanceof Map)
        for (let [k, v] of targetProperties.entries())
          target2.set(k, v);
      if (target2 instanceof Set)
        for (let i of Array.from(targetProperties))
          target2.add(i);
      return target2;
    };
    currentExtensions[112] = (data) => {
      if (currentUnpackr.structuredClone === false)
        throw new Error("Structured clone extension is disabled");
      let id = dataView.getUint32(position - 4);
      let refEntry = referenceMap.get(id);
      refEntry.used = true;
      return refEntry.target;
    };
    currentExtensions[115] = () => new Set(read());
    typedArrays = ["Int8", "Uint8", "Uint8Clamped", "Int16", "Uint16", "Int32", "Uint32", "Float32", "Float64", "BigInt64", "BigUint64"].map((type) => type + "Array");
    glbl = typeof globalThis === "object" ? globalThis : window;
    currentExtensions[116] = (data) => {
      let typeCode = data[0];
      let buffer = Uint8Array.prototype.slice.call(data, 1).buffer;
      let typedArrayName = typedArrays[typeCode];
      if (!typedArrayName) {
        if (typeCode === 16)
          return buffer;
        if (typeCode === 17)
          return new DataView(buffer);
        throw new Error("Could not find typed array for code " + typeCode);
      }
      return new glbl[typedArrayName](buffer);
    };
    currentExtensions[120] = () => {
      let data = read();
      return new RegExp(data[0], data[1]);
    };
    TEMP_BUNDLE = [];
    currentExtensions[98] = (data) => {
      let dataSize = (data[0] << 24) + (data[1] << 16) + (data[2] << 8) + data[3];
      let dataPosition = position;
      position += dataSize - data.length;
      bundledStrings = TEMP_BUNDLE;
      bundledStrings = [readOnlyJSString(), readOnlyJSString()];
      bundledStrings.position0 = 0;
      bundledStrings.position1 = 0;
      bundledStrings.postBundlePosition = position;
      position = dataPosition;
      return read();
    };
    currentExtensions[255] = (data) => {
      if (data.length == 4)
        return new Date((data[0] * 16777216 + (data[1] << 16) + (data[2] << 8) + data[3]) * 1e3);
      else if (data.length == 8)
        return new Date(
          ((data[0] << 22) + (data[1] << 14) + (data[2] << 6) + (data[3] >> 2)) / 1e6 + ((data[3] & 3) * 4294967296 + data[4] * 16777216 + (data[5] << 16) + (data[6] << 8) + data[7]) * 1e3
        );
      else if (data.length == 12)
        return new Date(
          ((data[0] << 24) + (data[1] << 16) + (data[2] << 8) + data[3]) / 1e6 + ((data[4] & 128 ? -281474976710656 : 0) + data[6] * 1099511627776 + data[7] * 4294967296 + data[8] * 16777216 + (data[9] << 16) + (data[10] << 8) + data[11]) * 1e3
        );
      else
        return /* @__PURE__ */ new Date("invalid");
    };
    __name(saveState, "saveState");
    __name(clearSource, "clearSource");
    mult10 = new Array(147);
    for (let i = 0; i < 256; i++) {
      mult10[i] = +("1e" + Math.floor(45.15 - i * 0.30103));
    }
    defaultUnpackr = new Unpackr({ useRecords: false });
    unpack = defaultUnpackr.unpack;
    unpackMultiple = defaultUnpackr.unpackMultiple;
    decode = defaultUnpackr.unpack;
    FLOAT32_OPTIONS = {
      NEVER: 0,
      ALWAYS: 1,
      DECIMAL_ROUND: 3,
      DECIMAL_FIT: 4
    };
    f32Array = new Float32Array(1);
    u8Array = new Uint8Array(f32Array.buffer, 0, 4);
  }
});

// node_modules/msgpackr/pack.js
function writeExtBuffer(typedArray, type, allocateForWrite, encode2) {
  let length = typedArray.byteLength;
  if (length + 1 < 256) {
    var { target: target2, position: position3 } = allocateForWrite(4 + length);
    target2[position3++] = 199;
    target2[position3++] = length + 1;
  } else if (length + 1 < 65536) {
    var { target: target2, position: position3 } = allocateForWrite(5 + length);
    target2[position3++] = 200;
    target2[position3++] = length + 1 >> 8;
    target2[position3++] = length + 1 & 255;
  } else {
    var { target: target2, position: position3, targetView: targetView2 } = allocateForWrite(7 + length);
    target2[position3++] = 201;
    targetView2.setUint32(position3, length + 1);
    position3 += 4;
  }
  target2[position3++] = 116;
  target2[position3++] = type;
  if (!typedArray.buffer)
    typedArray = new Uint8Array(typedArray);
  target2.set(new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength), position3);
}
function writeBuffer(buffer, allocateForWrite) {
  let length = buffer.byteLength;
  var target2, position3;
  if (length < 256) {
    var { target: target2, position: position3 } = allocateForWrite(length + 2);
    target2[position3++] = 196;
    target2[position3++] = length;
  } else if (length < 65536) {
    var { target: target2, position: position3 } = allocateForWrite(length + 3);
    target2[position3++] = 197;
    target2[position3++] = length >> 8;
    target2[position3++] = length & 255;
  } else {
    var { target: target2, position: position3, targetView: targetView2 } = allocateForWrite(length + 5);
    target2[position3++] = 198;
    targetView2.setUint32(position3, length);
    position3 += 4;
  }
  target2.set(buffer, position3);
}
function writeExtensionData(result, target2, position3, type) {
  let length = result.length;
  switch (length) {
    case 1:
      target2[position3++] = 212;
      break;
    case 2:
      target2[position3++] = 213;
      break;
    case 4:
      target2[position3++] = 214;
      break;
    case 8:
      target2[position3++] = 215;
      break;
    case 16:
      target2[position3++] = 216;
      break;
    default:
      if (length < 256) {
        target2[position3++] = 199;
        target2[position3++] = length;
      } else if (length < 65536) {
        target2[position3++] = 200;
        target2[position3++] = length >> 8;
        target2[position3++] = length & 255;
      } else {
        target2[position3++] = 201;
        target2[position3++] = length >> 24;
        target2[position3++] = length >> 16 & 255;
        target2[position3++] = length >> 8 & 255;
        target2[position3++] = length & 255;
      }
  }
  target2[position3++] = type;
  target2.set(result, position3);
  position3 += length;
  return position3;
}
function insertIds(serialized, idsToInsert) {
  let nextId;
  let distanceToMove = idsToInsert.length * 6;
  let lastEnd = serialized.length - distanceToMove;
  while (nextId = idsToInsert.pop()) {
    let offset = nextId.offset;
    let id = nextId.id;
    serialized.copyWithin(offset + distanceToMove, offset, lastEnd);
    distanceToMove -= 6;
    let position3 = offset + distanceToMove;
    serialized[position3++] = 214;
    serialized[position3++] = 105;
    serialized[position3++] = id >> 24;
    serialized[position3++] = id >> 16 & 255;
    serialized[position3++] = id >> 8 & 255;
    serialized[position3++] = id & 255;
    lastEnd = offset;
  }
  return serialized;
}
function writeBundles(start, pack2, incrementPosition) {
  if (bundledStrings2.length > 0) {
    targetView.setUint32(bundledStrings2.position + start, position2 + incrementPosition - bundledStrings2.position - start);
    bundledStrings2.stringsPosition = position2 - start;
    let writeStrings = bundledStrings2;
    bundledStrings2 = null;
    pack2(writeStrings[0]);
    pack2(writeStrings[1]);
  }
}
function prepareStructures(structures, packr) {
  structures.isCompatible = (existingStructures) => {
    let compatible = !existingStructures || (packr.lastNamedStructuresLength || 0) === existingStructures.length;
    if (!compatible)
      packr._mergeStructures(existingStructures);
    return compatible;
  };
  return structures;
}
var textEncoder, extensions, extensionClasses, hasNodeBuffer, ByteArrayAllocate, ByteArray, MAX_BUFFER_SIZE, target, keysTarget, targetView, position2, safeEnd, bundledStrings2, writeStructSlots, MAX_BUNDLE_SIZE, hasNonLatin, RECORD_SYMBOL, _Packr, Packr, defaultPackr, pack, encode, NEVER, ALWAYS, DECIMAL_ROUND, DECIMAL_FIT, REUSE_BUFFER_MODE, RESET_BUFFER_MODE, RESERVE_START_SPACE;
var init_pack = __esm({
  "node_modules/msgpackr/pack.js"() {
    init_unpack();
    init_unpack();
    init_unpack();
    try {
      textEncoder = new TextEncoder();
    } catch (error) {
    }
    hasNodeBuffer = typeof Buffer !== "undefined";
    ByteArrayAllocate = hasNodeBuffer ? function(length) {
      return Buffer.allocUnsafeSlow(length);
    } : Uint8Array;
    ByteArray = hasNodeBuffer ? Buffer : Uint8Array;
    MAX_BUFFER_SIZE = hasNodeBuffer ? 4294967296 : 2144337920;
    position2 = 0;
    bundledStrings2 = null;
    MAX_BUNDLE_SIZE = 21760;
    hasNonLatin = /[\u0080-\uFFFF]/;
    RECORD_SYMBOL = Symbol("record-id");
    _Packr = class _Packr extends Unpackr {
      constructor(options) {
        super(options);
        this.offset = 0;
        let typeBuffer;
        let start;
        let hasSharedUpdate;
        let structures;
        let referenceMap2;
        let encodeUtf8 = ByteArray.prototype.utf8Write ? function(string, position3) {
          return target.utf8Write(string, position3, target.byteLength - position3);
        } : textEncoder && textEncoder.encodeInto ? function(string, position3) {
          return textEncoder.encodeInto(string, target.subarray(position3)).written;
        } : false;
        let packr = this;
        if (!options)
          options = {};
        let isSequential = options && options.sequential;
        let hasSharedStructures = options.structures || options.saveStructures;
        let maxSharedStructures = options.maxSharedStructures;
        if (maxSharedStructures == null)
          maxSharedStructures = hasSharedStructures ? 32 : 0;
        if (maxSharedStructures > 8160)
          throw new Error("Maximum maxSharedStructure is 8160");
        if (options.structuredClone && options.moreTypes == void 0) {
          this.moreTypes = true;
        }
        let maxOwnStructures = options.maxOwnStructures;
        if (maxOwnStructures == null)
          maxOwnStructures = hasSharedStructures ? 32 : 64;
        if (!this.structures && options.useRecords != false)
          this.structures = [];
        let useTwoByteRecords = maxSharedStructures > 32 || maxOwnStructures + maxSharedStructures > 64;
        let sharedLimitId = maxSharedStructures + 64;
        let maxStructureId = maxSharedStructures + maxOwnStructures + 64;
        if (maxStructureId > 8256) {
          throw new Error("Maximum maxSharedStructure + maxOwnStructure is 8192");
        }
        let recordIdsToRemove = [];
        let transitionsCount = 0;
        let serializationsSinceTransitionRebuild = 0;
        this.pack = this.encode = function(value, encodeOptions) {
          if (!target) {
            target = new ByteArrayAllocate(8192);
            targetView = target.dataView || (target.dataView = new DataView(target.buffer, 0, 8192));
            position2 = 0;
          }
          safeEnd = target.length - 10;
          if (safeEnd - position2 < 2048) {
            target = new ByteArrayAllocate(target.length);
            targetView = target.dataView || (target.dataView = new DataView(target.buffer, 0, target.length));
            safeEnd = target.length - 10;
            position2 = 0;
          } else
            position2 = position2 + 7 & 2147483640;
          start = position2;
          if (encodeOptions & RESERVE_START_SPACE)
            position2 += encodeOptions & 255;
          referenceMap2 = packr.structuredClone ? /* @__PURE__ */ new Map() : null;
          if (packr.bundleStrings && typeof value !== "string") {
            bundledStrings2 = [];
            bundledStrings2.size = Infinity;
          } else
            bundledStrings2 = null;
          structures = packr.structures;
          if (structures) {
            if (structures.uninitialized)
              structures = packr._mergeStructures(packr.getStructures());
            let sharedLength = structures.sharedLength || 0;
            if (sharedLength > maxSharedStructures) {
              throw new Error("Shared structures is larger than maximum shared structures, try increasing maxSharedStructures to " + structures.sharedLength);
            }
            if (!structures.transitions) {
              structures.transitions = /* @__PURE__ */ Object.create(null);
              for (let i = 0; i < sharedLength; i++) {
                let keys = structures[i];
                if (!keys)
                  continue;
                let nextTransition, transition = structures.transitions;
                for (let j = 0, l = keys.length; j < l; j++) {
                  let key = keys[j];
                  nextTransition = transition[key];
                  if (!nextTransition) {
                    nextTransition = transition[key] = /* @__PURE__ */ Object.create(null);
                  }
                  transition = nextTransition;
                }
                transition[RECORD_SYMBOL] = i + 64;
              }
              this.lastNamedStructuresLength = sharedLength;
            }
            if (!isSequential) {
              structures.nextId = sharedLength + 64;
            }
          }
          if (hasSharedUpdate)
            hasSharedUpdate = false;
          let encodingError;
          try {
            if (packr.randomAccessStructure && value && value.constructor && value.constructor === Object)
              writeStruct(value);
            else
              pack2(value);
            let lastBundle = bundledStrings2;
            if (bundledStrings2)
              writeBundles(start, pack2, 0);
            if (referenceMap2 && referenceMap2.idsToInsert) {
              let idsToInsert = referenceMap2.idsToInsert.sort((a, b) => a.offset > b.offset ? 1 : -1);
              let i = idsToInsert.length;
              let incrementPosition = -1;
              while (lastBundle && i > 0) {
                let insertionPoint = idsToInsert[--i].offset + start;
                if (insertionPoint < lastBundle.stringsPosition + start && incrementPosition === -1)
                  incrementPosition = 0;
                if (insertionPoint > lastBundle.position + start) {
                  if (incrementPosition >= 0)
                    incrementPosition += 6;
                } else {
                  if (incrementPosition >= 0) {
                    targetView.setUint32(
                      lastBundle.position + start,
                      targetView.getUint32(lastBundle.position + start) + incrementPosition
                    );
                    incrementPosition = -1;
                  }
                  lastBundle = lastBundle.previous;
                  i++;
                }
              }
              if (incrementPosition >= 0 && lastBundle) {
                targetView.setUint32(
                  lastBundle.position + start,
                  targetView.getUint32(lastBundle.position + start) + incrementPosition
                );
              }
              position2 += idsToInsert.length * 6;
              if (position2 > safeEnd)
                makeRoom(position2);
              packr.offset = position2;
              let serialized = insertIds(target.subarray(start, position2), idsToInsert);
              referenceMap2 = null;
              return serialized;
            }
            packr.offset = position2;
            if (encodeOptions & REUSE_BUFFER_MODE) {
              target.start = start;
              target.end = position2;
              return target;
            }
            return target.subarray(start, position2);
          } catch (error) {
            encodingError = error;
            throw error;
          } finally {
            if (structures) {
              resetStructures();
              if (hasSharedUpdate && packr.saveStructures) {
                let sharedLength = structures.sharedLength || 0;
                let returnBuffer = target.subarray(start, position2);
                let newSharedData = prepareStructures(structures, packr);
                if (!encodingError) {
                  if (packr.saveStructures(newSharedData, newSharedData.isCompatible) === false) {
                    return packr.pack(value, encodeOptions);
                  }
                  packr.lastNamedStructuresLength = sharedLength;
                  if (target.length > 1073741824)
                    target = null;
                  return returnBuffer;
                }
              }
            }
            if (target.length > 1073741824)
              target = null;
            if (encodeOptions & RESET_BUFFER_MODE)
              position2 = start;
          }
        };
        const resetStructures = /* @__PURE__ */ __name(() => {
          if (serializationsSinceTransitionRebuild < 10)
            serializationsSinceTransitionRebuild++;
          let sharedLength = structures.sharedLength || 0;
          if (structures.length > sharedLength && !isSequential)
            structures.length = sharedLength;
          if (transitionsCount > 1e4) {
            structures.transitions = null;
            serializationsSinceTransitionRebuild = 0;
            transitionsCount = 0;
            if (recordIdsToRemove.length > 0)
              recordIdsToRemove = [];
          } else if (recordIdsToRemove.length > 0 && !isSequential) {
            for (let i = 0, l = recordIdsToRemove.length; i < l; i++) {
              recordIdsToRemove[i][RECORD_SYMBOL] = 0;
            }
            recordIdsToRemove = [];
          }
        }, "resetStructures");
        const packArray = /* @__PURE__ */ __name((value) => {
          var length = value.length;
          if (length < 16) {
            target[position2++] = 144 | length;
          } else if (length < 65536) {
            target[position2++] = 220;
            target[position2++] = length >> 8;
            target[position2++] = length & 255;
          } else {
            target[position2++] = 221;
            targetView.setUint32(position2, length);
            position2 += 4;
          }
          for (let i = 0; i < length; i++) {
            pack2(value[i]);
          }
        }, "packArray");
        const pack2 = /* @__PURE__ */ __name((value) => {
          if (position2 > safeEnd)
            target = makeRoom(position2);
          var type = typeof value;
          var length;
          if (type === "string") {
            let strLength = value.length;
            if (bundledStrings2 && strLength >= 4 && strLength < 4096) {
              if ((bundledStrings2.size += strLength) > MAX_BUNDLE_SIZE) {
                let extStart;
                let maxBytes2 = (bundledStrings2[0] ? bundledStrings2[0].length * 3 + bundledStrings2[1].length : 0) + 10;
                if (position2 + maxBytes2 > safeEnd)
                  target = makeRoom(position2 + maxBytes2);
                let lastBundle;
                if (bundledStrings2.position) {
                  lastBundle = bundledStrings2;
                  target[position2] = 200;
                  position2 += 3;
                  target[position2++] = 98;
                  extStart = position2 - start;
                  position2 += 4;
                  writeBundles(start, pack2, 0);
                  targetView.setUint16(extStart + start - 3, position2 - start - extStart);
                } else {
                  target[position2++] = 214;
                  target[position2++] = 98;
                  extStart = position2 - start;
                  position2 += 4;
                }
                bundledStrings2 = ["", ""];
                bundledStrings2.previous = lastBundle;
                bundledStrings2.size = 0;
                bundledStrings2.position = extStart;
              }
              let twoByte = hasNonLatin.test(value);
              bundledStrings2[twoByte ? 0 : 1] += value;
              target[position2++] = 193;
              pack2(twoByte ? -strLength : strLength);
              return;
            }
            let headerSize;
            if (strLength < 32) {
              headerSize = 1;
            } else if (strLength < 256) {
              headerSize = 2;
            } else if (strLength < 65536) {
              headerSize = 3;
            } else {
              headerSize = 5;
            }
            let maxBytes = strLength * 3;
            if (position2 + maxBytes > safeEnd)
              target = makeRoom(position2 + maxBytes);
            if (strLength < 64 || !encodeUtf8) {
              let i, c1, c2, strPosition = position2 + headerSize;
              for (i = 0; i < strLength; i++) {
                c1 = value.charCodeAt(i);
                if (c1 < 128) {
                  target[strPosition++] = c1;
                } else if (c1 < 2048) {
                  target[strPosition++] = c1 >> 6 | 192;
                  target[strPosition++] = c1 & 63 | 128;
                } else if ((c1 & 64512) === 55296 && ((c2 = value.charCodeAt(i + 1)) & 64512) === 56320) {
                  c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
                  i++;
                  target[strPosition++] = c1 >> 18 | 240;
                  target[strPosition++] = c1 >> 12 & 63 | 128;
                  target[strPosition++] = c1 >> 6 & 63 | 128;
                  target[strPosition++] = c1 & 63 | 128;
                } else {
                  target[strPosition++] = c1 >> 12 | 224;
                  target[strPosition++] = c1 >> 6 & 63 | 128;
                  target[strPosition++] = c1 & 63 | 128;
                }
              }
              length = strPosition - position2 - headerSize;
            } else {
              length = encodeUtf8(value, position2 + headerSize);
            }
            if (length < 32) {
              target[position2++] = 160 | length;
            } else if (length < 256) {
              if (headerSize < 2) {
                target.copyWithin(position2 + 2, position2 + 1, position2 + 1 + length);
              }
              target[position2++] = 217;
              target[position2++] = length;
            } else if (length < 65536) {
              if (headerSize < 3) {
                target.copyWithin(position2 + 3, position2 + 2, position2 + 2 + length);
              }
              target[position2++] = 218;
              target[position2++] = length >> 8;
              target[position2++] = length & 255;
            } else {
              if (headerSize < 5) {
                target.copyWithin(position2 + 5, position2 + 3, position2 + 3 + length);
              }
              target[position2++] = 219;
              targetView.setUint32(position2, length);
              position2 += 4;
            }
            position2 += length;
          } else if (type === "number") {
            if (value >>> 0 === value) {
              if (value < 32 || value < 128 && this.useRecords === false || value < 64 && !this.randomAccessStructure) {
                target[position2++] = value;
              } else if (value < 256) {
                target[position2++] = 204;
                target[position2++] = value;
              } else if (value < 65536) {
                target[position2++] = 205;
                target[position2++] = value >> 8;
                target[position2++] = value & 255;
              } else {
                target[position2++] = 206;
                targetView.setUint32(position2, value);
                position2 += 4;
              }
            } else if (value >> 0 === value) {
              if (value >= -32) {
                target[position2++] = 256 + value;
              } else if (value >= -128) {
                target[position2++] = 208;
                target[position2++] = value + 256;
              } else if (value >= -32768) {
                target[position2++] = 209;
                targetView.setInt16(position2, value);
                position2 += 2;
              } else {
                target[position2++] = 210;
                targetView.setInt32(position2, value);
                position2 += 4;
              }
            } else {
              let useFloat32;
              if ((useFloat32 = this.useFloat32) > 0 && value < 4294967296 && value >= -2147483648) {
                target[position2++] = 202;
                targetView.setFloat32(position2, value);
                let xShifted;
                if (useFloat32 < 4 || // this checks for rounding of numbers that were encoded in 32-bit float to nearest significant decimal digit that could be preserved
                (xShifted = value * mult10[(target[position2] & 127) << 1 | target[position2 + 1] >> 7]) >> 0 === xShifted) {
                  position2 += 4;
                  return;
                } else
                  position2--;
              }
              target[position2++] = 203;
              targetView.setFloat64(position2, value);
              position2 += 8;
            }
          } else if (type === "object" || type === "function") {
            if (!value)
              target[position2++] = 192;
            else {
              if (referenceMap2) {
                let referee = referenceMap2.get(value);
                if (referee) {
                  if (!referee.id) {
                    let idsToInsert = referenceMap2.idsToInsert || (referenceMap2.idsToInsert = []);
                    referee.id = idsToInsert.push(referee);
                  }
                  target[position2++] = 214;
                  target[position2++] = 112;
                  targetView.setUint32(position2, referee.id);
                  position2 += 4;
                  return;
                } else
                  referenceMap2.set(value, { offset: position2 - start });
              }
              let constructor = value.constructor;
              if (constructor === Object) {
                writeObject(value);
              } else if (constructor === Array) {
                packArray(value);
              } else if (constructor === Map) {
                if (this.mapAsEmptyObject)
                  target[position2++] = 128;
                else {
                  length = value.size;
                  if (length < 16) {
                    target[position2++] = 128 | length;
                  } else if (length < 65536) {
                    target[position2++] = 222;
                    target[position2++] = length >> 8;
                    target[position2++] = length & 255;
                  } else {
                    target[position2++] = 223;
                    targetView.setUint32(position2, length);
                    position2 += 4;
                  }
                  for (let [key, entryValue] of value) {
                    pack2(key);
                    pack2(entryValue);
                  }
                }
              } else {
                for (let i = 0, l = extensions.length; i < l; i++) {
                  let extensionClass = extensionClasses[i];
                  if (value instanceof extensionClass) {
                    let extension = extensions[i];
                    if (extension.write) {
                      if (extension.type) {
                        target[position2++] = 212;
                        target[position2++] = extension.type;
                        target[position2++] = 0;
                      }
                      let writeResult = extension.write.call(this, value);
                      if (writeResult === value) {
                        if (Array.isArray(value)) {
                          packArray(value);
                        } else {
                          writeObject(value);
                        }
                      } else {
                        pack2(writeResult);
                      }
                      return;
                    }
                    let currentTarget = target;
                    let currentTargetView = targetView;
                    let currentPosition = position2;
                    target = null;
                    let result;
                    try {
                      result = extension.pack.call(this, value, (size) => {
                        target = currentTarget;
                        currentTarget = null;
                        position2 += size;
                        if (position2 > safeEnd)
                          makeRoom(position2);
                        return {
                          target,
                          targetView,
                          position: position2 - size
                        };
                      }, pack2);
                    } finally {
                      if (currentTarget) {
                        target = currentTarget;
                        targetView = currentTargetView;
                        position2 = currentPosition;
                        safeEnd = target.length - 10;
                      }
                    }
                    if (result) {
                      if (result.length + position2 > safeEnd)
                        makeRoom(result.length + position2);
                      position2 = writeExtensionData(result, target, position2, extension.type);
                    }
                    return;
                  }
                }
                if (Array.isArray(value)) {
                  packArray(value);
                } else {
                  if (value.toJSON) {
                    const json = value.toJSON();
                    if (json !== value)
                      return pack2(json);
                  }
                  if (type === "function")
                    return pack2(this.writeFunction && this.writeFunction(value));
                  writeObject(value);
                }
              }
            }
          } else if (type === "boolean") {
            target[position2++] = value ? 195 : 194;
          } else if (type === "bigint") {
            if (value < 9223372036854776e3 && value >= -9223372036854776e3) {
              target[position2++] = 211;
              targetView.setBigInt64(position2, value);
            } else if (value < 18446744073709552e3 && value > 0) {
              target[position2++] = 207;
              targetView.setBigUint64(position2, value);
            } else {
              if (this.largeBigIntToFloat) {
                target[position2++] = 203;
                targetView.setFloat64(position2, Number(value));
              } else if (this.largeBigIntToString) {
                return pack2(value.toString());
              } else if (this.useBigIntExtension || this.moreTypes) {
                let empty = value < 0 ? BigInt(-1) : BigInt(0);
                let array;
                if (value >> BigInt(65536) === empty) {
                  let mask = BigInt(18446744073709552e3) - BigInt(1);
                  let chunks = [];
                  while (true) {
                    chunks.push(value & mask);
                    if (value >> BigInt(63) === empty)
                      break;
                    value >>= BigInt(64);
                  }
                  array = new Uint8Array(new BigUint64Array(chunks).buffer);
                  array.reverse();
                } else {
                  let invert2 = value < 0;
                  let string = (invert2 ? ~value : value).toString(16);
                  if (string.length % 2) {
                    string = "0" + string;
                  } else if (parseInt(string.charAt(0), 16) >= 8) {
                    string = "00" + string;
                  }
                  if (hasNodeBuffer) {
                    array = Buffer.from(string, "hex");
                  } else {
                    array = new Uint8Array(string.length / 2);
                    for (let i = 0; i < array.length; i++) {
                      array[i] = parseInt(string.slice(i * 2, i * 2 + 2), 16);
                    }
                  }
                  if (invert2) {
                    for (let i = 0; i < array.length; i++)
                      array[i] = ~array[i];
                  }
                }
                if (array.length + position2 > safeEnd)
                  makeRoom(array.length + position2);
                position2 = writeExtensionData(array, target, position2, 66);
                return;
              } else {
                throw new RangeError(value + " was too large to fit in MessagePack 64-bit integer format, use useBigIntExtension, or set largeBigIntToFloat to convert to float-64, or set largeBigIntToString to convert to string");
              }
            }
            position2 += 8;
          } else if (type === "undefined") {
            if (this.encodeUndefinedAsNil)
              target[position2++] = 192;
            else {
              target[position2++] = 212;
              target[position2++] = 0;
              target[position2++] = 0;
            }
          } else {
            throw new Error("Unknown type: " + type);
          }
        }, "pack");
        const writePlainObject = this.variableMapSize || this.coercibleKeyAsNumber || this.skipValues ? (object) => {
          let keys;
          if (this.skipValues) {
            keys = [];
            for (let key2 in object) {
              if ((typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key2)) && !this.skipValues.includes(object[key2]))
                keys.push(key2);
            }
          } else {
            keys = Object.keys(object);
          }
          let length = keys.length;
          if (length < 16) {
            target[position2++] = 128 | length;
          } else if (length < 65536) {
            target[position2++] = 222;
            target[position2++] = length >> 8;
            target[position2++] = length & 255;
          } else {
            target[position2++] = 223;
            targetView.setUint32(position2, length);
            position2 += 4;
          }
          let key;
          if (this.coercibleKeyAsNumber) {
            for (let i = 0; i < length; i++) {
              key = keys[i];
              let num2 = Number(key);
              pack2(isNaN(num2) ? key : num2);
              pack2(object[key]);
            }
          } else {
            for (let i = 0; i < length; i++) {
              pack2(key = keys[i]);
              pack2(object[key]);
            }
          }
        } : (object) => {
          target[position2++] = 222;
          let objectOffset = position2 - start;
          position2 += 2;
          let size = 0;
          for (let key in object) {
            if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key)) {
              pack2(key);
              pack2(object[key]);
              size++;
            }
          }
          if (size > 65535) {
            throw new Error('Object is too large to serialize with fast 16-bit map size, use the "variableMapSize" option to serialize this object');
          }
          target[objectOffset++ + start] = size >> 8;
          target[objectOffset + start] = size & 255;
        };
        const writeRecord = this.useRecords === false ? writePlainObject : options.progressiveRecords && !useTwoByteRecords ? (
          // this is about 2% faster for highly stable structures, since it only requires one for-in loop (but much more expensive when new structure needs to be written)
          (object) => {
            let nextTransition, transition = structures.transitions || (structures.transitions = /* @__PURE__ */ Object.create(null));
            let objectOffset = position2++ - start;
            let wroteKeys;
            for (let key in object) {
              if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key)) {
                nextTransition = transition[key];
                if (nextTransition)
                  transition = nextTransition;
                else {
                  let keys = Object.keys(object);
                  let lastTransition = transition;
                  transition = structures.transitions;
                  let newTransitions = 0;
                  for (let i = 0, l = keys.length; i < l; i++) {
                    let key2 = keys[i];
                    nextTransition = transition[key2];
                    if (!nextTransition) {
                      nextTransition = transition[key2] = /* @__PURE__ */ Object.create(null);
                      newTransitions++;
                    }
                    transition = nextTransition;
                  }
                  if (objectOffset + start + 1 == position2) {
                    position2--;
                    newRecord(transition, keys, newTransitions);
                  } else
                    insertNewRecord(transition, keys, objectOffset, newTransitions);
                  wroteKeys = true;
                  transition = lastTransition[key];
                }
                pack2(object[key]);
              }
            }
            if (!wroteKeys) {
              let recordId = transition[RECORD_SYMBOL];
              if (recordId)
                target[objectOffset + start] = recordId;
              else
                insertNewRecord(transition, Object.keys(object), objectOffset, 0);
            }
          }
        ) : (object) => {
          let nextTransition, transition = structures.transitions || (structures.transitions = /* @__PURE__ */ Object.create(null));
          let newTransitions = 0;
          for (let key in object)
            if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key)) {
              nextTransition = transition[key];
              if (!nextTransition) {
                nextTransition = transition[key] = /* @__PURE__ */ Object.create(null);
                newTransitions++;
              }
              transition = nextTransition;
            }
          let recordId = transition[RECORD_SYMBOL];
          if (recordId) {
            if (recordId >= 96 && useTwoByteRecords) {
              target[position2++] = ((recordId -= 96) & 31) + 96;
              target[position2++] = recordId >> 5;
            } else
              target[position2++] = recordId;
          } else {
            newRecord(transition, transition.__keys__ || Object.keys(object), newTransitions);
          }
          for (let key in object)
            if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key)) {
              pack2(object[key]);
            }
        };
        const checkUseRecords = typeof this.useRecords == "function" && this.useRecords;
        const writeObject = checkUseRecords ? (object) => {
          checkUseRecords(object) ? writeRecord(object) : writePlainObject(object);
        } : writeRecord;
        const makeRoom = /* @__PURE__ */ __name((end) => {
          let newSize;
          if (end > 16777216) {
            if (end - start > MAX_BUFFER_SIZE)
              throw new Error("Packed buffer would be larger than maximum buffer size");
            newSize = Math.min(
              MAX_BUFFER_SIZE,
              Math.round(Math.max((end - start) * (end > 67108864 ? 1.25 : 2), 4194304) / 4096) * 4096
            );
          } else
            newSize = (Math.max(end - start << 2, target.length - 1) >> 12) + 1 << 12;
          let newBuffer = new ByteArrayAllocate(newSize);
          targetView = newBuffer.dataView || (newBuffer.dataView = new DataView(newBuffer.buffer, 0, newSize));
          end = Math.min(end, target.length);
          if (target.copy)
            target.copy(newBuffer, 0, start, end);
          else
            newBuffer.set(target.slice(start, end));
          position2 -= start;
          start = 0;
          safeEnd = newBuffer.length - 10;
          return target = newBuffer;
        }, "makeRoom");
        const newRecord = /* @__PURE__ */ __name((transition, keys, newTransitions) => {
          let recordId = structures.nextId;
          if (!recordId)
            recordId = 64;
          if (recordId < sharedLimitId && this.shouldShareStructure && !this.shouldShareStructure(keys)) {
            recordId = structures.nextOwnId;
            if (!(recordId < maxStructureId))
              recordId = sharedLimitId;
            structures.nextOwnId = recordId + 1;
          } else {
            if (recordId >= maxStructureId)
              recordId = sharedLimitId;
            structures.nextId = recordId + 1;
          }
          let highByte = keys.highByte = recordId >= 96 && useTwoByteRecords ? recordId - 96 >> 5 : -1;
          transition[RECORD_SYMBOL] = recordId;
          transition.__keys__ = keys;
          structures[recordId - 64] = keys;
          if (recordId < sharedLimitId) {
            keys.isShared = true;
            structures.sharedLength = recordId - 63;
            hasSharedUpdate = true;
            if (highByte >= 0) {
              target[position2++] = (recordId & 31) + 96;
              target[position2++] = highByte;
            } else {
              target[position2++] = recordId;
            }
          } else {
            if (highByte >= 0) {
              target[position2++] = 213;
              target[position2++] = 114;
              target[position2++] = (recordId & 31) + 96;
              target[position2++] = highByte;
            } else {
              target[position2++] = 212;
              target[position2++] = 114;
              target[position2++] = recordId;
            }
            if (newTransitions)
              transitionsCount += serializationsSinceTransitionRebuild * newTransitions;
            if (recordIdsToRemove.length >= maxOwnStructures)
              recordIdsToRemove.shift()[RECORD_SYMBOL] = 0;
            recordIdsToRemove.push(transition);
            pack2(keys);
          }
        }, "newRecord");
        const insertNewRecord = /* @__PURE__ */ __name((transition, keys, insertionOffset, newTransitions) => {
          let mainTarget = target;
          let mainPosition = position2;
          let mainSafeEnd = safeEnd;
          let mainStart = start;
          target = keysTarget;
          position2 = 0;
          start = 0;
          if (!target)
            keysTarget = target = new ByteArrayAllocate(8192);
          safeEnd = target.length - 10;
          newRecord(transition, keys, newTransitions);
          keysTarget = target;
          let keysPosition = position2;
          target = mainTarget;
          position2 = mainPosition;
          safeEnd = mainSafeEnd;
          start = mainStart;
          if (keysPosition > 1) {
            let newEnd = position2 + keysPosition - 1;
            if (newEnd > safeEnd)
              makeRoom(newEnd);
            let insertionPosition = insertionOffset + start;
            target.copyWithin(insertionPosition + keysPosition, insertionPosition + 1, position2);
            target.set(keysTarget.slice(0, keysPosition), insertionPosition);
            position2 = newEnd;
          } else {
            target[insertionOffset + start] = keysTarget[0];
          }
        }, "insertNewRecord");
        const writeStruct = /* @__PURE__ */ __name((object) => {
          let newPosition = writeStructSlots(object, target, start, position2, structures, makeRoom, (value, newPosition2, notifySharedUpdate) => {
            if (notifySharedUpdate)
              return hasSharedUpdate = true;
            position2 = newPosition2;
            let startTarget = target;
            pack2(value);
            resetStructures();
            if (startTarget !== target) {
              return { position: position2, targetView, target };
            }
            return position2;
          }, this);
          if (newPosition === 0)
            return writeObject(object);
          position2 = newPosition;
        }, "writeStruct");
      }
      useBuffer(buffer) {
        target = buffer;
        target.dataView || (target.dataView = new DataView(target.buffer, target.byteOffset, target.byteLength));
        targetView = target.dataView;
        position2 = 0;
      }
      set position(value) {
        position2 = value;
      }
      get position() {
        return position2;
      }
      clearSharedData() {
        if (this.structures)
          this.structures = [];
        if (this.typedStructs)
          this.typedStructs = [];
      }
    };
    __name(_Packr, "Packr");
    Packr = _Packr;
    extensionClasses = [Date, Set, Error, RegExp, ArrayBuffer, Object.getPrototypeOf(Uint8Array.prototype).constructor, DataView, C1Type];
    extensions = [{
      pack(date, allocateForWrite, pack2) {
        let seconds = date.getTime() / 1e3;
        if ((this.useTimestamp32 || date.getMilliseconds() === 0) && seconds >= 0 && seconds < 4294967296) {
          let { target: target2, targetView: targetView2, position: position3 } = allocateForWrite(6);
          target2[position3++] = 214;
          target2[position3++] = 255;
          targetView2.setUint32(position3, seconds);
        } else if (seconds > 0 && seconds < 4294967296) {
          let { target: target2, targetView: targetView2, position: position3 } = allocateForWrite(10);
          target2[position3++] = 215;
          target2[position3++] = 255;
          targetView2.setUint32(position3, date.getMilliseconds() * 4e6 + (seconds / 1e3 / 4294967296 >> 0));
          targetView2.setUint32(position3 + 4, seconds);
        } else if (isNaN(seconds)) {
          if (this.onInvalidDate) {
            allocateForWrite(0);
            return pack2(this.onInvalidDate());
          }
          let { target: target2, targetView: targetView2, position: position3 } = allocateForWrite(3);
          target2[position3++] = 212;
          target2[position3++] = 255;
          target2[position3++] = 255;
        } else {
          let { target: target2, targetView: targetView2, position: position3 } = allocateForWrite(15);
          target2[position3++] = 199;
          target2[position3++] = 12;
          target2[position3++] = 255;
          targetView2.setUint32(position3, date.getMilliseconds() * 1e6);
          targetView2.setBigInt64(position3 + 4, BigInt(Math.floor(seconds)));
        }
      }
    }, {
      pack(set, allocateForWrite, pack2) {
        if (this.setAsEmptyObject) {
          allocateForWrite(0);
          return pack2({});
        }
        let array = Array.from(set);
        let { target: target2, position: position3 } = allocateForWrite(this.moreTypes ? 3 : 0);
        if (this.moreTypes) {
          target2[position3++] = 212;
          target2[position3++] = 115;
          target2[position3++] = 0;
        }
        pack2(array);
      }
    }, {
      pack(error, allocateForWrite, pack2) {
        let { target: target2, position: position3 } = allocateForWrite(this.moreTypes ? 3 : 0);
        if (this.moreTypes) {
          target2[position3++] = 212;
          target2[position3++] = 101;
          target2[position3++] = 0;
        }
        pack2([error.name, error.message, error.cause]);
      }
    }, {
      pack(regex, allocateForWrite, pack2) {
        let { target: target2, position: position3 } = allocateForWrite(this.moreTypes ? 3 : 0);
        if (this.moreTypes) {
          target2[position3++] = 212;
          target2[position3++] = 120;
          target2[position3++] = 0;
        }
        pack2([regex.source, regex.flags]);
      }
    }, {
      pack(arrayBuffer, allocateForWrite) {
        if (this.moreTypes)
          writeExtBuffer(arrayBuffer, 16, allocateForWrite);
        else
          writeBuffer(hasNodeBuffer ? Buffer.from(arrayBuffer) : new Uint8Array(arrayBuffer), allocateForWrite);
      }
    }, {
      pack(typedArray, allocateForWrite) {
        let constructor = typedArray.constructor;
        if (constructor !== ByteArray && this.moreTypes)
          writeExtBuffer(typedArray, typedArrays.indexOf(constructor.name), allocateForWrite);
        else
          writeBuffer(typedArray, allocateForWrite);
      }
    }, {
      pack(arrayBuffer, allocateForWrite) {
        if (this.moreTypes)
          writeExtBuffer(arrayBuffer, 17, allocateForWrite);
        else
          writeBuffer(hasNodeBuffer ? Buffer.from(arrayBuffer) : new Uint8Array(arrayBuffer), allocateForWrite);
      }
    }, {
      pack(c1, allocateForWrite) {
        let { target: target2, position: position3 } = allocateForWrite(1);
        target2[position3] = 193;
      }
    }];
    __name(writeExtBuffer, "writeExtBuffer");
    __name(writeBuffer, "writeBuffer");
    __name(writeExtensionData, "writeExtensionData");
    __name(insertIds, "insertIds");
    __name(writeBundles, "writeBundles");
    __name(prepareStructures, "prepareStructures");
    defaultPackr = new Packr({ useRecords: false });
    pack = defaultPackr.pack;
    encode = defaultPackr.pack;
    ({ NEVER, ALWAYS, DECIMAL_ROUND, DECIMAL_FIT } = FLOAT32_OPTIONS);
    REUSE_BUFFER_MODE = 512;
    RESET_BUFFER_MODE = 1024;
    RESERVE_START_SPACE = 2048;
  }
});

// node_modules/msgpackr/iterators.js
var init_iterators = __esm({
  "node_modules/msgpackr/iterators.js"() {
    init_pack();
    init_unpack();
  }
});

// node_modules/msgpackr/index.js
var init_msgpackr = __esm({
  "node_modules/msgpackr/index.js"() {
    init_pack();
    init_unpack();
    init_iterators();
  }
});

// src/config.ts
var config_exports = {};
__export(config_exports, {
  AUTH_REQUIRED: () => AUTH_REQUIRED,
  CONNECTION_DO_SHARDING_ENABLED: () => CONNECTION_DO_SHARDING_ENABLED,
  CREATED_AT_LOWER_LIMIT: () => CREATED_AT_LOWER_LIMIT,
  CREATED_AT_UPPER_LIMIT: () => CREATED_AT_UPPER_LIMIT,
  MAX_TIME_WINDOWS_PER_QUERY: () => MAX_TIME_WINDOWS_PER_QUERY,
  PAYMENT_DO_SHARDING_ENABLED: () => PAYMENT_DO_SHARDING_ENABLED,
  PAY_TO_RELAY_ENABLED: () => PAY_TO_RELAY_ENABLED,
  PUBKEY_RATE_LIMIT: () => PUBKEY_RATE_LIMIT,
  READ_REPLICAS_PER_SHARD: () => READ_REPLICAS_PER_SHARD,
  RELAY_ACCESS_PRICE_SATS: () => RELAY_ACCESS_PRICE_SATS,
  REQ_RATE_LIMIT: () => REQ_RATE_LIMIT,
  SESSION_MANAGER_SHARD_COUNT: () => SESSION_MANAGER_SHARD_COUNT,
  allowedEventKinds: () => allowedEventKinds,
  allowedNip05Domains: () => allowedNip05Domains,
  allowedPubkeys: () => allowedPubkeys,
  allowedTags: () => allowedTags,
  blockedContent: () => blockedContent,
  blockedEventKinds: () => blockedEventKinds,
  blockedNip05Domains: () => blockedNip05Domains,
  blockedPubkeys: () => blockedPubkeys,
  blockedTags: () => blockedTags,
  checkValidNip05: () => checkValidNip05,
  containsBlockedContent: () => containsBlockedContent,
  excludedRateLimitKinds: () => excludedRateLimitKinds,
  isEventKindAllowed: () => isEventKindAllowed,
  isPubkeyAllowed: () => isPubkeyAllowed,
  isTagAllowed: () => isTagAllowed,
  nip05Users: () => nip05Users,
  relayInfo: () => relayInfo,
  relayNpub: () => relayNpub
});
function isPubkeyAllowed(pubkey) {
  if (allowedPubkeys.size > 0 && !allowedPubkeys.has(pubkey)) {
    return false;
  }
  return !blockedPubkeys.has(pubkey);
}
function isEventKindAllowed(kind) {
  if (allowedEventKinds.size > 0 && !allowedEventKinds.has(kind)) {
    return false;
  }
  return !blockedEventKinds.has(kind);
}
function containsBlockedContent(event) {
  const lowercaseContent = (event.content || "").toLowerCase();
  const lowercaseTags = event.tags.map((tag) => tag.join("").toLowerCase());
  for (const blocked of blockedContent) {
    const blockedLower = blocked.toLowerCase();
    if (lowercaseContent.includes(blockedLower) || lowercaseTags.some((tag) => tag.includes(blockedLower))) {
      return true;
    }
  }
  return false;
}
function isTagAllowed(tag) {
  if (allowedTags.size > 0 && !allowedTags.has(tag)) {
    return false;
  }
  return !blockedTags.has(tag);
}
var relayNpub, PAY_TO_RELAY_ENABLED, RELAY_ACCESS_PRICE_SATS, relayInfo, nip05Users, blockedPubkeys, allowedPubkeys, blockedEventKinds, allowedEventKinds, blockedContent, checkValidNip05, blockedNip05Domains, allowedNip05Domains, blockedTags, allowedTags, CONNECTION_DO_SHARDING_ENABLED, SESSION_MANAGER_SHARD_COUNT, MAX_TIME_WINDOWS_PER_QUERY, READ_REPLICAS_PER_SHARD, PAYMENT_DO_SHARDING_ENABLED, PUBKEY_RATE_LIMIT, REQ_RATE_LIMIT, excludedRateLimitKinds, CREATED_AT_LOWER_LIMIT, CREATED_AT_UPPER_LIMIT, AUTH_REQUIRED;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    relayNpub = "npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv";
    PAY_TO_RELAY_ENABLED = true;
    RELAY_ACCESS_PRICE_SATS = 212121;
    relayInfo = {
      name: "Nosflare",
      description: "A serverless Nostr relay using Cloudflare Workers and Durable Objects",
      pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
      contact: "lux@fed.wtf",
      supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 23, 33, 40, 42, 50, 51, 58, 65, 71, 78, 89, 94],
      software: "https://github.com/Spl0itable/nosflare",
      version: "8.9.25",
      icon: "https://raw.githubusercontent.com/Spl0itable/nosflare/main/images/flare.png",
      // Optional fields (uncomment as needed):
      // banner: "https://example.com/banner.jpg",
      // privacy_policy: "https://example.com/privacy-policy.html",
      // terms_of_service: "https://example.com/terms.html",
      // Relay limitations
      limitation: {
        // max_message_length: 524288, // 512KB
        // max_subscriptions: 300,
        // max_limit: 10000,
        // max_subid_length: 256,
        // max_event_tags: 2000,
        // max_content_length: 70000,
        // min_pow_difficulty: 0,
        auth_required: false,
        // Set to true to enable NIP-42 authentication
        payment_required: PAY_TO_RELAY_ENABLED,
        restricted_writes: PAY_TO_RELAY_ENABLED,
        created_at_lower_limit: 946684800,
        // January 1, 2000
        created_at_upper_limit: 2147483647
        // Max unix timestamp (year 2038)
        // default_limit: 10000
      }
      // Event retention policies (uncomment and configure as needed):
      // retention: [
      //   { kinds: [0, 1, [5, 7], [40, 49]], time: 3600 },
      //   { kinds: [[40000, 49999]], time: 100 },
      //   { kinds: [[30000, 39999]], count: 1000 },
      //   { time: 3600, count: 10000 }
      // ],
      // Content limitations by country (uncomment as needed):
      // relay_countries: ["*"], // Use ["US", "CA", "EU"] for specific countries, ["*"] for global
      // Community preferences (uncomment as needed):
      // language_tags: ["en", "en-419"], // IETF language tags, use ["*"] for all languages
      // tags: ["sfw-only", "bitcoin-only", "anime"], // Community/content tags
      // posting_policy: "https://example.com/posting-policy.html",
      // Payment configuration (added dynamically in handleRelayInfoRequest if PAY_TO_RELAY_ENABLED):
      // payments_url: "https://my-relay/payments",
      // fees: {
      //   admission: [{ amount: 1000000, unit: "msats" }],
      //   subscription: [{ amount: 5000000, unit: "msats", period: 2592000 }],
      //   publication: [{ kinds: [4], amount: 100, unit: "msats" }],
      // }
    };
    nip05Users = {
      "Luxas": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df"
      // ... more NIP-05 verified users
    };
    blockedPubkeys = /* @__PURE__ */ new Set([
      "3c7f5948b5d80900046a67d8e3bf4971d6cba013abece1dd542eca223cf3dd3f",
      "fed5c0c3c8fe8f51629a0b39951acdf040fd40f53a327ae79ee69991176ba058",
      "e810fafa1e89cdf80cced8e013938e87e21b699b24c8570537be92aec4b12c18",
      "05aee96dd41429a3ae97a9dac4dfc6867fdfacebca3f3bdc051e5004b0751f01",
      "53a756bb596055219d93e888f71d936ec6c47d960320476c955efd8941af4362"
    ]);
    allowedPubkeys = /* @__PURE__ */ new Set([
      // ... pubkeys that are explicitly allowed
    ]);
    blockedEventKinds = /* @__PURE__ */ new Set([
      1064
    ]);
    allowedEventKinds = /* @__PURE__ */ new Set([
      // ... kinds that are explicitly allowed
    ]);
    blockedContent = /* @__PURE__ */ new Set([
      "~~ hello world! ~~"
      // ... more blocked content
    ]);
    checkValidNip05 = false;
    blockedNip05Domains = /* @__PURE__ */ new Set([
      // Add domains that are explicitly blocked
      // "primal.net"
    ]);
    allowedNip05Domains = /* @__PURE__ */ new Set([
      // Add domains that are explicitly allowed
      // Leave empty to allow all domains (unless blocked)
    ]);
    blockedTags = /* @__PURE__ */ new Set([
      // ... tags that are explicitly blocked
    ]);
    allowedTags = /* @__PURE__ */ new Set([
      // "p", "e", "t"
      // ... tags that are explicitly allowed
    ]);
    CONNECTION_DO_SHARDING_ENABLED = true;
    SESSION_MANAGER_SHARD_COUNT = 50;
    MAX_TIME_WINDOWS_PER_QUERY = 30;
    READ_REPLICAS_PER_SHARD = 4;
    PAYMENT_DO_SHARDING_ENABLED = true;
    PUBKEY_RATE_LIMIT = { rate: 10 / 6e4, capacity: 10 };
    REQ_RATE_LIMIT = { rate: 100 / 6e4, capacity: 100 };
    excludedRateLimitKinds = /* @__PURE__ */ new Set([
      1059
      // ... kinds to exclude from EVENT rate limiting Ex: 1, 2, 3
    ]);
    CREATED_AT_LOWER_LIMIT = relayInfo.limitation?.created_at_lower_limit ?? 0;
    CREATED_AT_UPPER_LIMIT = relayInfo.limitation?.created_at_upper_limit ?? 2147483647;
    AUTH_REQUIRED = relayInfo.limitation?.auth_required ?? false;
    __name(isPubkeyAllowed, "isPubkeyAllowed");
    __name(isEventKindAllowed, "isEventKindAllowed");
    __name(containsBlockedContent, "containsBlockedContent");
    __name(isTagAllowed, "isTagAllowed");
  }
});

// src/payment-router.ts
var payment_router_exports = {};
__export(payment_router_exports, {
  getPaymentShardId: () => getPaymentShardId,
  hasPaidForRelay: () => hasPaidForRelay,
  recordPayment: () => recordPayment
});
function getPaymentShardId(pubkey) {
  if (!pubkey || pubkey.length < 4) {
    throw new Error("Invalid pubkey for payment sharding");
  }
  if (!PAYMENT_DO_SHARDING_ENABLED) {
    return "payment-main";
  }
  const prefix = pubkey.substring(0, 4).toLowerCase();
  return `payment-${prefix}`;
}
async function hasPaidForRelay(pubkey, env) {
  try {
    const shardId = getPaymentShardId(pubkey);
    const stub = env.PAYMENT_DO.get(env.PAYMENT_DO.idFromName(shardId));
    const response = await stub.fetch("https://internal/check", {
      method: "POST",
      headers: { "Content-Type": "application/msgpack" },
      body: pack({ pubkey })
    });
    if (!response.ok) {
      console.error(`[PaymentRouter] Check failed for ${pubkey}: ${response.status}`);
      return false;
    }
    const result = unpack(new Uint8Array(await response.arrayBuffer()));
    return result.hasPaid;
  } catch (error) {
    console.error(`[PaymentRouter] Error checking payment for ${pubkey}:`, error.message);
    return false;
  }
}
async function recordPayment(pubkey, amountSats, env, expiresAt) {
  try {
    const shardId = getPaymentShardId(pubkey);
    const stub = env.PAYMENT_DO.get(env.PAYMENT_DO.idFromName(shardId));
    const record = {
      pubkey,
      paidAt: Math.floor(Date.now() / 1e3),
      amountSats,
      expiresAt
    };
    const response = await stub.fetch("https://internal/add", {
      method: "POST",
      headers: { "Content-Type": "application/msgpack" },
      body: pack(record)
    });
    if (!response.ok) {
      console.error(`[PaymentRouter] Failed to record payment for ${pubkey}: ${response.status}`);
      return false;
    }
    const result = unpack(new Uint8Array(await response.arrayBuffer()));
    return result.success;
  } catch (error) {
    console.error(`[PaymentRouter] Error recording payment for ${pubkey}:`, error.message);
    return false;
  }
}
var init_payment_router = __esm({
  "src/payment-router.ts"() {
    "use strict";
    init_msgpackr();
    init_config();
    __name(getPaymentShardId, "getPaymentShardId");
    __name(hasPaidForRelay, "hasPaidForRelay");
    __name(recordPayment, "recordPayment");
  }
});

// src/shard-router.ts
var shard_router_exports = {};
__export(shard_router_exports, {
  MAX_QUERY_SHARDS: () => MAX_QUERY_SHARDS,
  SHARD_WINDOW_SECONDS: () => SHARD_WINDOW_SECONDS,
  SUB_SHARDS_PER_TIME_WINDOW: () => SUB_SHARDS_PER_TIME_WINDOW,
  getAllReplicaShardIds: () => getAllReplicaShardIds,
  getAllSubShardsForTimeWindow: () => getAllSubShardsForTimeWindow,
  getBaseShardId: () => getBaseShardId,
  getEventShardId: () => getEventShardId,
  getReplicaShardId: () => getReplicaShardId,
  getShardId: () => getShardId,
  getShardsForFilter: () => getShardsForFilter,
  getTimeRangeShards: () => getTimeRangeShards,
  getTimeShardId: () => getTimeShardId,
  insertEventsIntoShard: () => insertEventsIntoShard,
  queryEventShard: () => queryEventShard,
  queryShards: () => queryShards,
  selectReadReplica: () => selectReadReplica
});
function getTimeShardId(timestamp) {
  const timeWindow = Math.floor(timestamp / SHARD_WINDOW_SECONDS);
  return `shard-${timeWindow}`;
}
function getShardId(timestamp, eventId) {
  const baseShard = getTimeShardId(timestamp);
  if (SUB_SHARDS_PER_TIME_WINDOW === 1) {
    return baseShard;
  }
  if (eventId) {
    const subShardNum = hashString(eventId) % SUB_SHARDS_PER_TIME_WINDOW;
    return `${baseShard}-s${subShardNum}`;
  }
  return `${baseShard}-s0`;
}
function getAllSubShardsForTimeWindow(timestamp) {
  const baseShard = getTimeShardId(timestamp);
  if (SUB_SHARDS_PER_TIME_WINDOW === 1) {
    return [baseShard];
  }
  const subShards = [];
  for (let i = 0; i < SUB_SHARDS_PER_TIME_WINDOW; i++) {
    subShards.push(`${baseShard}-s${i}`);
  }
  return subShards;
}
function getEventShardId(event) {
  return getShardId(event.created_at, event.id);
}
function getBaseShardId(shardId) {
  return shardId.replace(/-r\d+$/, "");
}
function getReplicaShardId(baseShardId, replicaNum) {
  return `${baseShardId}-r${replicaNum}`;
}
function getAllReplicaShardIds(baseShardId) {
  const replicas = [];
  for (let i = 0; i < READ_REPLICAS_PER_SHARD; i++) {
    replicas.push(getReplicaShardId(baseShardId, i));
  }
  return replicas;
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
function selectReadReplica(baseShardId, subscriptionId) {
  if (!subscriptionId) {
    const replicaNum2 = Math.floor(Math.random() * READ_REPLICAS_PER_SHARD);
    return getReplicaShardId(baseShardId, replicaNum2);
  }
  const hash = hashString(subscriptionId);
  const replicaNum = hash % READ_REPLICAS_PER_SHARD;
  return getReplicaShardId(baseShardId, replicaNum);
}
function getTimeRangeShards(since, until, authorPubkey) {
  const timeWindows = [];
  const startWindow = Math.floor(since / SHARD_WINDOW_SECONDS);
  const endWindow = Math.floor(until / SHARD_WINDOW_SECONDS);
  for (let window2 = startWindow; window2 <= endWindow; window2++) {
    timeWindows.push(window2);
  }
  if (timeWindows.length > MAX_TIME_WINDOWS_PER_QUERY) {
    const timeRangeDays = Math.round((until - since) / 86400);
    const returnedDays = Math.round(MAX_TIME_WINDOWS_PER_QUERY * SHARD_WINDOW_SECONDS / 86400);
    console.warn(
      `Query requires ${timeWindows.length} time windows (${timeRangeDays} days), limited to ${MAX_TIME_WINDOWS_PER_QUERY} time windows (${returnedDays} days). Use 'since' parameter to paginate and request additional historical days.`
    );
    timeWindows.splice(0, timeWindows.length - MAX_TIME_WINDOWS_PER_QUERY);
  }
  const shards = [];
  for (const window2 of timeWindows) {
    const windowTimestamp = window2 * SHARD_WINDOW_SECONDS;
    const subShards = getAllSubShardsForTimeWindow(windowTimestamp);
    shards.push(...subShards);
  }
  if (shards.length > MAX_QUERY_SHARDS) {
    const timeRangeDays = Math.round((until - since) / 86400);
    console.error(
      `Query requires ${shards.length} shards (${timeRangeDays} days \xD7 ${SUB_SHARDS_PER_TIME_WINDOW} sub-shards), HARD LIMITED to ${MAX_QUERY_SHARDS} shards to avoid 1000 subrequest limit.`
    );
    return shards.slice(-MAX_QUERY_SHARDS);
  }
  return shards;
}
function getShardsForFilter(filter) {
  const now = Math.floor(Date.now() / 1e3);
  const until = filter.until ?? now;
  const defaultDays = MAX_TIME_WINDOWS_PER_QUERY;
  const since = filter.since ?? until - defaultDays * 24 * 60 * 60;
  const singleAuthor = filter.authors?.length === 1 ? filter.authors[0] : void 0;
  const requestedDays = Math.ceil((until - since) / 86400);
  const maxDays = Math.floor(MAX_QUERY_SHARDS / SUB_SHARDS_PER_TIME_WINDOW);
  if (requestedDays > maxDays) {
    const cappedSince = until - maxDays * 86400;
    console.warn(
      `REQ time range of ${requestedDays} days exceeds ${maxDays} day limit (accounting for ${SUB_SHARDS_PER_TIME_WINDOW} sub-shards per day). Capping to most recent ${maxDays} days to avoid 1000 subrequest limit.`
    );
    return getTimeRangeShards(cappedSince, until, singleAuthor);
  }
  return getTimeRangeShards(since, until, singleAuthor);
}
async function triggerBackfill(env, events, targetReplicaId) {
  try {
    const stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(targetReplicaId));
    const response = await stub.fetch("https://internal/insert", {
      method: "POST",
      headers: { "Content-Type": "application/msgpack" },
      body: pack(events)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = unpack(new Uint8Array(await response.arrayBuffer()));
    console.log(`Backfilled ${result.inserted} events to ${targetReplicaId}`);
  } catch (error) {
    throw new Error(`Backfill to ${targetReplicaId} failed: ${error.message}`);
  }
}
async function queryEventShard(env, shardId, filter, subscriptionId) {
  const emptyResponse = {
    eventIds: [],
    events: [],
    count: 0,
    latencyMs: 0,
    shardInfo: { startTime: 0, endTime: 0, eventCount: 0, isStale: false }
  };
  try {
    const replicaShardId = selectReadReplica(shardId, subscriptionId);
    const stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replicaShardId));
    const shardFilter = transformNostrFilterToShardFormat(filter);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REPLICA_FETCH_TIMEOUT);
    try {
      const startTime = Date.now();
      const response = await stub.fetch("https://internal/query", {
        method: "POST",
        headers: { "Content-Type": "application/msgpack" },
        body: pack(shardFilter),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.error(`Shard ${replicaShardId} query failed: ${response.status}`);
        return emptyResponse;
      }
      const result = unpack(new Uint8Array(await response.arrayBuffer()));
      const latency = Date.now() - startTime;
      if (latency > 5e3) {
        console.warn(`Slow query for ${replicaShardId}: ${latency}ms (returned ${result.eventIds?.length || 0} events)`);
      }
      if (result.eventIds.length === 0 && !replicaShardId.endsWith("-r0")) {
        const replica0Id = getReplicaShardId(shardId, 0);
        const replica0Stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replica0Id));
        try {
          const replica0Response = await replica0Stub.fetch("https://internal/query", {
            method: "POST",
            headers: { "Content-Type": "application/msgpack" },
            body: pack(shardFilter),
            signal: controller.signal
          });
          if (replica0Response.ok) {
            const replica0Result = unpack(new Uint8Array(await replica0Response.arrayBuffer()));
            if (replica0Result.eventIds.length > 0 && replica0Result.events) {
              console.log(`Lazy backfill: ${replicaShardId} empty, found ${replica0Result.eventIds.length} events in ${replica0Id}`);
              triggerBackfill(env, replica0Result.events, replicaShardId).catch(
                (err) => console.error(`Background backfill failed for ${replicaShardId}:`, err.message)
              );
              return replica0Result;
            }
          }
        } catch (error) {
          console.warn(`Replica 0 fallback failed for ${shardId}:`, error.message);
        }
      }
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        console.error(`Shard ${replicaShardId} query timeout after ${REPLICA_FETCH_TIMEOUT}ms (possible cold start or storage bottleneck)`);
      } else {
        throw error;
      }
      return emptyResponse;
    }
  } catch (error) {
    console.error(`Error querying shard ${shardId}:`, error.message);
    return emptyResponse;
  }
}
function transformNostrFilterToShardFormat(filter) {
  const shardFilter = {
    kinds: filter.kinds,
    authors: filter.authors,
    ids: filter.ids,
    since: filter.since,
    until: filter.until,
    limit: filter.limit,
    search: filter.search
  };
  const tags = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith("#") && Array.isArray(value)) {
      const tagType = key.substring(1);
      tags[tagType] = value;
    }
  }
  if (Object.keys(tags).length > 0) {
    shardFilter.tags = tags;
  }
  return shardFilter;
}
async function queryShards(env, filter, subscriptionId) {
  const allShards = getShardsForFilter(filter);
  const queryStartTime = Date.now();
  const requestedLimit = filter.limit ?? 1e3;
  const perShardLimit = Math.min(requestedLimit * 3, 5e3);
  const expandedFilter = { ...filter, limit: perShardLimit };
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  const allEvents = [];
  const shardMapping = /* @__PURE__ */ new Map();
  const shards = [...allShards].reverse();
  const batchSize = requestedLimit <= 10 ? 2 : requestedLimit <= 100 ? 5 : shards.length;
  for (let batchStart = 0; batchStart < shards.length; batchStart += batchSize) {
    if (merged.length >= requestedLimit) {
      break;
    }
    const batchShards = shards.slice(batchStart, batchStart + batchSize);
    const promises = batchShards.map((shardId) => queryEventShard(env, shardId, expandedFilter, subscriptionId));
    const results = await Promise.all(promises);
    for (let i = 0; i < results.length; i++) {
      const shardId = batchShards[i];
      const shardResults = results[i];
      const shardEventIds = [];
      for (const eventId of shardResults.eventIds || []) {
        if (!seen.has(eventId)) {
          seen.add(eventId);
          merged.push(eventId);
        }
        shardEventIds.push(eventId);
      }
      if (shardResults.events) {
        for (const event of shardResults.events) {
          if (event && !allEvents.find((e) => e.id === event.id)) {
            allEvents.push(event);
          }
        }
      }
      if (shardEventIds.length > 0) {
        shardMapping.set(shardId, shardEventIds);
      }
    }
  }
  const totalLatency = Date.now() - queryStartTime;
  if (totalLatency > 1e4) {
    console.warn(`Parallel query of ${shards.length} shards took ${totalLatency}ms total`);
  }
  const safetyCap = 1e4;
  const cappedEventIds = merged.slice(0, safetyCap);
  if (merged.length > safetyCap) {
    console.warn(
      `Query returned ${merged.length} events from ${shards.length} shards, capped to ${safetyCap} for memory safety. Results may be incomplete.`
    );
  }
  const cappedSet = new Set(cappedEventIds);
  const filteredMapping = /* @__PURE__ */ new Map();
  for (const [shardId, eventIds] of shardMapping.entries()) {
    const filtered = eventIds.filter((id) => cappedSet.has(id));
    if (filtered.length > 0) {
      filteredMapping.set(shardId, filtered);
    }
  }
  const cappedEvents = allEvents.filter((event) => cappedSet.has(event.id));
  return { eventIds: cappedEventIds, events: cappedEvents, shardMapping: filteredMapping };
}
async function retryWithBackoff(fn, context, maxAttempts = MAX_RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error(`${context}: All ${maxAttempts} retry attempts failed - ${error.message}`);
        return null;
      }
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.warn(`${context}: Attempt ${attempt} failed (${error.message}), retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}
async function insertEventsIntoShard(env, events) {
  if (events.length === 0) {
    return true;
  }
  try {
    const baseShardId = getEventShardId(events[0]);
    const replicaShardIds = getAllReplicaShardIds(baseShardId);
    const insertPromises = replicaShardIds.map(async (replicaShardId) => {
      const result = await retryWithBackoff(async () => {
        const stub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replicaShardId));
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REPLICA_FETCH_TIMEOUT);
        try {
          const response = await stub.fetch("https://internal/insert", {
            method: "POST",
            headers: { "Content-Type": "application/msgpack" },
            body: pack(events),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const insertResult = unpack(new Uint8Array(await response.arrayBuffer()));
          return insertResult.inserted > 0;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === "AbortError") {
            throw new Error(`Timeout after ${REPLICA_FETCH_TIMEOUT}ms`);
          }
          throw error;
        }
      }, `Replica ${replicaShardId}`);
      return { shardId: replicaShardId, success: result === true };
    });
    const results = await Promise.all(insertPromises);
    const failedReplicas = results.filter((r) => !r.success).map((r) => r.shardId);
    const allSucceeded = failedReplicas.length === 0;
    if (!allSucceeded) {
      console.error(
        `REPLICA WRITE FAILED: ${results.length - failedReplicas.length}/${results.length} replicas succeeded for batch of ${events.length} events to shard ${baseShardId}. Failed replicas: ${failedReplicas.join(", ")}. Event IDs: ${events.slice(0, 5).map((e) => e.id).join(", ")}${events.length > 5 ? "..." : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error inserting batch into shard:`, error.message);
    return false;
  }
}
var SHARD_WINDOW_SECONDS, SUB_SHARDS_PER_TIME_WINDOW, REPLICA_FETCH_TIMEOUT, MAX_RETRY_ATTEMPTS, INITIAL_RETRY_DELAY, MAX_QUERY_SHARDS;
var init_shard_router = __esm({
  "src/shard-router.ts"() {
    "use strict";
    init_msgpackr();
    init_config();
    SHARD_WINDOW_SECONDS = 24 * 60 * 60;
    SUB_SHARDS_PER_TIME_WINDOW = 1;
    REPLICA_FETCH_TIMEOUT = 3e4;
    MAX_RETRY_ATTEMPTS = 3;
    INITIAL_RETRY_DELAY = 1e3;
    MAX_QUERY_SHARDS = 900;
    __name(getTimeShardId, "getTimeShardId");
    __name(getShardId, "getShardId");
    __name(getAllSubShardsForTimeWindow, "getAllSubShardsForTimeWindow");
    __name(getEventShardId, "getEventShardId");
    __name(getBaseShardId, "getBaseShardId");
    __name(getReplicaShardId, "getReplicaShardId");
    __name(getAllReplicaShardIds, "getAllReplicaShardIds");
    __name(hashString, "hashString");
    __name(selectReadReplica, "selectReadReplica");
    __name(getTimeRangeShards, "getTimeRangeShards");
    __name(getShardsForFilter, "getShardsForFilter");
    __name(triggerBackfill, "triggerBackfill");
    __name(queryEventShard, "queryEventShard");
    __name(transformNostrFilterToShardFormat, "transformNostrFilterToShardFormat");
    __name(queryShards, "queryShards");
    __name(retryWithBackoff, "retryWithBackoff");
    __name(insertEventsIntoShard, "insertEventsIntoShard");
  }
});

// src/broadcast-consumer.ts
var broadcast_consumer_exports = {};
__export(broadcast_consumer_exports, {
  default: () => broadcast_consumer_default
});
var DEBUG, broadcast_consumer_default;
var init_broadcast_consumer = __esm({
  "src/broadcast-consumer.ts"() {
    "use strict";
    init_msgpackr();
    init_config();
    DEBUG = false;
    broadcast_consumer_default = {
      async queue(batch, env) {
        if (DEBUG)
          console.log(`BroadcastConsumer: Processing ${batch.messages.length} events`);
        try {
          const eventMap = /* @__PURE__ */ new Map();
          for (const message of batch.messages) {
            if (!eventMap.has(message.body.event.id)) {
              eventMap.set(message.body.event.id, message.body.event);
            }
          }
          const events = Array.from(eventMap.values());
          if (events.length === 0) {
            for (const message of batch.messages) {
              message.ack();
            }
            return;
          }
          if (DEBUG)
            console.log(`BroadcastConsumer: ${events.length} unique events after deduplication`);
          const shardToEvents = /* @__PURE__ */ new Map();
          for (const event of events) {
            const shardNum = event.kind % SESSION_MANAGER_SHARD_COUNT;
            if (!shardToEvents.has(shardNum)) {
              shardToEvents.set(shardNum, []);
            }
            shardToEvents.get(shardNum).push(event);
          }
          if (DEBUG)
            console.log(`BroadcastConsumer: Distributing to ${shardToEvents.size} shards`);
          const shardPromises = [];
          for (const [shardNum, shardEvents] of shardToEvents) {
            shardPromises.push(
              (async () => {
                try {
                  const sessionManagerId = env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
                  const sessionManagerStub = env.SESSION_MANAGER_DO.get(sessionManagerId);
                  const response = await sessionManagerStub.fetch("https://internal/process-events", {
                    method: "POST",
                    headers: { "Content-Type": "application/msgpack" },
                    body: pack({ events: shardEvents })
                  });
                  if (!response.ok) {
                    console.error(`Failed to process events on shard ${shardNum}: ${response.status}`);
                  }
                } catch (error) {
                  console.error(`Error processing events on SessionManagerDO shard ${shardNum}:`, error);
                }
              })()
            );
          }
          await Promise.all(shardPromises);
          for (const message of batch.messages) {
            message.ack();
          }
        } catch (error) {
          console.error("BroadcastConsumer: Fatal error:", error);
          for (const message of batch.messages) {
            message.retry();
          }
        }
      }
    };
  }
});

// src/r2-archive-consumer.ts
var r2_archive_consumer_exports = {};
__export(r2_archive_consumer_exports, {
  default: () => r2_archive_consumer_default
});
var R2_WRITES_PER_BATCH, BATCH_DELAY_MS, r2_archive_consumer_default;
var init_r2_archive_consumer = __esm({
  "src/r2-archive-consumer.ts"() {
    "use strict";
    R2_WRITES_PER_BATCH = 50;
    BATCH_DELAY_MS = 100;
    r2_archive_consumer_default = {
      async queue(batch, env) {
        console.log(`R2ArchiveConsumer: Processing ${batch.messages.length} events`);
        const startTime = Date.now();
        if (!env.NOSTR_ARCHIVE) {
          console.error("R2ArchiveConsumer: NOSTR_ARCHIVE bucket not configured");
          for (const message of batch.messages) {
            message.ack();
          }
          return;
        }
        const eventMap = /* @__PURE__ */ new Map();
        for (const message of batch.messages) {
          if (!eventMap.has(message.body.event.id)) {
            eventMap.set(message.body.event.id, message.body.event);
          }
        }
        const events = Array.from(eventMap.values());
        console.log(`R2ArchiveConsumer: ${events.length} unique events after deduplication`);
        let successCount = 0;
        let errorCount = 0;
        for (let i = 0; i < events.length; i += R2_WRITES_PER_BATCH) {
          const batchEvents = events.slice(i, i + R2_WRITES_PER_BATCH);
          const writePromises = batchEvents.map(async (event) => {
            try {
              const path = `events/raw/${event.id}.json`;
              await env.NOSTR_ARCHIVE.put(path, JSON.stringify(event), {
                httpMetadata: {
                  contentType: "application/json"
                },
                customMetadata: {
                  pubkey: event.pubkey,
                  kind: String(event.kind),
                  created_at: String(event.created_at)
                }
              });
              return { success: true, eventId: event.id };
            } catch (error) {
              console.error(`R2ArchiveConsumer: Failed to write event ${event.id}: ${error.message}`);
              return { success: false, eventId: event.id, error: error.message };
            }
          });
          const results = await Promise.all(writePromises);
          for (const result of results) {
            if (result.success) {
              successCount++;
            } else {
              errorCount++;
            }
          }
          if (i + R2_WRITES_PER_BATCH < events.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }
        const duration = Date.now() - startTime;
        console.log(
          `R2ArchiveConsumer: Archived ${successCount}/${events.length} events (${errorCount} errors) in ${duration}ms`
        );
        for (const message of batch.messages) {
          message.ack();
        }
      }
    };
  }
});

// src/types.ts
var _RateLimiter = class _RateLimiter {
  constructor(rate, capacity) {
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
    this.capacity = capacity;
    this.fillRate = rate;
  }
  removeToken() {
    this.refill();
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }
  refill() {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsedTime * this.fillRate);
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
};
__name(_RateLimiter, "RateLimiter");
var RateLimiter = _RateLimiter;

// src/connection-do.ts
init_msgpackr();
init_config();

// node_modules/@noble/hashes/esm/crypto.js
var crypto2 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;

// node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
__name(isBytes, "isBytes");
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
__name(anumber, "anumber");
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
__name(abytes, "abytes");
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
}
__name(ahash, "ahash");
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
__name(aexists, "aexists");
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
__name(aoutput, "aoutput");
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
__name(clean, "clean");
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
__name(createView, "createView");
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
__name(rotr, "rotr");
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
__name(bytesToHex, "bytesToHex");
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
__name(asciiToBase16, "asciiToBase16");
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
__name(hexToBytes, "hexToBytes");
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
__name(utf8ToBytes, "utf8ToBytes");
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
__name(toBytes, "toBytes");
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
__name(concatBytes, "concatBytes");
var _Hash = class _Hash {
};
__name(_Hash, "Hash");
var Hash = _Hash;
function createHasher(hashCons) {
  const hashC = /* @__PURE__ */ __name((msg) => hashCons().update(toBytes(msg)).digest(), "hashC");
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
__name(createHasher, "createHasher");
function randomBytes(bytesLength = 32) {
  if (crypto2 && typeof crypto2.getRandomValues === "function") {
    return crypto2.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto2 && typeof crypto2.randomBytes === "function") {
    return Uint8Array.from(crypto2.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
__name(randomBytes, "randomBytes");

// node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE ? 4 : 0;
  const l = isLE ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE);
  view.setUint32(byteOffset + l, wl, isLE);
}
__name(setBigUint64, "setBigUint64");
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
__name(Chi, "Chi");
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
__name(Maj, "Maj");
var _HashMD = class _HashMD extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView2 = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView2, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
__name(_HashMD, "HashMD");
var HashMD = _HashMD;
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var _SHA256 = class _SHA256 extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
__name(_SHA256, "SHA256");
var SHA256 = _SHA256;
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());

// node_modules/@noble/hashes/esm/hmac.js
var _HMAC = class _HMAC extends Hash {
  constructor(hash, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    ahash(hash);
    const key = toBytes(_key);
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    abytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
__name(_HMAC, "HMAC");
var HMAC = _HMAC;
var hmac = /* @__PURE__ */ __name((hash, key, message) => new HMAC(hash, key).update(message).digest(), "hmac");
hmac.create = (hash, key) => new HMAC(hash, key);

// node_modules/@noble/curves/esm/utils.js
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
function _abool2(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}"`;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
__name(_abool2, "_abool2");
function _abytes2(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
__name(_abytes2, "_abytes2");
function numberToHexUnpadded(num2) {
  const hex = num2.toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
__name(numberToHexUnpadded, "numberToHexUnpadded");
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
__name(hexToNumber, "hexToNumber");
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
__name(bytesToNumberBE, "bytesToNumberBE");
function bytesToNumberLE(bytes) {
  abytes(bytes);
  return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
}
__name(bytesToNumberLE, "bytesToNumberLE");
function numberToBytesBE(n, len) {
  return hexToBytes(n.toString(16).padStart(len * 2, "0"));
}
__name(numberToBytesBE, "numberToBytesBE");
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
__name(numberToBytesLE, "numberToBytesLE");
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes(hex);
    } catch (e) {
      throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
    }
  } else if (isBytes(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(title + " must be hex string or Uint8Array");
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(title + " of length " + expectedLength + " expected, got " + len);
  return res;
}
__name(ensureBytes, "ensureBytes");
var isPosBig = /* @__PURE__ */ __name((n) => typeof n === "bigint" && _0n <= n, "isPosBig");
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
__name(inRange, "inRange");
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
__name(aInRange, "aInRange");
function bitLen(n) {
  let len;
  for (len = 0; n > _0n; n >>= _1n, len += 1)
    ;
  return len;
}
__name(bitLen, "bitLen");
var bitMask = /* @__PURE__ */ __name((n) => (_1n << BigInt(n)) - _1n, "bitMask");
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = /* @__PURE__ */ __name((len) => new Uint8Array(len), "u8n");
  const u8of = /* @__PURE__ */ __name((byte) => Uint8Array.of(byte), "u8of");
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = /* @__PURE__ */ __name(() => {
    v.fill(1);
    k.fill(0);
    i = 0;
  }, "reset");
  const h = /* @__PURE__ */ __name((...b) => hmacFn(k, v, ...b), "h");
  const reseed = /* @__PURE__ */ __name((seed = u8n(0)) => {
    k = h(u8of(0), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8of(1), seed);
    v = h();
  }, "reseed");
  const gen = /* @__PURE__ */ __name(() => {
    if (i++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes(...out);
  }, "gen");
  const genUntil = /* @__PURE__ */ __name((seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  }, "genUntil");
  return genUntil;
}
__name(createHmacDrbg, "createHmacDrbg");
function _validateObject(object, fields, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  __name(checkField, "checkField");
  Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
  Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
}
__name(_validateObject, "_validateObject");
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}
__name(memoized, "memoized");

// node_modules/@noble/curves/esm/abstract/modular.js
var _0n2 = BigInt(0);
var _1n2 = BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _16n = /* @__PURE__ */ BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
__name(mod, "mod");
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
__name(pow2, "pow2");
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n2)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, y = _1n2, u = _1n2, v = _0n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
__name(invert, "invert");
function assertIsSquare(Fp, root, n) {
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
}
__name(assertIsSquare, "assertIsSquare");
function sqrt3mod4(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n2) / _4n;
  const root = Fp.pow(n, p1div4);
  assertIsSquare(Fp, root, n);
  return root;
}
__name(sqrt3mod4, "sqrt3mod4");
function sqrt5mod8(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n) / _8n;
  const n2 = Fp.mul(n, _2n);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  assertIsSquare(Fp, root, n);
  return root;
}
__name(sqrt5mod8, "sqrt5mod8");
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return (Fp, n) => {
    let tv1 = Fp.pow(n, c4);
    let tv2 = Fp.mul(tv1, c1);
    const tv3 = Fp.mul(tv1, c2);
    const tv4 = Fp.mul(tv1, c3);
    const e1 = Fp.eql(Fp.sqr(tv2), n);
    const e2 = Fp.eql(Fp.sqr(tv3), n);
    tv1 = Fp.cmov(tv1, tv2, e1);
    tv2 = Fp.cmov(tv4, tv3, e2);
    const e3 = Fp.eql(Fp.sqr(tv2), n);
    const root = Fp.cmov(tv1, tv2, e3);
    assertIsSquare(Fp, root, n);
    return root;
  };
}
__name(sqrt9mod16, "sqrt9mod16");
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return /* @__PURE__ */ __name(function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = Fp.pow(c, exponent);
      M = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  }, "tonelliSlow");
}
__name(tonelliShanks, "tonelliShanks");
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
__name(FpSqrt, "FpSqrt");
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  _validateObject(field, opts);
  return field;
}
__name(validateField, "validateField");
function FpPow(Fp, num2, power) {
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return Fp.ONE;
  if (power === _1n2)
    return num2;
  let p = Fp.ONE;
  let d = num2;
  while (power > _0n2) {
    if (power & _1n2)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n2;
  }
  return p;
}
__name(FpPow, "FpPow");
function FpInvertBatch(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num2);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num2);
  }, invertedAcc);
  return inverted;
}
__name(FpInvertBatch, "FpInvertBatch");
function FpLegendre(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n2) / _2n;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
__name(FpLegendre, "FpLegendre");
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
__name(nLength, "nLength");
function Field(ORDER, bitLenOrOpts, isLE = false, opts = {}) {
  if (ORDER <= _0n2)
    throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
  let _nbitLength = void 0;
  let _sqrt = void 0;
  let modFromBytes = false;
  let allowedLengths = void 0;
  if (typeof bitLenOrOpts === "object" && bitLenOrOpts != null) {
    if (opts.sqrt || isLE)
      throw new Error("cannot specify opts in two arguments");
    const _opts = bitLenOrOpts;
    if (_opts.BITS)
      _nbitLength = _opts.BITS;
    if (_opts.sqrt)
      _sqrt = _opts.sqrt;
    if (typeof _opts.isLE === "boolean")
      isLE = _opts.isLE;
    if (typeof _opts.modFromBytes === "boolean")
      modFromBytes = _opts.modFromBytes;
    allowedLengths = _opts.allowedLengths;
  } else {
    if (typeof bitLenOrOpts === "number")
      _nbitLength = bitLenOrOpts;
    if (opts.sqrt)
      _sqrt = opts.sqrt;
  }
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
  if (BYTES > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let sqrtP;
  const f = Object.freeze({
    ORDER,
    isLE,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n2,
    ONE: _1n2,
    allowedLengths,
    create: (num2) => mod(num2, ORDER),
    isValid: (num2) => {
      if (typeof num2 !== "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof num2);
      return _0n2 <= num2 && num2 < ORDER;
    },
    is0: (num2) => num2 === _0n2,
    // is valid and invertible
    isValidNot0: (num2) => !f.is0(num2) && f.isValid(num2),
    isOdd: (num2) => (num2 & _1n2) === _1n2,
    neg: (num2) => mod(-num2, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num2) => mod(num2 * num2, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num2, power) => FpPow(f, num2, power),
    div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
    // Same as above, but doesn't normalize
    sqrN: (num2) => num2 * num2,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num2) => invert(num2, ORDER),
    sqrt: _sqrt || ((n) => {
      if (!sqrtP)
        sqrtP = FpSqrt(ORDER);
      return sqrtP(f, n);
    }),
    toBytes: (num2) => isLE ? numberToBytesLE(num2, BYTES) : numberToBytesBE(num2, BYTES),
    fromBytes: (bytes, skipValidation = true) => {
      if (allowedLengths) {
        if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!f.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    },
    // TODO: we don't need it here, move out to separate fn
    invertBatch: (lst) => FpInvertBatch(f, lst),
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov: (a, b, c) => c ? b : a
  });
  return Object.freeze(f);
}
__name(Field, "Field");
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
__name(getFieldBytesLength, "getFieldBytesLength");
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
__name(getMinHashLength, "getMinHashLength");
function mapHashToField(key, fieldOrder, isLE = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num2 = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num2, fieldOrder - _1n2) + _1n2;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
__name(mapHashToField, "mapHashToField");

// node_modules/@noble/curves/esm/abstract/curve.js
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
__name(negateCt, "negateCt");
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
__name(normalizeZ, "normalizeZ");
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
__name(validateW, "validateW");
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
__name(calcWOpts, "calcWOpts");
function calcOffsets(n, window2, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n3;
  }
  const offsetStart = window2 * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window2 % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
__name(calcOffsets, "calcOffsets");
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
__name(validateMSMPoints, "validateMSMPoints");
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
__name(validateMSMScalars, "validateMSMScalars");
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
__name(getW, "getW");
function assert0(n) {
  if (n !== _0n3)
    throw new Error("invalid wNAF");
}
__name(assert0, "assert0");
var _wNAF = class _wNAF {
  // Parametrized with a given Point class (not individual point)
  constructor(Point, bits) {
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.Fn = Point.Fn;
    this.bits = bits;
  }
  // non-const time multiplication ladder
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n3) {
      if (n & _1n3)
        p = p.add(d);
      d = d.double();
      n >>= _1n3;
    }
    return p;
  }
  /**
   * Creates a wNAF precomputation window. Used for caching.
   * Default window size is set by `utils.precompute()` and is equal to 8.
   * Number of precomputed points depends on the curve size:
   * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
   * - 𝑊 is the window size
   * - 𝑛 is the bitlength of the curve order.
   * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
   * @param point Point instance
   * @param W window size
   * @returns precomputed point tables flattened to a single array
   */
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window2 = 0; window2 < windows; window2++) {
      base = p;
      points.push(base);
      for (let i = 1; i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  /**
   * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
   * More compact implementation:
   * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
   * @returns real and fake (for const-time) points
   */
  wNAF(W, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W, this.bits);
    for (let window2 = 0; window2 < wo.windows; window2++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window2, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  /**
   * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
   * @param acc accumulator point to add result of multiplication
   * @returns point
   */
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window2 = 0; window2 < wo.windows; window2++) {
      if (n === _0n3)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window2, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  // We calculate precomputes for elliptic curve point multiplication
  // using windowed method. This specifies window size and
  // stores precomputed values. Usually only base point would be precomputed.
  createCache(P, W) {
    validateW(W, this.bits);
    pointWindowSizes.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
};
__name(_wNAF, "wNAF");
var wNAF = _wNAF;
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n3 || k2 > _0n3) {
    if (k1 & _1n3)
      p1 = p1.add(acc);
    if (k2 & _1n3)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n3;
    k2 >>= _1n3;
  }
  return { p1, p2 };
}
__name(mulEndoUnsafe, "mulEndoUnsafe");
function pippenger(c, fieldN, points, scalars) {
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(zero);
    for (let j = 0; j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero;
    for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0; j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
__name(pippenger, "pippenger");
function createField(order, field, isLE) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE });
  }
}
__name(createField, "createField");
function _createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
__name(_createCurveFields, "_createCurveFields");

// node_modules/@noble/curves/esm/abstract/weierstrass.js
var divNearest = /* @__PURE__ */ __name((num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n2) / den, "divNearest");
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n4;
  const k2neg = k2 < _0n4;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
  if (k1 < _0n4 || k1 >= MAX_NUM || k2 < _0n4 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
__name(_splitEndoScalar, "_splitEndoScalar");
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
__name(validateSigFormat, "validateSigFormat");
function validateSigOpts(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
  }
  _abool2(optsn.lowS, "lowS");
  _abool2(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
__name(validateSigOpts, "validateSigOpts");
var _DERErr = class _DERErr extends Error {
  constructor(m = "") {
    super(m);
  }
};
__name(_DERErr, "DERErr");
var DERErr = _DERErr;
var DER = {
  // asn.1 DER encoding utils
  Err: DERErr,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    // v - value, l - left bytes (unparsed)
    decode(tag, data) {
      const { Err: E } = DER;
      let pos = 0;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(num2) {
      const { Err: E } = DER;
      if (num2 < _0n4)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num2);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(hex) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = ensureBytes("signature", hex);
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
var _2n2 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function _normFnElement(Fn, key) {
  const { BYTES: expected } = Fn;
  let num2;
  if (typeof key === "bigint") {
    num2 = key;
  } else {
    let bytes = ensureBytes("private key", key);
    try {
      num2 = Fn.fromBytes(bytes);
    } catch (error) {
      throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
    }
  }
  if (!Fn.isValidNot0(num2))
    throw new Error("invalid private key: out of range [1..N-1]");
  return num2;
}
__name(_normFnElement, "_normFnElement");
function weierstrassN(params, extraOpts = {}) {
  const validated = _createCurveFields("weierstrass", params, extraOpts);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  _validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    wrapPrivateKey: "boolean"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  __name(assertCompressionIsSupported, "assertCompressionIsSupported");
  function pointToBytes2(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    _abool2(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  __name(pointToBytes2, "pointToBytes");
  function pointFromBytes(bytes) {
    _abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const isYOdd = Fp.isOdd(y);
      const isHeadOdd = (head & 1) === 1;
      if (isHeadOdd !== isYOdd)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  __name(pointFromBytes, "pointFromBytes");
  const encodePoint = extraOpts.toBytes || pointToBytes2;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  __name(weierstrassEquation, "weierstrassEquation");
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  __name(isValidXY, "isValidXY");
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  __name(acoord, "acoord");
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("ProjectivePoint expected");
  }
  __name(aprjpoint, "aprjpoint");
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  __name(splitEndoScalarN, "splitEndoScalarN");
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp.eql(Z, Fp.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(Z);
    const x = Fp.mul(X, iz);
    const y = Fp.mul(Y, iz);
    const zz = Fp.mul(Z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  __name(finishEndo, "finishEndo");
  const _Point = class _Point {
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof _Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return _Point.ZERO;
      return new _Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = _Point.fromAffine(decodePoint(_abytes2(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return _Point.fromBytes(ensureBytes("pointHex", hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new _Point(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new _Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new _Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(_Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul = /* @__PURE__ */ __name((n) => wnaf.cached(this, n, (p) => normalizeZ(_Point, p)), "mul");
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(_Point, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n4 || p.is0())
        return _Point.ZERO;
      if (sc === _1n4)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(_Point, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    multiplyAndAddUnsafe(Q, a, b) {
      const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
      return sum.is0() ? void 0 : sum;
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n4)
        return true;
      if (isTorsionFree)
        return isTorsionFree(_Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n4)
        return this;
      if (clearCofactor)
        return clearCofactor(_Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      _abool2(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(_Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
    // TODO: remove
    get px() {
      return this.X;
    }
    get py() {
      return this.X;
    }
    get pz() {
      return this.Z;
    }
    toRawBytes(isCompressed = true) {
      return this.toBytes(isCompressed);
    }
    _setWindowSize(windowSize) {
      this.precompute(windowSize);
    }
    static normalizeZ(points) {
      return normalizeZ(_Point, points);
    }
    static msm(points, scalars) {
      return pippenger(_Point, Fn, points, scalars);
    }
    static fromPrivateKey(privateKey) {
      return _Point.BASE.multiply(_normFnElement(Fn, privateKey));
    }
  };
  __name(_Point, "Point");
  let Point = _Point;
  Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
  Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
  Point.Fp = Fp;
  Point.Fn = Fn;
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point.BASE.precompute(8);
  return Point;
}
__name(weierstrassN, "weierstrassN");
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
__name(pprefix, "pprefix");
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
__name(getWLengths, "getWLengths");
function ecdh(Point, ecdhOpts = {}) {
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn), { seed: getMinHashLength(Fn.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      return !!_normFnElement(Fn, secretKey);
    } catch (error) {
      return false;
    }
  }
  __name(isValidSecretKey, "isValidSecretKey");
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  __name(isValidPublicKey, "isValidPublicKey");
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(_abytes2(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  __name(randomSecretKey, "randomSecretKey");
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(_normFnElement(Fn, secretKey)).toBytes(isCompressed);
  }
  __name(getPublicKey, "getPublicKey");
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  __name(keygen, "keygen");
  function isProbPub(item) {
    if (typeof item === "bigint")
      return false;
    if (item instanceof Point)
      return true;
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (Fn.allowedLengths || secretKey === publicKey)
      return void 0;
    const l = ensureBytes("key", item).length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  __name(isProbPub, "isProbPub");
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = _normFnElement(Fn, secretKeyA);
    const b = Point.fromHex(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  __name(getSharedSecret, "getSharedSecret");
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey,
    // TODO: remove
    isValidPrivateKey: isValidSecretKey,
    randomPrivateKey: randomSecretKey,
    normPrivateKeyToScalar: (key) => _normFnElement(Fn, key),
    precompute(windowSize = 8, point = Point.BASE) {
      return point.precompute(windowSize, false);
    }
  };
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
__name(ecdh, "ecdh");
function ecdsa(Point, hash, ecdsaOpts = {}) {
  ahash(hash);
  _validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const randomBytes2 = ecdsaOpts.randomBytes || randomBytes;
  const hmac2 = ecdsaOpts.hmac || ((key, ...msgs) => hmac(hash, key, concatBytes(...msgs)));
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: false,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : false,
    format: void 0,
    //'compact' as ECDSASigFormat,
    extraEntropy: false
  };
  const defaultSigOpts_format = "compact";
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n4;
    return number > HALF;
  }
  __name(isBiggerThanHalfOrder, "isBiggerThanHalfOrder");
  function validateRS(title, num2) {
    if (!Fn.isValidNot0(num2))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num2;
  }
  __name(validateRS, "validateRS");
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return _abytes2(bytes, sizer, `${format} signature`);
  }
  __name(validateSigLength, "validateSigLength");
  const _Signature = class _Signature {
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null)
        this.recovery = recovery;
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts_format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(_abytes2(bytes));
        return new _Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = Fn.BYTES;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new _Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes(hex), format);
    }
    addRecoveryBit(recovery) {
      return new _Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const FIELD_ORDER = Fp.ORDER;
      const { r, s, recovery: rec } = this;
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const hasCofactor = CURVE_ORDER * _2n2 < FIELD_ORDER;
      if (hasCofactor && rec > 1)
        throw new Error("recovery id is ambiguous for h>1 curve");
      const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("recovery id 2 or 3 invalid");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes(pprefix((rec & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h = bits2int_modN(ensureBytes("msgHash", messageHash));
      const u1 = Fn.create(-h * ir);
      const u2 = Fn.create(s * ir);
      const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0())
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts_format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes(DER.hexFromSig(this));
      const r = Fn.toBytes(this.r);
      const s = Fn.toBytes(this.s);
      if (format === "recovered") {
        if (this.recovery == null)
          throw new Error("recovery bit must be present");
        return concatBytes(Uint8Array.of(this.recovery), r, s);
      }
      return concatBytes(r, s);
    }
    toHex(format) {
      return bytesToHex(this.toBytes(format));
    }
    // TODO: remove
    assertValidity() {
    }
    static fromCompact(hex) {
      return _Signature.fromBytes(ensureBytes("sig", hex), "compact");
    }
    static fromDER(hex) {
      return _Signature.fromBytes(ensureBytes("sig", hex), "der");
    }
    normalizeS() {
      return this.hasHighS() ? new _Signature(this.r, Fn.neg(this.s), this.recovery) : this;
    }
    toDERRawBytes() {
      return this.toBytes("der");
    }
    toDERHex() {
      return bytesToHex(this.toBytes("der"));
    }
    toCompactRawBytes() {
      return this.toBytes("compact");
    }
    toCompactHex() {
      return bytesToHex(this.toBytes("compact"));
    }
  };
  __name(_Signature, "Signature");
  let Signature = _Signature;
  const bits2int = ecdsaOpts.bits2int || /* @__PURE__ */ __name(function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num2 = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num2 >> BigInt(delta) : num2;
  }, "bits2int_def");
  const bits2int_modN = ecdsaOpts.bits2int_modN || /* @__PURE__ */ __name(function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  }, "bits2int_modN_def");
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num2) {
    aInRange("num < 2^" + fnBits, num2, _0n4, ORDER_MASK);
    return Fn.toBytes(num2);
  }
  __name(int2octets, "int2octets");
  function validateMsgAndHash(message, prehash) {
    _abytes2(message, void 0, "message");
    return prehash ? _abytes2(hash(message), void 0, "prehashed message") : message;
  }
  __name(validateMsgAndHash, "validateMsgAndHash");
  function prepSig(message, privateKey, opts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = _normFnElement(Fn, privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes2(lengths.secretKey) : extraEntropy;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const ik = Fn.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n4)
        return;
      const s = Fn.create(ik * Fn.create(m + r * d));
      if (s === _0n4)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n4);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    __name(k2sig, "k2sig");
    return { seed, k2sig };
  }
  __name(prepSig, "prepSig");
  function sign(message, secretKey, opts = {}) {
    message = ensureBytes("message", message);
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash.outputLen, Fn.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig;
  }
  __name(sign, "sign");
  function tryParsingSig(sg) {
    let sig = void 0;
    const isHex = typeof sg === "string" || isBytes(sg);
    const isObj = !isHex && sg !== null && typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint";
    if (!isHex && !isObj)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    if (isObj) {
      sig = new Signature(sg.r, sg.s);
    } else if (isHex) {
      try {
        sig = Signature.fromBytes(ensureBytes("sig", sg), "der");
      } catch (derError) {
        if (!(derError instanceof DER.Err))
          throw derError;
      }
      if (!sig) {
        try {
          sig = Signature.fromBytes(ensureBytes("sig", sg), "compact");
        } catch (error) {
          return false;
        }
      }
    }
    if (!sig)
      return false;
    return sig;
  }
  __name(tryParsingSig, "tryParsingSig");
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = ensureBytes("publicKey", publicKey);
    message = validateMsgAndHash(ensureBytes("message", message), prehash);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const sig = format === void 0 ? tryParsingSig(signature) : Signature.fromBytes(ensureBytes("sig", signature), format);
    if (sig === false)
      return false;
    try {
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h * is);
      const u2 = Fn.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  __name(verify, "verify");
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  __name(recoverPublicKey, "recoverPublicKey");
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}
__name(ecdsa, "ecdsa");
function _weierstrass_legacy_opts_to_new(c) {
  const CURVE = {
    a: c.a,
    b: c.b,
    p: c.Fp.ORDER,
    n: c.n,
    h: c.h,
    Gx: c.Gx,
    Gy: c.Gy
  };
  const Fp = c.Fp;
  let allowedLengths = c.allowedPrivateKeyLengths ? Array.from(new Set(c.allowedPrivateKeyLengths.map((l) => Math.ceil(l / 2)))) : void 0;
  const Fn = Field(CURVE.n, {
    BITS: c.nBitLength,
    allowedLengths,
    modFromBytes: c.wrapPrivateKey
  });
  const curveOpts = {
    Fp,
    Fn,
    allowInfinityPoint: c.allowInfinityPoint,
    endo: c.endo,
    isTorsionFree: c.isTorsionFree,
    clearCofactor: c.clearCofactor,
    fromBytes: c.fromBytes,
    toBytes: c.toBytes
  };
  return { CURVE, curveOpts };
}
__name(_weierstrass_legacy_opts_to_new, "_weierstrass_legacy_opts_to_new");
function _ecdsa_legacy_opts_to_new(c) {
  const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
  const ecdsaOpts = {
    hmac: c.hmac,
    randomBytes: c.randomBytes,
    lowS: c.lowS,
    bits2int: c.bits2int,
    bits2int_modN: c.bits2int_modN
  };
  return { CURVE, curveOpts, hash: c.hash, ecdsaOpts };
}
__name(_ecdsa_legacy_opts_to_new, "_ecdsa_legacy_opts_to_new");
function _ecdsa_new_output_to_legacy(c, _ecdsa) {
  const Point = _ecdsa.Point;
  return Object.assign({}, _ecdsa, {
    ProjectivePoint: Point,
    CURVE: Object.assign({}, c, nLength(Point.Fn.ORDER, Point.Fn.BITS))
  });
}
__name(_ecdsa_new_output_to_legacy, "_ecdsa_new_output_to_legacy");
function weierstrass(c) {
  const { CURVE, curveOpts, hash, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
  const Point = weierstrassN(CURVE, curveOpts);
  const signs = ecdsa(Point, hash, ecdsaOpts);
  return _ecdsa_new_output_to_legacy(c, signs);
}
__name(weierstrass, "weierstrass");

// node_modules/@noble/curves/esm/_shortw_utils.js
function createCurve(curveDef, defHash) {
  const create = /* @__PURE__ */ __name((hash) => weierstrass({ ...curveDef, hash }), "create");
  return { ...create(defHash), create };
}
__name(createCurve, "createCurve");

// node_modules/@noble/curves/esm/secp256k1.js
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _0n5 = /* @__PURE__ */ BigInt(0);
var _1n5 = /* @__PURE__ */ BigInt(1);
var _2n3 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n3, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n3, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
__name(sqrtMod, "sqrtMod");
var Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var secp256k1 = createCurve({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha256);
var TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256(utf8ToBytes(tag));
    tagP = concatBytes(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes(tagP, ...messages));
}
__name(taggedHash, "taggedHash");
var pointToBytes = /* @__PURE__ */ __name((point) => point.toBytes(true).slice(1), "pointToBytes");
var Pointk1 = /* @__PURE__ */ (() => secp256k1.Point)();
var hasEven = /* @__PURE__ */ __name((y) => y % _2n3 === _0n5, "hasEven");
function schnorrGetExtPubKey(priv) {
  const { Fn, BASE } = Pointk1;
  const d_ = _normFnElement(Fn, priv);
  const p = BASE.multiply(d_);
  const scalar = hasEven(p.y) ? d_ : Fn.neg(d_);
  return { scalar, bytes: pointToBytes(p) };
}
__name(schnorrGetExtPubKey, "schnorrGetExtPubKey");
function lift_x(x) {
  const Fp = Fpk1;
  if (!Fp.isValidNot0(x))
    throw new Error("invalid x: Fail if x \u2265 p");
  const xx = Fp.create(x * x);
  const c = Fp.create(xx * x + BigInt(7));
  let y = Fp.sqrt(c);
  if (!hasEven(y))
    y = Fp.neg(y);
  const p = Pointk1.fromAffine({ x, y });
  p.assertValidity();
  return p;
}
__name(lift_x, "lift_x");
var num = bytesToNumberBE;
function challenge(...args) {
  return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
}
__name(challenge, "challenge");
function schnorrGetPublicKey(secretKey) {
  return schnorrGetExtPubKey(secretKey).bytes;
}
__name(schnorrGetPublicKey, "schnorrGetPublicKey");
function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
  const { Fn } = Pointk1;
  const m = ensureBytes("message", message);
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
  const a = ensureBytes("auxRand", auxRand, 32);
  const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const { bytes: rx, scalar: k } = schnorrGetExtPubKey(rand);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
__name(schnorrSign, "schnorrSign");
function schnorrVerify(signature, message, publicKey) {
  const { Fn, BASE } = Pointk1;
  const sig = ensureBytes("signature", signature, 64);
  const m = ensureBytes("message", message);
  const pub = ensureBytes("publicKey", publicKey, 32);
  try {
    const P = lift_x(num(pub));
    const r = num(sig.subarray(0, 32));
    if (!inRange(r, _1n5, secp256k1_CURVE.p))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!inRange(s, _1n5, secp256k1_CURVE.n))
      return false;
    const e = challenge(Fn.toBytes(r), pointToBytes(P), m);
    const R = BASE.multiplyUnsafe(s).add(P.multiplyUnsafe(Fn.neg(e)));
    const { x, y } = R.toAffine();
    if (R.is0() || !hasEven(y) || x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
__name(schnorrVerify, "schnorrVerify");
var schnorr = /* @__PURE__ */ (() => {
  const size = 32;
  const seedLength = 48;
  const randomSecretKey = /* @__PURE__ */ __name((seed = randomBytes(seedLength)) => {
    return mapHashToField(seed, secp256k1_CURVE.n);
  }, "randomSecretKey");
  secp256k1.utils.randomSecretKey;
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: schnorrGetPublicKey(secretKey) };
  }
  __name(keygen, "keygen");
  return {
    keygen,
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    Point: Pointk1,
    utils: {
      randomSecretKey,
      randomPrivateKey: randomSecretKey,
      taggedHash,
      // TODO: remove
      lift_x,
      pointToBytes,
      numberToBytesBE,
      bytesToNumberBE,
      mod
    },
    lengths: {
      secretKey: size,
      publicKey: size,
      publicKeyHasPrefix: false,
      signature: size * 2,
      seed: seedLength
    }
  };
})();

// src/relay-worker.ts
init_msgpackr();
init_config();
var DEBUG2 = false;
var {
  relayInfo: relayInfo2,
  PAY_TO_RELAY_ENABLED: PAY_TO_RELAY_ENABLED2,
  RELAY_ACCESS_PRICE_SATS: RELAY_ACCESS_PRICE_SATS2,
  relayNpub: relayNpub2,
  nip05Users: nip05Users2,
  checkValidNip05: checkValidNip052,
  blockedNip05Domains: blockedNip05Domains2,
  allowedNip05Domains: allowedNip05Domains2,
  MAX_TIME_WINDOWS_PER_QUERY: MAX_TIME_WINDOWS_PER_QUERY2,
  CONNECTION_DO_SHARDING_ENABLED: CONNECTION_DO_SHARDING_ENABLED2
} = config_exports;
var GLOBAL_MAX_EVENTS = 1e3;
var MAX_QUERY_COMPLEXITY = 1e3;
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}
__name(hashCode, "hashCode");
async function verifyEventSignature(event) {
  try {
    const signatureBytes = hexToBytes2(event.sig);
    const serializedEventData = serializeEventForSigning(event);
    const messageHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serializedEventData)
    );
    const messageHash = new Uint8Array(messageHashBuffer);
    const publicKeyBytes = hexToBytes2(event.pubkey);
    return schnorr.verify(signatureBytes, messageHash, publicKeyBytes);
  } catch (error) {
    console.error("Error verifying event signature:", error);
    return false;
  }
}
__name(verifyEventSignature, "verifyEventSignature");
function serializeEventForSigning(event) {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
}
__name(serializeEventForSigning, "serializeEventForSigning");
function hexToBytes2(hexString) {
  if (hexString.length % 2 !== 0)
    throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}
__name(hexToBytes2, "hexToBytes");
async function hasPaidForRelay2(pubkey, env) {
  if (!PAY_TO_RELAY_ENABLED2)
    return true;
  try {
    const { hasPaidForRelay: checkPayment } = await Promise.resolve().then(() => (init_payment_router(), payment_router_exports));
    return await checkPayment(pubkey, env);
  } catch (error) {
    console.error(`Error checking paid status for ${pubkey}:`, error);
    return false;
  }
}
__name(hasPaidForRelay2, "hasPaidForRelay");
async function savePaidPubkey(pubkey, env) {
  try {
    const { recordPayment: recordPayment2 } = await Promise.resolve().then(() => (init_payment_router(), payment_router_exports));
    const success = await recordPayment2(pubkey, RELAY_ACCESS_PRICE_SATS2, env);
    if (success) {
      console.log(`Payment recorded for pubkey: ${pubkey}`);
    } else {
      console.error(`Failed to record payment for pubkey: ${pubkey}`);
    }
    return success;
  } catch (error) {
    console.error(`Error saving paid pubkey ${pubkey}:`, error);
    return false;
  }
}
__name(savePaidPubkey, "savePaidPubkey");
function fetchEventFromFallbackRelay(pubkey) {
  return new Promise((resolve, reject) => {
    const fallbackRelayUrl = "wss://relay.nostr.band";
    const ws = new WebSocket(fallbackRelayUrl);
    let hasClosed = false;
    const closeWebSocket = /* @__PURE__ */ __name((subscriptionId) => {
      if (!hasClosed && ws.readyState === WebSocket.OPEN) {
        if (subscriptionId) {
          ws.send(JSON.stringify(["CLOSE", subscriptionId]));
        }
        ws.close();
        hasClosed = true;
        console.log("WebSocket connection to fallback relay closed");
      }
    }, "closeWebSocket");
    ws.addEventListener("open", () => {
      console.log("WebSocket connection to fallback relay opened.");
      const subscriptionId = Math.random().toString(36).substr(2, 9);
      const filters = {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      };
      const reqMessage = JSON.stringify(["REQ", subscriptionId, filters]);
      ws.send(reqMessage);
    });
    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message[0] === "EVENT" && message[1]) {
          const eventData = message[2];
          if (eventData.kind === 0 && eventData.pubkey === pubkey) {
            console.log("Received kind 0 event from fallback relay.");
            closeWebSocket(message[1]);
            resolve(eventData);
          }
        } else if (message[0] === "EOSE") {
          console.log("EOSE received from fallback relay, no kind 0 event found.");
          closeWebSocket(message[1]);
          resolve(null);
        }
      } catch (error) {
        console.error(`Error processing fallback relay event for pubkey ${pubkey}: ${error}`);
        reject(error);
      }
    });
    ws.addEventListener("error", (error) => {
      console.error(`WebSocket error with fallback relay:`, error);
      ws.close();
      hasClosed = true;
      reject(error);
    });
    ws.addEventListener("close", () => {
      hasClosed = true;
      console.log("Fallback relay WebSocket connection closed.");
    });
    setTimeout(() => {
      if (!hasClosed) {
        console.log("Timeout reached. Closing WebSocket connection to fallback relay.");
        closeWebSocket(null);
        reject(new Error(`No response from fallback relay for pubkey ${pubkey}`));
      }
    }, 5e3);
  });
}
__name(fetchEventFromFallbackRelay, "fetchEventFromFallbackRelay");
async function fetchKind0EventForPubkey(pubkey, env) {
  try {
    const filters = [{ kinds: [0], authors: [pubkey], limit: 1 }];
    const result = await queryEvents(filters, env);
    if (result.events && result.events.length > 0) {
      return result.events[0];
    }
    console.log(`No kind 0 event found locally, trying fallback relay: wss://relay.nostr.band`);
    const fallbackEvent = await fetchEventFromFallbackRelay(pubkey);
    if (fallbackEvent) {
      return fallbackEvent;
    }
  } catch (error) {
    console.error(`Error fetching kind 0 event for pubkey ${pubkey}: ${error}`);
  }
  return null;
}
__name(fetchKind0EventForPubkey, "fetchKind0EventForPubkey");
async function validateNIP05FromKind0(pubkey, env) {
  try {
    const metadataEvent = await fetchKind0EventForPubkey(pubkey, env);
    if (!metadataEvent) {
      console.error(`No kind 0 metadata event found for pubkey: ${pubkey}`);
      return false;
    }
    const metadata = JSON.parse(metadataEvent.content);
    const nip05Address = metadata.nip05;
    if (!nip05Address) {
      console.error(`No NIP-05 address found in kind 0 for pubkey: ${pubkey}`);
      return false;
    }
    const isValid = await validateNIP05(nip05Address, pubkey);
    return isValid;
  } catch (error) {
    console.error(`Error validating NIP-05 for pubkey ${pubkey}: ${error}`);
    return false;
  }
}
__name(validateNIP05FromKind0, "validateNIP05FromKind0");
async function validateNIP05(nip05Address, pubkey) {
  try {
    const [name, domain] = nip05Address.split("@");
    if (!domain) {
      throw new Error(`Invalid NIP-05 address format: ${nip05Address}`);
    }
    if (blockedNip05Domains2.has(domain)) {
      console.error(`NIP-05 domain is blocked: ${domain}`);
      return false;
    }
    if (allowedNip05Domains2.size > 0 && !allowedNip05Domains2.has(domain)) {
      console.error(`NIP-05 domain is not allowed: ${domain}`);
      return false;
    }
    const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch NIP-05 data from ${url}: ${response.statusText}`);
      return false;
    }
    const nip05Data = await response.json();
    if (!nip05Data.names || !nip05Data.names[name]) {
      console.error(`NIP-05 data does not contain a matching public key for ${name}`);
      return false;
    }
    const nip05Pubkey = nip05Data.names[name];
    return nip05Pubkey === pubkey;
  } catch (error) {
    console.error(`Error validating NIP-05 address: ${error}`);
    return false;
  }
}
__name(validateNIP05, "validateNIP05");
function calculateQueryComplexity(filter) {
  let complexity = 0;
  complexity += (filter.ids?.length || 0) * 1;
  complexity += (filter.authors?.length || 0) * 2;
  complexity += (filter.kinds?.length || 0) * 5;
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith("#") && Array.isArray(values)) {
      complexity += values.length * 10;
    }
  }
  if (!filter.since && !filter.until) {
    complexity *= 2;
  }
  if ((filter.limit || 0) > 1e3) {
    complexity *= 1.5;
  }
  return complexity;
}
__name(calculateQueryComplexity, "calculateQueryComplexity");
async function processEvent(event, sessionId, env) {
  try {
    if (event.kind !== 1059 && checkValidNip052 && event.kind !== 0) {
      const isValidNIP05 = await validateNIP05FromKind0(event.pubkey, env);
      if (!isValidNIP05) {
        console.error(`Event denied. NIP-05 validation failed for pubkey ${event.pubkey}.`);
        return { success: false, message: "invalid: NIP-05 validation failed" };
      }
    }
    if (event.kind === 5) {
      return await processDeletionEvent(event, env);
    }
    return await queueEvent(event, env);
  } catch (error) {
    console.error(`Error processing event: ${error.message}`);
    return { success: false, message: `error: ${error.message}` };
  }
}
__name(processEvent, "processEvent");
var queueLatencySum = 0;
var queueLatencyCount = 0;
var lastBackpressureWarning = 0;
var BACKPRESSURE_LATENCY_THRESHOLD_MS = 500;
var BACKPRESSURE_WARNING_INTERVAL_MS = 6e4;
var BACKPRESSURE_SAMPLE_SIZE = 100;
async function queueEvent(event, env) {
  try {
    const cache = caches.default;
    const cacheKey = new Request(`https://event-cache/${event.id}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return { success: false, message: "duplicate: event already exists" };
    }
    await cache.put(cacheKey, new Response("cached", {
      headers: {
        "Cache-Control": "max-age=3600"
      }
    }));
    const eventData = {
      event,
      timestamp: Date.now()
    };
    const shardNum = Math.abs(hashCode(event.id)) % 50;
    const queueStartTime = Date.now();
    const queueReplicas = ["PRIMARY", "REPLICA_ENAM", "REPLICA_WEUR", "REPLICA_APAC"];
    const selectedQueueIndex = Math.abs(hashCode(event.id + "queue")) % 4;
    const selectedQueue = queueReplicas[selectedQueueIndex];
    const queueName = `INDEXING_QUEUE_${selectedQueue}_${shardNum}`;
    try {
      await env[queueName].send(eventData);
      const queueLatency = Date.now() - queueStartTime;
      queueLatencySum += queueLatency;
      queueLatencyCount++;
      if (queueLatencyCount > BACKPRESSURE_SAMPLE_SIZE) {
        queueLatencySum = queueLatencySum / queueLatencyCount * BACKPRESSURE_SAMPLE_SIZE;
        queueLatencyCount = BACKPRESSURE_SAMPLE_SIZE;
      }
      const avgLatency = queueLatencySum / queueLatencyCount;
      if (avgLatency > BACKPRESSURE_LATENCY_THRESHOLD_MS) {
        const now = Date.now();
        if (now - lastBackpressureWarning > BACKPRESSURE_WARNING_INTERVAL_MS) {
          console.warn(
            `BACKPRESSURE DETECTED: Average queue latency ${avgLatency.toFixed(0)}ms exceeds threshold ${BACKPRESSURE_LATENCY_THRESHOLD_MS}ms. Queues may be backing up. Consider scaling or rate limiting.`
          );
          lastBackpressureWarning = now;
        }
      }
    } catch (err) {
      console.error(`Failed to send event ${event.id} to queues:`, err);
    }
    if (DEBUG2)
      console.log(`Event ${event.id} (kind ${event.kind}) queued to shard ${shardNum} (4 replicas)`);
    return { success: true, message: "Event received and queued for indexing" };
  } catch (error) {
    console.error(`Error queueing event: ${error.message}`);
    console.error(`Event details: ID=${event.id}, Tags count=${event.tags.length}`);
    return { success: false, message: "error: could not queue event" };
  }
}
__name(queueEvent, "queueEvent");
async function processDeletionEvent(event, env) {
  if (DEBUG2)
    console.log(`Processing deletion event ${event.id}`);
  const deletedEventIds = event.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);
  if (deletedEventIds.length === 0) {
    return { success: true, message: "No events to delete" };
  }
  let deletedCount = 0;
  const errors2 = [];
  if (env.NOSTR_ARCHIVE) {
    const r2Promises = deletedEventIds.map((eventId) => {
      const eventPath = `events/raw/${eventId}.json`;
      return env.NOSTR_ARCHIVE.get(eventPath).then((obj) => ({ eventId, eventPath, obj }));
    });
    const r2Results = await Promise.all(r2Promises);
    const { getEventShardId: getEventShardId2, getAllReplicaShardIds: getAllReplicaShardIds2 } = await Promise.resolve().then(() => (init_shard_router(), shard_router_exports));
    for (const { eventId, eventPath, obj: r2Object } of r2Results) {
      try {
        if (r2Object) {
          const existingEvent = JSON.parse(await r2Object.text());
          if (existingEvent.pubkey !== event.pubkey) {
            console.warn(`Event ${eventId} does not belong to pubkey ${event.pubkey}. Skipping deletion.`);
            errors2.push(`unauthorized: cannot delete event ${eventId}`);
            continue;
          }
          await env.NOSTR_ARCHIVE.delete(eventPath);
          const baseShardId = getEventShardId2(existingEvent);
          const replicaShardIds = getAllReplicaShardIds2(baseShardId);
          const deletePromises = replicaShardIds.map(async (replicaShardId) => {
            try {
              const shardStub = env.EVENT_SHARD_DO.get(env.EVENT_SHARD_DO.idFromName(replicaShardId));
              const response = await shardStub.fetch("https://internal/delete-events", {
                method: "POST",
                headers: { "Content-Type": "application/msgpack" },
                body: pack({ eventIds: [eventId] })
              });
              if (response.ok) {
                if (DEBUG2)
                  console.log(`Event ${eventId} deleted from replica ${replicaShardId}`);
                return true;
              } else {
                console.warn(`Failed to delete event ${eventId} from replica ${replicaShardId}: ${response.status}`);
                return false;
              }
            } catch (error) {
              console.error(`Error deleting from replica ${replicaShardId}:`, error.message);
              return false;
            }
          });
          const deleteResults = await Promise.all(deletePromises);
          const successCount = deleteResults.filter((r) => r).length;
          if (successCount > 0) {
            deletedCount++;
            if (DEBUG2)
              console.log(`Event ${eventId} deleted from R2 and ${successCount}/${replicaShardIds.length} replicas`);
          } else {
            console.warn(`Failed to delete event ${eventId} from all replicas`);
          }
        } else {
          console.warn(`Event ${eventId} not found in R2, skipping`);
        }
      } catch (error) {
        console.error(`Error deleting event ${eventId}:`, error);
        errors2.push(`error deleting ${eventId}: ${error.message}`);
      }
    }
  }
  await queueEvent(event, env);
  if (errors2.length > 0 && deletedCount === 0) {
    return { success: false, message: errors2[0] };
  }
  return {
    success: true,
    message: deletedCount > 0 ? `Successfully deleted ${deletedCount} event(s)` : "No matching events found to delete"
  };
}
__name(processDeletionEvent, "processDeletionEvent");
async function queryEvents(filters, env, subscriptionId) {
  const normalizedFilters = JSON.stringify(filters.map((f) => ({
    ...f,
    since: f.since ? Math.floor(f.since / 60) * 60 : void 0,
    until: f.until ? Math.floor(f.until / 60) * 60 : void 0
  })));
  const cacheKey = new Request(`https://query-cache/${normalizedFilters}`);
  try {
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      const cachedResult = await cached.json();
      return cachedResult;
    }
  } catch (error) {
    console.error("Error checking cache:", error);
  }
  try {
    const processedFilters = filters.map((filter) => {
      const complexity = calculateQueryComplexity(filter);
      if (complexity > MAX_QUERY_COMPLEXITY) {
        console.warn(`Query too complex (complexity: ${complexity}), skipping filter`);
        return null;
      }
      const maxTimeRangeSeconds = MAX_TIME_WINDOWS_PER_QUERY2 * 24 * 60 * 60;
      const now = Math.floor(Date.now() / 1e3);
      let since = filter.since;
      let until = filter.until || now;
      if (!since) {
        const defaultDays = MAX_TIME_WINDOWS_PER_QUERY2;
        since = now - defaultDays * 24 * 60 * 60;
      }
      const requestedRange = until - since;
      if (requestedRange > maxTimeRangeSeconds) {
        since = until - maxTimeRangeSeconds;
      }
      return { ...filter, since, until };
    }).filter((f) => f !== null);
    if (processedFilters.length === 0) {
      console.warn("All filters were too complex, returning empty result");
      return { events: [] };
    }
    const allEventIds = [];
    const allShardMapping = /* @__PURE__ */ new Map();
    const { queryShards: queryShards2 } = await Promise.resolve().then(() => (init_shard_router(), shard_router_exports));
    const filterPromises = processedFilters.map(async (filter) => {
      return await queryShards2(env, filter, subscriptionId);
    });
    const filterResults = await Promise.all(filterPromises);
    const seen = /* @__PURE__ */ new Set();
    const events = [];
    for (const result2 of filterResults) {
      for (const id of result2.eventIds) {
        if (!seen.has(id)) {
          seen.add(id);
          allEventIds.push(id);
        }
      }
      for (const event of result2.events || []) {
        if (event && !events.find((e) => e.id === event.id)) {
          events.push(event);
        }
      }
      for (const [shardId, eventIds] of result2.shardMapping.entries()) {
        const existing = allShardMapping.get(shardId) || [];
        const combined = /* @__PURE__ */ new Set([...existing, ...eventIds]);
        allShardMapping.set(shardId, Array.from(combined));
      }
    }
    events.sort((a, b) => b.created_at - a.created_at);
    const requestedLimit = processedFilters.reduce((max, filter) => {
      const filterLimit = filter.limit ?? GLOBAL_MAX_EVENTS;
      return Math.max(max, filterLimit);
    }, 0);
    const finalLimit = Math.min(requestedLimit, GLOBAL_MAX_EVENTS);
    const limitedEvents = events.slice(0, finalLimit);
    const result = { events: limitedEvents };
    try {
      const cache = caches.default;
      cache.put(cacheKey, new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300"
        }
      })).catch((err) => console.error("Failed to cache query result:", err));
    } catch (error) {
      console.error("Error caching query result:", error);
    }
    return result;
  } catch (error) {
    console.error(`[ShardedCFNDB] Query error: ${error.message}`);
    return { events: [] };
  }
}
__name(queryEvents, "queryEvents");
async function processIndexingQueue(batch, env) {
  if (DEBUG2)
    console.log(`Processing indexing queue batch: ${batch.messages.length} events`);
  const startTime = Date.now();
  const events = batch.messages.map((m) => m.body.event);
  try {
    await indexEventsInCFNDB(env, events);
    batch.messages.forEach((m) => m.ack());
    const duration = Date.now() - startTime;
    if (DEBUG2)
      console.log(`Indexing queue batch completed: ${events.length} events indexed in ${duration}ms (batched)`);
  } catch (error) {
    console.error(`Failed to index batch:`, error.message);
    batch.messages.forEach((m) => m.retry());
  }
}
__name(processIndexingQueue, "processIndexingQueue");
var relay_worker_default = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.searchParams.has("notify-zap") && PAY_TO_RELAY_ENABLED2) {
        return await handlePaymentNotification(request, env);
      }
      if (url.pathname === "/api/check-payment" && PAY_TO_RELAY_ENABLED2) {
        return await handleCheckPayment(request, env);
      }
      if (url.pathname === "/") {
        if (request.headers.get("Upgrade") === "websocket") {
          const doId = CONNECTION_DO_SHARDING_ENABLED2 ? env.CONNECTION_DO.newUniqueId() : env.CONNECTION_DO.idFromName("connection-main");
          const stub = env.CONNECTION_DO.get(doId);
          return stub.fetch(request);
        } else if (request.headers.get("Accept") === "application/nostr+json") {
          return handleRelayInfoRequest(request);
        } else {
          return serveLandingPage();
        }
      } else if (url.pathname === "/.well-known/nostr.json") {
        return handleNIP05Request(url);
      } else if (url.pathname === "/favicon.ico") {
        return await serveFavicon();
      } else {
        return new Response("Invalid request", { status: 400 });
      }
    } catch (error) {
      console.error("Error in fetch handler:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  async queue(batch, env, ctx) {
    try {
      const queueName = batch.queue;
      if (queueName.includes("broadcast")) {
        const broadcastConsumer = await Promise.resolve().then(() => (init_broadcast_consumer(), broadcast_consumer_exports));
        await broadcastConsumer.default.queue(batch, env);
      } else if (queueName.includes("indexing")) {
        await processIndexingQueue(batch, env);
      } else if (queueName.includes("r2-archive")) {
        const r2ArchiveConsumer = await Promise.resolve().then(() => (init_r2_archive_consumer(), r2_archive_consumer_exports));
        await r2ArchiveConsumer.default.queue(batch, env);
      } else {
        console.error(`Unknown queue type: ${queueName}`);
      }
    } catch (error) {
      console.error("Queue processing failed:", error);
    }
  }
};
async function indexEventsInCFNDB(env, events) {
  if (!env.EVENT_SHARD_DO) {
    throw new Error("EVENT_SHARD_DO not configured");
  }
  if (events.length === 0) {
    return;
  }
  const persistentEvents = events.filter((e) => !(e.kind >= 2e4 && e.kind < 3e4));
  const ephemeralCount = events.length - persistentEvents.length;
  if (ephemeralCount > 0) {
    if (DEBUG2)
      console.log(`Filtered ${ephemeralCount} ephemeral events (kinds 20000-29999)`);
  }
  if (persistentEvents.length === 0) {
    console.log("All events were ephemeral, nothing to index");
    return;
  }
  const { insertEventsIntoShard: insertEventsIntoShard2, getEventShardId: getEventShardId2 } = await Promise.resolve().then(() => (init_shard_router(), shard_router_exports));
  const eventsByShardId = /* @__PURE__ */ new Map();
  for (const event of persistentEvents) {
    const shardId = getEventShardId2(event);
    if (!eventsByShardId.has(shardId)) {
      eventsByShardId.set(shardId, []);
    }
    eventsByShardId.get(shardId).push(event);
  }
  const indexPromises = [];
  for (const [shardId, shardEvents] of eventsByShardId) {
    indexPromises.push(insertEventsIntoShard2(env, shardEvents));
  }
  const results = await Promise.all(indexPromises);
  const failedCount = results.filter((r) => r === false).length;
  if (failedCount > 0) {
    throw new Error(
      `Replica write failed for ${failedCount}/${results.length} time shards. Event IDs: ${persistentEvents.slice(0, 5).map((e) => e.id).join(", ")}${persistentEvents.length > 5 ? "..." : ""}`
    );
  }
  if (env.R2_ARCHIVE_QUEUE && env.NOSTR_ARCHIVE) {
    const archivePromises = persistentEvents.map((event) => {
      return env.R2_ARCHIVE_QUEUE.send({
        event,
        timestamp: Date.now()
      });
    });
    try {
      await Promise.all(archivePromises);
      if (DEBUG2)
        console.log(`Queued ${persistentEvents.length} events for R2 archival`);
    } catch (err) {
      console.error(`Failed to queue ${persistentEvents.length} events for R2 archival:`, err);
    }
  }
  if (DEBUG2)
    console.log(`Batch: ${persistentEvents.length} events indexed across ${eventsByShardId.size} time shards (R2 archival queued)`);
}
__name(indexEventsInCFNDB, "indexEventsInCFNDB");
function handleRelayInfoRequest(request) {
  const responseInfo = { ...relayInfo2 };
  if (PAY_TO_RELAY_ENABLED2) {
    const url = new URL(request.url);
    responseInfo.payments_url = `${url.protocol}//${url.host}`;
    responseInfo.fees = {
      admission: [{ amount: RELAY_ACCESS_PRICE_SATS2 * 1e3, unit: "msats" }]
    };
  }
  return new Response(JSON.stringify(responseInfo), {
    status: 200,
    headers: {
      "Content-Type": "application/nostr+json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET"
    }
  });
}
__name(handleRelayInfoRequest, "handleRelayInfoRequest");
function serveLandingPage() {
  const payToRelaySection = PAY_TO_RELAY_ENABLED2 ? `
    <div class="pay-section" id="paySection">
      <p style="margin-bottom: 1rem;">Pay to access this relay:</p>
      <button id="payButton" class="pay-button" data-npub="${relayNpub2}" data-relays="wss://relay.damus.io,wss://relay.primal.net,wss://sendit.nosflare.com" data-sats-amount="${RELAY_ACCESS_PRICE_SATS2}">
        <img src="https://nosflare.com/images/pwb-button-min.png" alt="Pay with Bitcoin" style="height: 60px;">
      </button>
      <p class="price-info">${RELAY_ACCESS_PRICE_SATS2.toLocaleString()} sats</p>
    </div>
    <div class="info-box" id="accessSection" style="display: none;">
      <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
      <div class="url-display" onclick="copyToClipboard()" id="relay-url">
      </div>
      <p class="copy-hint">Click to copy</p>
    </div>
  ` : `
    <div class="info-box">
      <p style="margin-bottom: 1rem;">Connect your Nostr client to:</p>
      <div class="url-display" onclick="copyToClipboard()" id="relay-url">
      </div>
      <p class="copy-hint">Click to copy</p>
    </div>
  `;
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="A serverless Nostr relay powered by Cloudflare Workers and Durable Objects" />
    <title>Nosflare - Nostr Relay</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }

        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 20% 50%, rgba(255, 69, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 50%, rgba(255, 140, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 50% 100%, rgba(255, 0, 0, 0.05) 0%, transparent 50%);
            animation: pulse 10s ease-in-out infinite;
            z-index: -1;
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }

        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
            z-index: 1;
        }

        .logo {
            width: 400px;
            height: auto;
            filter: drop-shadow(0 0 30px rgba(255, 69, 0, 0.5));
        }

        .tagline {
            font-size: 1.2rem;
            color: #999;
            margin-bottom: 3rem;
        }

        .info-box, .pay-section {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
        }

        .pay-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            margin: 1rem 0;
            transition: transform 0.3s ease;
        }

        .pay-button:hover {
            transform: scale(1.05);
        }

        .price-info {
            font-size: 1.2rem;
            color: #ff8c00;
            font-weight: 600;
        }

        .url-display {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 69, 0, 0.3);
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Courier New', monospace;
            font-size: 1.1rem;
            color: #ff8c00;
            margin: 1rem 0;
            word-break: break-all;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .url-display:hover {
            border-color: #ff4500;
            background: rgba(255, 69, 0, 0.1);
        }

        .copy-hint {
            margin-top: 0.5rem;
            font-size: 0.9rem;
            color: #666;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
        }

        .stat-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1rem;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #ff4500;
        }

        .stat-label {
            font-size: 0.9rem;
            color: #999;
            margin-top: 0.25rem;
        }

        .links {
            display: flex;
            gap: 2rem;
            justify-content: center;
            margin-top: 2rem;
        }

        .link {
            color: #ff8c00;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .link:hover {
            color: #ff4500;
        }

        .toast {
            position: fixed;
            bottom: 2rem;
            background: #ff4500;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            transform: translateY(100px);
            transition: transform 0.3s ease;
            z-index: 1000;
        }

        .toast.show {
            transform: translateY(0);
        }

        @media (max-width: 600px) {
            .logo {
                width: 300px;
            }

            .container {
                padding: 1rem;
            }

            .url-display {
                font-size: 0.9rem;
                padding: 0.75rem 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://nosflare.com/images/nosflare.png" alt="Nosflare Logo" class="logo">
        <p class="tagline">A serverless Nostr relay powered by Cloudflare</p>

        ${payToRelaySection}

        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${relayInfo.supported_nips.length}</div>
                <div class="stat-label">Supported NIPs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${relayInfo.version}</div>
                <div class="stat-label">Version</div>
            </div>
        </div>

        <div class="links">
            <a href="https://github.com/Spl0itable/nosflare-cfndb" class="link" target="_blank">GitHub</a>
            <a href="https://nostr.com" class="link" target="_blank">Learn about Nostr</a>
        </div>
    </div>

    <div class="toast" id="toast">Copied to clipboard!</div>

    <script>
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const relayUrl = protocol + '//' + window.location.host;
        const relayUrlElement = document.getElementById('relay-url');
        if (relayUrlElement) {
            relayUrlElement.textContent = relayUrl;
        }

        function copyToClipboard() {
            const relayUrl = document.getElementById('relay-url').textContent;
            navigator.clipboard.writeText(relayUrl).then(() => {
                const toast = document.getElementById('toast');
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 2000);
            });
        }

        ${PAY_TO_RELAY_ENABLED2 ? `
        let paymentCheckInterval;

        async function checkPaymentStatus() {
            if (!window.nostr || !window.nostr.getPublicKey) return false;

            try {
                const pubkey = await window.nostr.getPublicKey();
                const response = await fetch('/api/check-payment?pubkey=' + pubkey);
                const data = await response.json();

                if (data.paid) {
                    showRelayAccess();
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error checking payment status:', error);
                return false;
            }
        }

        function showRelayAccess() {
            const paySection = document.getElementById('paySection');
            const accessSection = document.getElementById('accessSection');

            if (paySection && accessSection) {
                paySection.style.transition = 'opacity 0.3s ease-out';
                paySection.style.opacity = '0';

                setTimeout(() => {
                    paySection.style.display = 'none';
                    accessSection.style.display = 'block';
                    accessSection.style.opacity = '0';
                    accessSection.style.transition = 'opacity 0.3s ease-in';

                    void accessSection.offsetHeight;

                    accessSection.style.opacity = '1';
                }, 300);
            }

            if (paymentCheckInterval) {
                clearInterval(paymentCheckInterval);
                paymentCheckInterval = null;
            }
        }

        window.addEventListener('payment-success', async (event) => {
            console.log('Payment success event received');
            setTimeout(() => {
                showRelayAccess();
            }, 500);
        });

        async function initPayment() {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/Spl0itable/nosflare@main/nostr-zap.js';
            script.onload = () => {
                if (window.nostrZap) {
                    window.nostrZap.initTargets('#payButton');

                    document.getElementById('payButton').addEventListener('click', () => {
                        if (!paymentCheckInterval) {
                            paymentCheckInterval = setInterval(async () => {
                                await checkPaymentStatus();
                            }, 3000);
                        }
                    });
                }
            };
            document.head.appendChild(script);

            await checkPaymentStatus();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPayment);
        } else {
            initPayment();
        }
        ` : ""}
    </script>
    ${PAY_TO_RELAY_ENABLED2 ? '<script src="https://unpkg.com/nostr-login@latest/dist/unpkg.js" data-perms="sign_event:1" data-methods="connect,extension,local" data-dark-mode="true"></script>' : ""}
</body>
</html>
  `;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
__name(serveLandingPage, "serveLandingPage");
async function serveFavicon() {
  const response = await fetch(relayInfo2.icon);
  if (response.ok) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "max-age=3600");
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
  return new Response(null, { status: 404 });
}
__name(serveFavicon, "serveFavicon");
function handleNIP05Request(url) {
  const name = url.searchParams.get("name");
  if (!name) {
    return new Response(JSON.stringify({ error: "Missing 'name' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const pubkey = nip05Users2[name.toLowerCase()];
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  const response = {
    names: { [name]: pubkey },
    relays: { [pubkey]: [] }
  };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(handleNIP05Request, "handleNIP05Request");
async function handleCheckPayment(request, env) {
  const url = new URL(request.url);
  const pubkey = url.searchParams.get("pubkey");
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "Missing pubkey" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const paid = await hasPaidForRelay2(pubkey, env);
  return new Response(JSON.stringify({ paid }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(handleCheckPayment, "handleCheckPayment");
async function handlePaymentNotification(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const url = new URL(request.url);
    const pubkey = url.searchParams.get("npub");
    if (!pubkey) {
      return new Response(JSON.stringify({ error: "Missing pubkey" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const success = await savePaidPubkey(pubkey, env);
    return new Response(JSON.stringify({
      success,
      message: success ? "Payment recorded successfully" : "Failed to save payment"
    }), {
      status: success ? 200 : 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Error processing payment notification:", error);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handlePaymentNotification, "handlePaymentNotification");

// src/connection-do.ts
var DEBUG3 = false;
function isEventExpired(event) {
  const expirationTag = event.tags.find((tag) => tag[0] === "expiration");
  if (!expirationTag || !expirationTag[1]) {
    return false;
  }
  const expirationTimestamp = parseInt(expirationTag[1], 10);
  if (isNaN(expirationTimestamp)) {
    return false;
  }
  const currentTimestamp = Math.floor(Date.now() / 1e3);
  return expirationTimestamp < currentTimestamp;
}
__name(isEventExpired, "isEventExpired");
function shouldFilterForPrivacy(event, authenticatedPubkeys) {
  if (event.kind !== 1059) {
    return false;
  }
  if (authenticatedPubkeys.size === 0) {
    return true;
  }
  const pTags = event.tags.filter((tag) => tag[0] === "p" && tag[1]);
  const taggedPubkeys = new Set(pTags.map((tag) => tag[1]));
  for (const pubkey of authenticatedPubkeys) {
    if (taggedPubkeys.has(pubkey)) {
      return false;
    }
  }
  return true;
}
__name(shouldFilterForPrivacy, "shouldFilterForPrivacy");
var _ConnectionDO = class _ConnectionDO {
  constructor(state, env) {
    this.sessions = /* @__PURE__ */ new Map();
    this.paymentCache = /* @__PURE__ */ new Map();
    this.PAYMENT_CACHE_TTL = 1e4;
    this.sessionsDirty = /* @__PURE__ */ new Set();
    this.pendingSubscriptionWrites = /* @__PURE__ */ new Map();
    this.pendingSubscriptionUpdates = /* @__PURE__ */ new Map();
    this.SUBSCRIPTION_WRITE_DELAY_MS = 500;
    this.SUBSCRIPTION_UPDATE_DELAY_MS = 500;
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      try {
        const storedSessions = await this.state.storage.get("sessions");
        if (storedSessions) {
          for (const [sessionId, sessionData] of storedSessions) {
            const sanitizedSubscriptions = /* @__PURE__ */ new Map();
            if (sessionData.subscriptions) {
              for (const [subId, filters] of sessionData.subscriptions) {
                sanitizedSubscriptions.set(subId, this.sanitizeFilters(filters));
              }
            }
            let authenticatedPubkeys = /* @__PURE__ */ new Set();
            if (sessionData.authenticatedPubkeys) {
              const pubkeys = sessionData.authenticatedPubkeys;
              authenticatedPubkeys = new Set(pubkeys.slice(0, 100));
            }
            this.sessions.set(sessionId, {
              subscriptions: sanitizedSubscriptions,
              registeredShards: new Set(sessionData.registeredShards),
              pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
              reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
              authenticatedPubkeys,
              challenge: sessionData.challenge,
              host: sessionData.host || ""
            });
          }
        }
      } catch (err) {
        console.error("Failed to load sessions from storage, clearing all storage:", err);
        try {
          await this.state.storage.deleteAll();
        } catch (deleteErr) {
          console.error("Failed to clear storage:", deleteErr);
        }
        console.error("Failed to load sessions from storage, clearing:", err);
        await this.state.storage.delete("sessions");
        this.sessions.clear();
      }
      for (const [sessionId, session] of this.sessions) {
        if (session.subscriptions.size > 0) {
          this.updateSubscriptionsForSession(sessionId).catch(
            (err) => console.error(`Failed to re-sync subscriptions for session ${sessionId} on wake:`, err)
          );
        }
      }
    });
  }
  getOrCreateSession(sessionId, host = "") {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        subscriptions: /* @__PURE__ */ new Map(),
        registeredShards: /* @__PURE__ */ new Set(),
        pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
        reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
        authenticatedPubkeys: /* @__PURE__ */ new Set(),
        challenge: void 0,
        host
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/broadcast" && request.method === "POST") {
      return await this.handleBroadcast(request);
    }
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    const host = request.headers.get("host") || url.host;
    const sessionId = crypto.randomUUID();
    const session = this.getOrCreateSession(sessionId, host);
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    const attachment = {
      sessionId,
      host,
      connectedAt: Date.now()
    };
    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server);
    await this.persistSessions();
    if (AUTH_REQUIRED) {
      session.challenge = crypto.randomUUID();
      this.sendAuth(server, session.challenge);
    }
    if (DEBUG3)
      console.log(`ConnectionDO: New session ${sessionId}`);
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  sanitizeFilters(filters) {
    return filters.map((filter) => {
      const sanitized = { ...filter };
      if (sanitized.ids && sanitized.ids.length > 5e3) {
        sanitized.ids = sanitized.ids.slice(0, 5e3);
      }
      if (sanitized.authors && sanitized.authors.length > 5e3) {
        sanitized.authors = sanitized.authors.slice(0, 5e3);
      }
      if (sanitized.kinds && sanitized.kinds.length > 100) {
        sanitized.kinds = sanitized.kinds.slice(0, 100);
      }
      for (const key of Object.keys(sanitized)) {
        if (key.startsWith("#") && Array.isArray(sanitized[key])) {
          if (sanitized[key].length > 2500) {
            sanitized[key] = sanitized[key].slice(0, 2500);
          }
        }
      }
      return sanitized;
    });
  }
  async persistSessions() {
    const activeSessionIds = /* @__PURE__ */ new Set();
    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment?.sessionId) {
        activeSessionIds.add(attachment.sessionId);
      }
    }
    const sessionsData = [];
    for (const [sessionId, session] of this.sessions) {
      if (!activeSessionIds.has(sessionId)) {
        continue;
      }
      const sanitizedSubscriptions = [];
      for (const [subId, filters] of session.subscriptions) {
        if (sanitizedSubscriptions.length >= 50)
          break;
        sanitizedSubscriptions.push([subId, this.sanitizeFilters(filters)]);
      }
      const limitedAuthPubkeys = Array.from(session.authenticatedPubkeys).slice(0, 100);
      sessionsData.push([sessionId, {
        subscriptions: sanitizedSubscriptions,
        registeredShards: Array.from(session.registeredShards).slice(0, 100),
        authenticatedPubkeys: limitedAuthPubkeys,
        challenge: session.challenge,
        host: session.host
      }]);
      if (sessionsData.length >= 500)
        break;
    }
    await this.state.storage.put("sessions", sessionsData);
  }
  async webSocketMessage(ws, message) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      console.error("No attachment found");
      ws.close(1011, "Session not found");
      return;
    }
    try {
      let parsedMessage;
      if (typeof message === "string") {
        parsedMessage = JSON.parse(message);
      } else {
        const decoder2 = new TextDecoder();
        const text = decoder2.decode(message);
        parsedMessage = JSON.parse(text);
      }
      await this.handleMessage(ws, parsedMessage);
    } catch (error) {
      console.error("Error handling message:", error);
      if (error instanceof SyntaxError) {
        this.sendError(ws, "Invalid JSON format");
      } else {
        this.sendError(ws, "Failed to process message");
      }
    }
  }
  async webSocketClose(ws, code, reason, wasClean) {
    const attachment = ws.deserializeAttachment();
    if (attachment) {
      const { sessionId } = attachment;
      if (DEBUG3)
        console.log(`ConnectionDO: Session ${sessionId} closed`);
      const pendingWrite = this.pendingSubscriptionWrites.get(sessionId);
      if (pendingWrite) {
        clearTimeout(pendingWrite);
        this.pendingSubscriptionWrites.delete(sessionId);
      }
      const pendingUpdate = this.pendingSubscriptionUpdates.get(sessionId);
      if (pendingUpdate) {
        clearTimeout(pendingUpdate);
        this.pendingSubscriptionUpdates.delete(sessionId);
      }
      await this.flushSubscriptionWriteForSession(sessionId);
      await this.unregisterSessionFromShards(sessionId).catch(
        (err) => console.error(`Failed to unregister session ${sessionId}:`, err)
      );
      this.sessions.delete(sessionId);
      this.sessionsDirty.delete(sessionId);
      await this.persistSessions();
    }
  }
  async webSocketError(ws, error) {
    console.error("WebSocket error:", error);
  }
  scheduleSubscriptionWriteForSession(sessionId) {
    this.sessionsDirty.add(sessionId);
    if (this.pendingSubscriptionWrites.has(sessionId)) {
      return;
    }
    const timer = setTimeout(async () => {
      this.pendingSubscriptionWrites.delete(sessionId);
      await this.flushSubscriptionWriteForSession(sessionId);
    }, this.SUBSCRIPTION_WRITE_DELAY_MS);
    this.pendingSubscriptionWrites.set(sessionId, timer);
  }
  async flushSubscriptionWriteForSession(sessionId) {
    if (!this.sessionsDirty.has(sessionId)) {
      return;
    }
    this.sessionsDirty.delete(sessionId);
    try {
      await this.persistSessions();
    } catch (err) {
      console.error(`Failed to persist sessions to storage:`, err);
      this.sessionsDirty.add(sessionId);
    }
  }
  scheduleSubscriptionUpdateForSession(sessionId) {
    if (this.pendingSubscriptionUpdates.has(sessionId)) {
      return;
    }
    const timer = setTimeout(async () => {
      this.pendingSubscriptionUpdates.delete(sessionId);
      await this.updateSubscriptionsForSession(sessionId).catch(
        (err) => console.error(`Failed to update subscriptions for session ${sessionId}:`, err)
      );
    }, this.SUBSCRIPTION_UPDATE_DELAY_MS);
    this.pendingSubscriptionUpdates.set(sessionId, timer);
  }
  getRequiredShardsForSession(sessionId) {
    const requiredShards = /* @__PURE__ */ new Set();
    const session = this.getSession(sessionId);
    if (!session)
      return requiredShards;
    for (const [subscriptionId, filters] of session.subscriptions) {
      for (const filter of filters) {
        if (filter.kinds && filter.kinds.length > 0) {
          for (const kind of filter.kinds) {
            requiredShards.add(kind % SESSION_MANAGER_SHARD_COUNT);
          }
        }
      }
    }
    return requiredShards;
  }
  async unregisterSessionFromShards(sessionId) {
    const session = this.getSession(sessionId);
    if (!session)
      return;
    const unregisterPromises = Array.from(session.registeredShards).map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);
        await stub.fetch("https://internal/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/msgpack" },
          body: pack({
            sessionId
          })
        });
      } catch (error) {
        console.error(`Failed to unregister session ${sessionId} from shard ${shardNum}:`, error);
      }
    });
    await Promise.all(unregisterPromises);
    session.registeredShards.clear();
  }
  async updateSubscriptionsForSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session)
      return;
    const requiredShards = this.getRequiredShardsForSession(sessionId);
    const shardToSubscriptions = /* @__PURE__ */ new Map();
    for (const [subscriptionId, filters] of session.subscriptions) {
      for (const filter of filters) {
        if (filter.kinds && filter.kinds.length > 0) {
          for (const kind of filter.kinds) {
            const shardNum = kind % SESSION_MANAGER_SHARD_COUNT;
            if (!shardToSubscriptions.has(shardNum)) {
              shardToSubscriptions.set(shardNum, []);
            }
            const existing = shardToSubscriptions.get(shardNum);
            if (!existing.find(([id]) => id === subscriptionId)) {
              existing.push([subscriptionId, filters]);
            }
          }
        }
      }
    }
    const updatePromises = Array.from(requiredShards).map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);
        const relevantSubs = shardToSubscriptions.get(shardNum) || [];
        await stub.fetch("https://internal/update-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/msgpack" },
          body: pack({
            sessionId,
            connectionDoId: this.state.id.toString(),
            subscriptions: relevantSubs
          })
        });
        session.registeredShards.add(shardNum);
      } catch (error) {
        console.error(`Failed to update subscriptions for session ${sessionId} on shard ${shardNum}:`, error);
      }
    });
    const shardsToUnregister = Array.from(session.registeredShards).filter(
      (shard) => !requiredShards.has(shard)
    );
    const unregisterPromises = shardsToUnregister.map(async (shardNum) => {
      try {
        const id = this.env.SESSION_MANAGER_DO.idFromName(`manager-${shardNum}`);
        const stub = this.env.SESSION_MANAGER_DO.get(id);
        await stub.fetch("https://internal/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/msgpack" },
          body: pack({
            sessionId
          })
        });
        session.registeredShards.delete(shardNum);
      } catch (error) {
        console.error(`Failed to unregister session ${sessionId} from shard ${shardNum}:`, error);
      }
    });
    await Promise.all([...updatePromises, ...unregisterPromises]);
    if (DEBUG3)
      console.log(
        `Session ${sessionId} registered with shards: [${Array.from(session.registeredShards).sort().join(", ")}]`
      );
  }
  async handleBroadcast(request) {
    try {
      const buffer = await request.arrayBuffer();
      const data = unpack(new Uint8Array(buffer));
      const { events } = data;
      const webSockets = this.state.getWebSockets();
      if (webSockets.length === 0) {
        return new Response(pack({ success: false, error: "No active WebSocket" }), {
          status: 400,
          headers: { "Content-Type": "application/msgpack" }
        });
      }
      let sentCount = 0;
      for (const ws of webSockets) {
        const attachment = ws.deserializeAttachment();
        if (!attachment)
          continue;
        const session = this.getSession(attachment.sessionId);
        if (!session)
          continue;
        for (const preSerializedEvent of events) {
          if (isEventExpired(preSerializedEvent.event)) {
            continue;
          }
          if (shouldFilterForPrivacy(preSerializedEvent.event, session.authenticatedPubkeys)) {
            continue;
          }
          for (const [subscriptionId, filters] of session.subscriptions) {
            if (this.matchesFilters(preSerializedEvent.event, filters)) {
              this.sendPreSerializedEvent(ws, subscriptionId, preSerializedEvent.serializedJson);
              sentCount++;
            }
          }
        }
      }
      return new Response(pack({ success: true, sentCount }), {
        headers: { "Content-Type": "application/msgpack" }
      });
    } catch (error) {
      console.error("Error handling broadcast:", error);
      return new Response(pack({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/msgpack" }
      });
    }
  }
  async handleMessage(ws, message) {
    if (!Array.isArray(message)) {
      this.sendError(ws, "Invalid message format: expected JSON array");
      return;
    }
    const [type, ...args] = message;
    try {
      switch (type) {
        case "EVENT":
          await this.handleEvent(ws, args[0]);
          break;
        case "REQ":
          await this.handleReq(ws, message);
          break;
        case "CLOSE":
          await this.handleCloseSubscription(ws, args[0]);
          break;
        case "AUTH":
          await this.handleAuth(ws, args[0]);
          break;
        default:
          this.sendError(ws, `Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type} message:`, error);
      this.sendError(ws, `Failed to process ${type} message`);
    }
  }
  async handleEvent(ws, event) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      this.sendOK(ws, "", false, "error: session not found");
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendOK(ws, "", false, "error: session not found");
      return;
    }
    try {
      if (!event || typeof event !== "object") {
        this.sendOK(ws, "", false, "invalid: event object required");
        return;
      }
      if (!event.id || !event.pubkey || !event.sig || !event.created_at || event.kind === void 0 || !Array.isArray(event.tags) || event.content === void 0) {
        this.sendOK(ws, event.id || "", false, "invalid: missing required fields");
        return;
      }
      if (AUTH_REQUIRED && !session.authenticatedPubkeys.has(event.pubkey)) {
        this.sendOK(ws, event.id, false, "auth-required: please AUTH to publish events");
        return;
      }
      if (!excludedRateLimitKinds.has(event.kind)) {
        if (!session.pubkeyRateLimiter.removeToken()) {
          if (DEBUG3)
            console.log(`Rate limit exceeded for pubkey ${event.pubkey}`);
          this.sendOK(ws, event.id, false, "rate-limited: slow down there chief");
          return;
        }
      }
      const isValidSignature = await verifyEventSignature(event);
      if (!isValidSignature) {
        console.error(`Signature verification failed for event ${event.id}`);
        this.sendOK(ws, event.id, false, "invalid: signature verification failed");
        return;
      }
      if (event.created_at < CREATED_AT_LOWER_LIMIT) {
        console.error(`Event denied. created_at ${event.created_at} is too far in the past (min: ${CREATED_AT_LOWER_LIMIT})`);
        this.sendOK(ws, event.id, false, `invalid: created_at too far in the past`);
        return;
      }
      if (event.created_at > CREATED_AT_UPPER_LIMIT) {
        console.error(`Event denied. created_at ${event.created_at} is too far in the future (max: ${CREATED_AT_UPPER_LIMIT})`);
        this.sendOK(ws, event.id, false, `invalid: created_at too far in the future`);
        return;
      }
      const expirationTag = event.tags.find((tag) => tag[0] === "expiration");
      if (expirationTag && expirationTag[1]) {
        const expirationTimestamp = parseInt(expirationTag[1], 10);
        const currentTimestamp = Math.floor(Date.now() / 1e3);
        if (!isNaN(expirationTimestamp) && expirationTimestamp < currentTimestamp) {
          console.error(`Event denied. Event expired at ${expirationTimestamp} (current: ${currentTimestamp})`);
          this.sendOK(ws, event.id, false, "invalid: event has expired");
          return;
        }
      }
      if (PAY_TO_RELAY_ENABLED) {
        let hasPaid = await this.getCachedPaymentStatus(event.pubkey);
        if (hasPaid === null) {
          hasPaid = await hasPaidForRelay2(event.pubkey, this.env);
          this.setCachedPaymentStatus(event.pubkey, hasPaid);
        }
        if (!hasPaid) {
          console.error(`Event denied. Pubkey ${event.pubkey} has not paid for relay access.`);
          const host = session.host;
          const message = host ? `blocked: payment required. Visit https://${host} to pay for relay access.` : "blocked: payment required. Please visit the relay website to pay for access.";
          this.sendOK(ws, event.id, false, message);
          return;
        }
      }
      if (event.kind !== 1059 && !isPubkeyAllowed(event.pubkey)) {
        console.error(`Event denied. Pubkey ${event.pubkey} is not allowed.`);
        this.sendOK(ws, event.id, false, "blocked: pubkey not allowed");
        return;
      }
      if (!isEventKindAllowed(event.kind)) {
        console.error(`Event denied. Event kind ${event.kind} is not allowed.`);
        this.sendOK(ws, event.id, false, `blocked: event kind ${event.kind} not allowed`);
        return;
      }
      if (containsBlockedContent(event)) {
        console.error("Event denied. Content contains blocked phrases.");
        this.sendOK(ws, event.id, false, "blocked: content contains blocked phrases");
        return;
      }
      for (const tag of event.tags) {
        if (!isTagAllowed(tag[0])) {
          console.error(`Event denied. Tag '${tag[0]}' is not allowed.`);
          this.sendOK(ws, event.id, false, `blocked: tag '${tag[0]}' not allowed`);
          return;
        }
      }
      if (event.kind === 22242) {
        if (DEBUG3)
          console.log(`Rejected kind 22242 event ${event.id}`);
        this.sendOK(ws, event.id, false, "invalid: kind 22242 events are for authentication only");
        return;
      }
      const result = await processEvent(event, sessionId, this.env);
      if (result.success) {
        this.sendOK(ws, event.id, true, result.message);
        const shardNum = event.kind % SESSION_MANAGER_SHARD_COUNT;
        this.env[`BROADCAST_QUEUE_${shardNum}`].send({
          event,
          timestamp: Date.now()
        }).catch((err) => console.error(`Failed to queue broadcast to shard ${shardNum}:`, err));
      } else {
        this.sendOK(ws, event.id, false, result.message);
      }
    } catch (error) {
      console.error("Error handling event:", error);
      this.sendOK(ws, event?.id || "", false, `error: ${error.message}`);
    }
  }
  async handleReq(ws, message) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      this.sendError(ws, "Session not found");
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendError(ws, "Session not found");
      return;
    }
    const [_, subscriptionId, ...filters] = message;
    if (!subscriptionId || typeof subscriptionId !== "string" || subscriptionId === "" || subscriptionId.length > 64) {
      this.sendError(ws, "Invalid subscription ID: must be non-empty string of max 64 chars");
      return;
    }
    if (AUTH_REQUIRED && session.authenticatedPubkeys.size === 0) {
      this.sendClosed(ws, subscriptionId, "auth-required: please AUTH to subscribe");
      return;
    }
    if (!session.reqRateLimiter.removeToken()) {
      console.error(`REQ rate limit exceeded for subscription: ${subscriptionId}`);
      this.sendClosed(ws, subscriptionId, "rate-limited: slow down there chief");
      return;
    }
    if (filters.length === 0) {
      this.sendClosed(ws, subscriptionId, "error: at least one filter required");
      return;
    }
    for (const filter of filters) {
      if (typeof filter !== "object" || filter === null) {
        this.sendClosed(ws, subscriptionId, "invalid: filter must be an object");
        return;
      }
      if (!filter.kinds || filter.kinds.length === 0) {
        this.sendClosed(ws, subscriptionId, "invalid: kinds filter is required");
        return;
      }
      if (filter.ids) {
        for (const id of filter.ids) {
          if (!/^[a-f0-9]{64}$/.test(id)) {
            this.sendClosed(ws, subscriptionId, `invalid: Invalid event ID format: ${id}`);
            return;
          }
        }
      }
      if (filter.authors) {
        if (filter.authors.length > 5e3) {
          this.sendClosed(ws, subscriptionId, "invalid: too many authors (max 5000)");
          return;
        }
        for (const author of filter.authors) {
          if (!/^[a-f0-9]{64}$/.test(author)) {
            this.sendClosed(ws, subscriptionId, `invalid: Invalid author pubkey format: ${author}`);
            return;
          }
        }
      }
      if (filter.kinds) {
        if (filter.kinds.length > 100) {
          this.sendClosed(ws, subscriptionId, "invalid: too many kinds (max 100)");
          return;
        }
        const blockedKinds = filter.kinds.filter((kind) => !isEventKindAllowed(kind));
        if (blockedKinds.length > 0) {
          console.error(`Blocked kinds in subscription: ${blockedKinds.join(", ")}`);
          this.sendClosed(ws, subscriptionId, `blocked: kinds ${blockedKinds.join(", ")} not allowed`);
          return;
        }
      }
      if (filter.ids && filter.ids.length > 5e3) {
        this.sendClosed(ws, subscriptionId, "invalid: too many event IDs (max 5000)");
        return;
      }
      if (filter.limit && filter.limit > 5e3) {
        filter.limit = 5e3;
      } else if (!filter.limit) {
        filter.limit = 5e3;
      }
      for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith("#") && Array.isArray(values)) {
          if (values.length > 2500) {
            this.sendClosed(ws, subscriptionId, `invalid: too many values in ${key} filter (max 2500)`);
            return;
          }
        }
      }
    }
    session.subscriptions.set(subscriptionId, filters);
    this.scheduleSubscriptionWriteForSession(sessionId);
    this.scheduleSubscriptionUpdateForSession(sessionId);
    if (DEBUG3)
      console.log(`New subscription ${subscriptionId} for session ${sessionId}`);
    try {
      const result = await this.getCachedOrQuery(filters, subscriptionId);
      for (const event of result.events) {
        if (!isEventExpired(event) && !shouldFilterForPrivacy(event, session.authenticatedPubkeys)) {
          this.sendEvent(ws, subscriptionId, event);
        }
      }
      this.sendEOSE(ws, subscriptionId);
    } catch (error) {
      console.error(`Error processing REQ for subscription ${subscriptionId}:`, error);
      this.sendClosed(ws, subscriptionId, "error: could not query events");
    }
  }
  async handleCloseSubscription(ws, subscriptionId) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      this.sendError(ws, "Session not found");
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendError(ws, "Session not found");
      return;
    }
    if (!subscriptionId) {
      this.sendError(ws, "Invalid subscription ID for CLOSE");
      return;
    }
    const deleted = session.subscriptions.delete(subscriptionId);
    if (deleted) {
      this.scheduleSubscriptionWriteForSession(sessionId);
      this.scheduleSubscriptionUpdateForSession(sessionId);
      if (DEBUG3)
        console.log(`Closed subscription ${subscriptionId} for session ${sessionId}`);
      this.sendClosed(ws, subscriptionId, "Subscription closed");
    } else {
      this.sendClosed(ws, subscriptionId, "Subscription not found");
    }
  }
  async handleAuth(ws, event) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      this.sendOK(ws, "", false, "error: session not found");
      return;
    }
    const { sessionId } = attachment;
    const session = this.getSession(sessionId);
    if (!session) {
      this.sendOK(ws, "", false, "error: session not found");
      return;
    }
    try {
      if (!event || typeof event !== "object") {
        this.sendOK(ws, "", false, "invalid: auth event object required");
        return;
      }
      if (event.kind !== 22242) {
        this.sendOK(ws, event.id, false, "invalid: auth event must be kind 22242");
        return;
      }
      const isValidSignature = await verifyEventSignature(event);
      if (!isValidSignature) {
        this.sendOK(ws, event.id, false, "invalid: signature verification failed");
        return;
      }
      const now = Math.floor(Date.now() / 1e3);
      const timeDiff = Math.abs(now - event.created_at);
      if (timeDiff > 600) {
        this.sendOK(ws, event.id, false, "invalid: created_at must be within 10 minutes");
        return;
      }
      const challengeTag = event.tags.find((tag) => tag[0] === "challenge");
      if (!challengeTag || challengeTag.length < 2) {
        this.sendOK(ws, event.id, false, "invalid: missing challenge tag");
        return;
      }
      if (!session.challenge) {
        this.sendOK(ws, event.id, false, "invalid: no challenge was issued");
        return;
      }
      if (challengeTag[1] !== session.challenge) {
        this.sendOK(ws, event.id, false, "invalid: challenge mismatch");
        return;
      }
      const relayTag = event.tags.find((tag) => tag[0] === "relay");
      if (!relayTag || relayTag.length < 2) {
        this.sendOK(ws, event.id, false, "invalid: missing relay tag");
        return;
      }
      try {
        const relayUrl = new URL(relayTag[1]);
        const relayHost = relayUrl.host.toLowerCase();
        const expectedHost = session.host.toLowerCase();
        if (relayHost !== expectedHost) {
          this.sendOK(ws, event.id, false, `invalid: relay tag must match this relay (expected ${expectedHost}, got ${relayHost})`);
          return;
        }
      } catch (error) {
        this.sendOK(ws, event.id, false, "invalid: relay tag must be a valid URL");
        return;
      }
      session.authenticatedPubkeys.add(event.pubkey);
      await this.persistSessions();
      if (DEBUG3)
        console.log(`NIP-42: Authenticated pubkey ${event.pubkey} for session ${sessionId}`);
      this.sendOK(ws, event.id, true, "");
    } catch (error) {
      console.error("Error handling AUTH:", error);
      this.sendOK(ws, event?.id || "", false, `error: ${error.message}`);
    }
  }
  async getCachedPaymentStatus(pubkey) {
    const cached = this.paymentCache.get(pubkey);
    if (cached && Date.now() - cached.timestamp < this.PAYMENT_CACHE_TTL) {
      return cached.hasPaid;
    }
    if (cached) {
      this.paymentCache.delete(pubkey);
    }
    return null;
  }
  setCachedPaymentStatus(pubkey, hasPaid) {
    this.paymentCache.set(pubkey, {
      hasPaid,
      timestamp: Date.now()
    });
  }
  async getCachedOrQuery(filters, subscriptionId) {
    return await queryEvents(filters, this.env, subscriptionId);
  }
  matchesFilters(event, filters) {
    return filters.some((filter) => this.matchesFilter(event, filter));
  }
  matchesFilter(event, filter) {
    if (filter.ids && filter.ids.length > 0 && !filter.ids.includes(event.id)) {
      return false;
    }
    if (filter.authors && filter.authors.length > 0 && !filter.authors.includes(event.pubkey)) {
      return false;
    }
    if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(event.kind)) {
      return false;
    }
    if (filter.since && event.created_at < filter.since) {
      return false;
    }
    if (filter.until && event.created_at > filter.until) {
      return false;
    }
    for (const [key, values] of Object.entries(filter)) {
      if (key.startsWith("#") && Array.isArray(values) && values.length > 0) {
        const tagName = key.substring(1);
        const eventTagValues = event.tags.filter((tag) => tag[0] === tagName).map((tag) => tag[1]);
        const hasMatch = values.some((v) => eventTagValues.includes(v));
        if (!hasMatch) {
          return false;
        }
      }
    }
    return true;
  }
  sendOK(ws, eventId, status, message) {
    try {
      const okMessage = ["OK", eventId, status, message || ""];
      ws.send(JSON.stringify(okMessage));
    } catch (error) {
      console.error("Error sending OK:", error);
    }
  }
  sendError(ws, message) {
    try {
      const noticeMessage = ["NOTICE", message];
      ws.send(JSON.stringify(noticeMessage));
    } catch (error) {
      console.error("Error sending NOTICE:", error);
    }
  }
  sendEOSE(ws, subscriptionId) {
    try {
      const eoseMessage = ["EOSE", subscriptionId];
      ws.send(JSON.stringify(eoseMessage));
    } catch (error) {
      console.error("Error sending EOSE:", error);
    }
  }
  sendClosed(ws, subscriptionId, message) {
    try {
      const closedMessage = ["CLOSED", subscriptionId, message];
      ws.send(JSON.stringify(closedMessage));
    } catch (error) {
      console.error("Error sending CLOSED:", error);
    }
  }
  sendEvent(ws, subscriptionId, event) {
    try {
      const eventMessage = ["EVENT", subscriptionId, event];
      ws.send(JSON.stringify(eventMessage));
    } catch (error) {
      console.error("Error sending EVENT:", error);
    }
  }
  sendPreSerializedEvent(ws, subscriptionId, preSerializedEventJson) {
    try {
      const fullMessage = `["EVENT",${JSON.stringify(subscriptionId)},${preSerializedEventJson}]`;
      ws.send(fullMessage);
    } catch (error) {
      console.error("Error sending pre-serialized EVENT:", error);
    }
  }
  sendAuth(ws, challenge2) {
    try {
      const authMessage = ["AUTH", challenge2];
      ws.send(JSON.stringify(authMessage));
      if (DEBUG3)
        console.log(`Sent AUTH challenge: ${challenge2}`);
    } catch (error) {
      console.error("Error sending AUTH:", error);
    }
  }
};
__name(_ConnectionDO, "ConnectionDO");
var ConnectionDO = _ConnectionDO;

// src/session-manager-do.ts
init_msgpackr();
var DEBUG4 = false;
var MAX_BROADCAST_BATCH_SIZE = 900;
var SESSION_TTL_MS = 30 * 60 * 1e3;
var CLEANUP_INTERVAL_MS = 5 * 60 * 1e3;
var _SessionManagerDO = class _SessionManagerDO {
  constructor(state, env) {
    this.sessions = /* @__PURE__ */ new Map();
    this.kindIndex = /* @__PURE__ */ new Map();
    this.authorIndex = /* @__PURE__ */ new Map();
    this.tagIndex = /* @__PURE__ */ new Map();
    this.state = state;
    this.env = env;
    this.state.storage.getAlarm().then(async (alarm) => {
      if (!alarm) {
        await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
      }
    });
    console.log("SessionManagerDO: Started (ephemeral mode - no storage)");
  }
  async alarm() {
    const now = Date.now();
    const staleThreshold = now - SESSION_TTL_MS;
    let cleanedCount = 0;
    for (const [sessionId, sessionData] of this.sessions) {
      if (sessionData.lastActiveAt < staleThreshold) {
        this.removeFromIndices(sessionId, sessionData.subscriptions);
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`SessionManagerDO: Cleaned up ${cleanedCount} stale sessions (TTL: ${SESSION_TTL_MS / 6e4}min)`);
    }
    await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
  }
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/register" && request.method === "POST") {
        return await this.handleRegister(request);
      }
      if (url.pathname === "/unregister" && request.method === "POST") {
        return await this.handleUnregister(request);
      }
      if (url.pathname === "/update-subscriptions" && request.method === "POST") {
        return await this.handleUpdateSubscriptions(request);
      }
      if (url.pathname === "/process-events" && request.method === "POST") {
        return await this.handleProcessEvents(request);
      }
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("SessionManagerDO error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  rebuildIndicesForSession(sessionId, subscriptions) {
    for (const [subscriptionId, filters] of subscriptions) {
      for (const filter of filters) {
        if (filter.kinds) {
          for (const kind of filter.kinds) {
            if (!this.kindIndex.has(kind)) {
              this.kindIndex.set(kind, /* @__PURE__ */ new Set());
            }
            this.kindIndex.get(kind).add(sessionId);
          }
        }
        if (filter.authors) {
          for (const author of filter.authors) {
            if (!this.authorIndex.has(author)) {
              this.authorIndex.set(author, /* @__PURE__ */ new Set());
            }
            this.authorIndex.get(author).add(sessionId);
          }
        }
        for (const [key, values] of Object.entries(filter)) {
          if (key.startsWith("#") && Array.isArray(values)) {
            const tagName = key.substring(1);
            if (["p", "e", "a", "t", "d", "h"].includes(tagName)) {
              for (const value of values) {
                const tagKey = `${tagName}:${value}`;
                if (!this.tagIndex.has(tagKey)) {
                  this.tagIndex.set(tagKey, /* @__PURE__ */ new Set());
                }
                this.tagIndex.get(tagKey).add(sessionId);
              }
            }
          }
        }
      }
    }
  }
  async handleRegister(request) {
    const buffer = await request.arrayBuffer();
    const { sessionId, connectionDoId } = unpack(new Uint8Array(buffer));
    const now = Date.now();
    const sessionData = {
      connectionDoId,
      subscriptions: [],
      registeredAt: now,
      lastActiveAt: now
    };
    this.sessions.set(sessionId, sessionData);
    if (DEBUG4)
      console.log(`Registered session ${sessionId}`);
    return new Response(pack({ success: true }), {
      headers: { "Content-Type": "application/msgpack" }
    });
  }
  async handleUnregister(request) {
    const buffer = await request.arrayBuffer();
    const { sessionId } = unpack(new Uint8Array(buffer));
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      return new Response(pack({ success: true, message: "Session not found" }), {
        headers: { "Content-Type": "application/msgpack" }
      });
    }
    this.removeFromIndices(sessionId, sessionData.subscriptions);
    this.sessions.delete(sessionId);
    if (DEBUG4)
      console.log(`Unregistered session ${sessionId}`);
    return new Response(pack({ success: true }), {
      headers: { "Content-Type": "application/msgpack" }
    });
  }
  removeFromIndices(sessionId, subscriptions) {
    for (const [subscriptionId, filters] of subscriptions) {
      for (const filter of filters) {
        if (filter.kinds) {
          for (const kind of filter.kinds) {
            this.kindIndex.get(kind)?.delete(sessionId);
            if (this.kindIndex.get(kind)?.size === 0) {
              this.kindIndex.delete(kind);
            }
          }
        }
        if (filter.authors) {
          for (const author of filter.authors) {
            this.authorIndex.get(author)?.delete(sessionId);
            if (this.authorIndex.get(author)?.size === 0) {
              this.authorIndex.delete(author);
            }
          }
        }
        for (const [key, values] of Object.entries(filter)) {
          if (key.startsWith("#") && Array.isArray(values)) {
            const tagName = key.substring(1);
            if (["p", "e", "a", "t", "d", "h"].includes(tagName)) {
              for (const value of values) {
                const tagKey = `${tagName}:${value}`;
                this.tagIndex.get(tagKey)?.delete(sessionId);
                if (this.tagIndex.get(tagKey)?.size === 0) {
                  this.tagIndex.delete(tagKey);
                }
              }
            }
          }
        }
      }
    }
  }
  async handleUpdateSubscriptions(request) {
    const buffer = await request.arrayBuffer();
    const { sessionId, connectionDoId, subscriptions } = unpack(new Uint8Array(buffer));
    const now = Date.now();
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      const newSessionData = {
        connectionDoId,
        subscriptions,
        registeredAt: now,
        lastActiveAt: now
      };
      this.sessions.set(sessionId, newSessionData);
      this.rebuildIndicesForSession(sessionId, subscriptions);
      if (DEBUG4)
        console.log(`Created session ${sessionId} with ${subscriptions.length} subscriptions`);
      return new Response(pack({ success: true }), {
        headers: { "Content-Type": "application/msgpack" }
      });
    }
    this.removeFromIndices(sessionId, sessionData.subscriptions);
    sessionData.subscriptions = subscriptions;
    sessionData.lastActiveAt = now;
    this.sessions.set(sessionId, sessionData);
    this.rebuildIndicesForSession(sessionId, subscriptions);
    if (DEBUG4)
      console.log(`Updated session ${sessionId} with ${subscriptions.length} subscriptions`);
    return new Response(pack({ success: true }), {
      headers: { "Content-Type": "application/msgpack" }
    });
  }
  async handleProcessEvents(request) {
    const buffer = await request.arrayBuffer();
    const { events } = unpack(new Uint8Array(buffer));
    if (events.length === 0) {
      return new Response(pack({ success: true, processed: 0 }), {
        headers: { "Content-Type": "application/msgpack" }
      });
    }
    const preSerializedEvents = events.map((event) => ({
      event,
      serializedJson: JSON.stringify(event)
    }));
    const connectionToEvents = /* @__PURE__ */ new Map();
    for (const preSerializedEvent of preSerializedEvents) {
      const event = preSerializedEvent.event;
      const matchingConnectionIds = /* @__PURE__ */ new Set();
      const kindSessions = this.kindIndex.get(event.kind);
      if (kindSessions) {
        for (const sessionId of kindSessions) {
          const sessionData = this.sessions.get(sessionId);
          if (sessionData) {
            matchingConnectionIds.add(sessionData.connectionDoId);
          }
        }
      }
      const authorSessions = this.authorIndex.get(event.pubkey);
      if (authorSessions) {
        for (const sessionId of authorSessions) {
          const sessionData = this.sessions.get(sessionId);
          if (sessionData) {
            matchingConnectionIds.add(sessionData.connectionDoId);
          }
        }
      }
      for (const tag of event.tags) {
        if (tag.length >= 2 && ["p", "e", "a", "t", "d", "h"].includes(tag[0])) {
          const tagKey = `${tag[0]}:${tag[1]}`;
          const tagSessions = this.tagIndex.get(tagKey);
          if (tagSessions) {
            for (const sessionId of tagSessions) {
              const sessionData = this.sessions.get(sessionId);
              if (sessionData) {
                matchingConnectionIds.add(sessionData.connectionDoId);
              }
            }
          }
        }
      }
      for (const connectionDoId of matchingConnectionIds) {
        if (!connectionToEvents.has(connectionDoId)) {
          connectionToEvents.set(connectionDoId, []);
        }
        connectionToEvents.get(connectionDoId).push(preSerializedEvent);
      }
    }
    const connectionEntries = Array.from(connectionToEvents.entries());
    const totalConnections = connectionEntries.length;
    for (let batchStart = 0; batchStart < totalConnections; batchStart += MAX_BROADCAST_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + MAX_BROADCAST_BATCH_SIZE, totalConnections);
      const batch = connectionEntries.slice(batchStart, batchEnd);
      const batchPromises = batch.map(async ([connectionDoId, eventsForConnection]) => {
        try {
          const connectionId = this.env.CONNECTION_DO.idFromString(connectionDoId);
          const connectionStub = this.env.CONNECTION_DO.get(connectionId);
          const payload = { events: eventsForConnection };
          await connectionStub.fetch("https://internal/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/msgpack" },
            body: pack(payload)
          });
        } catch (error) {
          if (DEBUG4)
            console.error(`Failed to broadcast to connection ${connectionDoId}:`, error);
        }
      });
      await Promise.all(batchPromises);
    }
    return new Response(pack({ success: true, processed: events.length, connections: connectionToEvents.size }), {
      headers: { "Content-Type": "application/msgpack" }
    });
  }
};
__name(_SessionManagerDO, "SessionManagerDO");
var SessionManagerDO = _SessionManagerDO;

// src/event-shard-do.ts
init_msgpackr();
var _EventShardDO = class _EventShardDO {
  constructor(state, env) {
    this.kindIndex = /* @__PURE__ */ new Map();
    this.authorIndex = /* @__PURE__ */ new Map();
    this.tagIndex = /* @__PURE__ */ new Map();
    this.pubkeyKindIndex = /* @__PURE__ */ new Map();
    this.tagKindIndex = /* @__PURE__ */ new Map();
    this.createdIndex = null;
    this.contentIndex = /* @__PURE__ */ new Map();
    this.eventContent = /* @__PURE__ */ new Map();
    this.replaceableIndex = /* @__PURE__ */ new Map();
    this.addressableIndex = /* @__PURE__ */ new Map();
    this.channelMetadataIndex = /* @__PURE__ */ new Map();
    this.deletedEvents = /* @__PURE__ */ new Set();
    this.expirationIndex = /* @__PURE__ */ new Map();
    this.trimmedIndices = /* @__PURE__ */ new Set();
    this.eventCache = /* @__PURE__ */ new Map();
    this.MAX_EVENT_CACHE_SIZE = 1e4;
    this.shardStartTime = 0;
    this.shardEndTime = 0;
    this.eventCount = 0;
    this.isStale = false;
    this.insertQueue = [];
    this.isProcessingQueue = false;
    this.queueResolvers = /* @__PURE__ */ new Map();
    this.MAX_EVENTS_PER_SHARD = 5e5;
    this.MAX_INDEX_SIZE = 5e4;
    this.MAX_CREATED_INDEX_SIZE = 2e5;
    this.INDEX_WARNING_THRESHOLD = 4e4;
    this.CREATED_INDEX_WARNING_THRESHOLD = 16e4;
    this.MAX_BATCH_SIZE = 20;
    this.BATCH_DELAY_MS = 50;
    this.MAX_CONTENT_TOKENS = 50;
    this.MIN_TOKEN_LENGTH = 3;
    this.MAX_CONTENT_LENGTH = 500;
    this.EXPIRATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1e3;
    this.STOP_WORDS = /* @__PURE__ */ new Set([
      "the",
      "be",
      "to",
      "of",
      "and",
      "a",
      "in",
      "that",
      "have",
      "it",
      "for",
      "not",
      "on",
      "with",
      "he",
      "as",
      "you",
      "do",
      "at",
      "this",
      "but",
      "his",
      "by",
      "from",
      "they",
      "we",
      "say",
      "her",
      "she",
      "or",
      "an",
      "will",
      "my",
      "one",
      "all",
      "would",
      "there",
      "their",
      "what",
      "so",
      "up",
      "out",
      "if",
      "about",
      "who",
      "get",
      "which",
      "go",
      "me"
    ]);
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
      await this.scheduleExpirationCleanup();
    });
  }
  async scheduleExpirationCleanup() {
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + this.EXPIRATION_CLEANUP_INTERVAL_MS);
    }
  }
  async alarm() {
    console.log(`NIP-40: Running expiration cleanup for shard with ${this.expirationIndex.size} tracked expiring events`);
    const currentTimestamp = Math.floor(Date.now() / 1e3);
    const expiredEventIds = [];
    for (const [eventId, expirationTimestamp] of this.expirationIndex) {
      if (expirationTimestamp <= currentTimestamp) {
        expiredEventIds.push(eventId);
      }
    }
    if (expiredEventIds.length > 0) {
      console.log(`NIP-40: Deleting ${expiredEventIds.length} expired events`);
      const BATCH_SIZE = 50;
      for (let i = 0; i < expiredEventIds.length; i += BATCH_SIZE) {
        const batch = expiredEventIds.slice(i, i + BATCH_SIZE);
        for (const eventId of batch) {
          await this.deleteEventById(eventId);
          this.expirationIndex.delete(eventId);
        }
      }
      await this.state.storage.put("expiration_index", Array.from(this.expirationIndex.entries()));
      await this.state.storage.put("deleted_events", Array.from(this.deletedEvents));
      await this.saveMetadata();
      console.log(`NIP-40: Cleanup complete. Deleted ${expiredEventIds.length} expired events`);
    }
    await this.state.storage.setAlarm(Date.now() + this.EXPIRATION_CLEANUP_INTERVAL_MS);
  }
  isReplaceableKind(kind) {
    return kind === 0 || kind === 3 || kind === 40 || kind >= 1e4 && kind < 2e4;
  }
  isAddressableKind(kind) {
    return kind >= 3e4 && kind < 4e4;
  }
  isChannelMetadataKind(kind) {
    return kind === 41;
  }
  getDTag(event) {
    const dTag = event.tags.find((tag) => tag[0] === "d");
    return dTag?.[1] || "";
  }
  getETag(event) {
    const eTag = event.tags.find((tag) => tag[0] === "e");
    return eTag?.[1] || "";
  }
  getReplaceableKey(kind, pubkey) {
    return `${kind}:${pubkey}`;
  }
  getAddressableKey(kind, pubkey, dTag) {
    return `${kind}:${pubkey}:${dTag}`;
  }
  getChannelMetadataKey(pubkey, eTag) {
    return `41:${pubkey}:${eTag}`;
  }
  getExpirationTimestamp(event) {
    const expirationTag = event.tags.find((tag) => tag[0] === "expiration");
    if (!expirationTag || !expirationTag[1]) {
      return null;
    }
    const timestamp = parseInt(expirationTag[1], 10);
    return isNaN(timestamp) ? null : timestamp;
  }
  isEventFullyIndexed(event) {
    const kindIdx = this.kindIndex.get(event.kind);
    if (!kindIdx?.eventIdSet.has(event.id)) {
      return false;
    }
    const authorIdx = this.authorIndex.get(event.pubkey);
    if (!authorIdx?.eventIdSet.has(event.id)) {
      return false;
    }
    const pubkeyKindMap = this.pubkeyKindIndex.get(event.pubkey);
    if (!pubkeyKindMap?.get(event.kind)?.eventIdSet.has(event.id)) {
      return false;
    }
    if (!this.createdIndex?.eventIdSet.has(event.id)) {
      return false;
    }
    return true;
  }
  tokenizeContent(content) {
    if (!content || content.trim().length === 0) {
      return [];
    }
    const tokens = content.toLowerCase().replace(/[^\w\s#@]/g, " ").split(/\s+/).filter(
      (token) => token.length >= this.MIN_TOKEN_LENGTH && !this.STOP_WORDS.has(token)
    ).slice(0, this.MAX_CONTENT_TOKENS);
    return tokens;
  }
  async loadFromStorage() {
    const startTime = Date.now();
    const [
      metadata,
      deletedData,
      createdData,
      replaceableData,
      addressableData,
      channelMetadataData,
      expirationData,
      kindIndicesData
    ] = await Promise.all([
      this.state.storage.get("metadata"),
      this.state.storage.get("deleted_events"),
      this.state.storage.get("created_index"),
      this.state.storage.list({ prefix: "replaceable:" }),
      this.state.storage.list({ prefix: "addressable:" }),
      this.state.storage.list({ prefix: "channelmeta:" }),
      this.state.storage.get("expiration_index"),
      this.state.storage.list({ prefix: "kind:" })
    ]);
    if (metadata) {
      this.shardStartTime = metadata.shardStartTime;
      this.shardEndTime = metadata.shardEndTime;
      this.eventCount = metadata.eventCount;
      this.isStale = metadata.isStale;
    }
    if (deletedData) {
      this.deletedEvents = new Set(deletedData);
    }
    if (createdData) {
      this.createdIndex = this.deserializeIndex(createdData);
    }
    for (const [key, eventId] of replaceableData) {
      const replaceableKey = key.replace("replaceable:", "");
      this.replaceableIndex.set(replaceableKey, eventId);
    }
    for (const [key, eventId] of addressableData) {
      const addressableKey = key.replace("addressable:", "");
      this.addressableIndex.set(addressableKey, eventId);
    }
    for (const [key, eventId] of channelMetadataData) {
      const channelMetadataKey = key.replace("channelmeta:", "");
      this.channelMetadataIndex.set(channelMetadataKey, eventId);
    }
    if (expirationData) {
      this.expirationIndex = new Map(expirationData);
    }
    for (const [key, indexData] of kindIndicesData) {
      const kind = parseInt(key.replace("kind:", ""), 10);
      if (!isNaN(kind) && indexData) {
        this.kindIndex.set(kind, this.deserializeIndex(indexData));
      }
    }
    console.log(
      `EventShardDO loaded: ${this.eventCount} events, ${this.kindIndex.size} kind indices, ${this.deletedEvents.size} deletions, ${this.replaceableIndex.size} replaceable, ${this.addressableIndex.size} addressable, ${this.channelMetadataIndex.size} channel metadata, ${this.expirationIndex.size} expiring in ${Date.now() - startTime}ms`
    );
  }
  deserializeIndex(stored) {
    return {
      ...stored,
      eventIdSet: new Set(stored.entries.map((e) => e.eventId))
    };
  }
  async ensureKindIndexLoaded(kind) {
    if (!this.kindIndex.has(kind)) {
      const stored = await this.state.storage.get(`kind:${kind}`);
      if (stored) {
        this.kindIndex.set(kind, this.deserializeIndex(stored));
      }
    }
  }
  async ensureAuthorIndexLoaded(pubkey) {
    if (!this.authorIndex.has(pubkey)) {
      const stored = await this.state.storage.get(`author:${pubkey}`);
      if (stored) {
        this.authorIndex.set(pubkey, this.deserializeIndex(stored));
      }
    }
  }
  async ensureTagIndexLoaded(tagKey) {
    if (!this.tagIndex.has(tagKey)) {
      const stored = await this.state.storage.get(`tag:${tagKey}`);
      if (stored) {
        this.tagIndex.set(tagKey, this.deserializeIndex(stored));
      }
    }
  }
  async ensurePubkeyKindIndexLoaded(pubkey, kind) {
    if (!this.pubkeyKindIndex.has(pubkey)) {
      this.pubkeyKindIndex.set(pubkey, /* @__PURE__ */ new Map());
    }
    const kindMap = this.pubkeyKindIndex.get(pubkey);
    if (!kindMap.has(kind)) {
      const stored = await this.state.storage.get(`pubkeykind:${pubkey}:${kind}`);
      if (stored) {
        kindMap.set(kind, this.deserializeIndex(stored));
      }
    }
  }
  async ensureTagKindIndexLoaded(tagKey, kind) {
    if (!this.tagKindIndex.has(tagKey)) {
      this.tagKindIndex.set(tagKey, /* @__PURE__ */ new Map());
    }
    const kindMap = this.tagKindIndex.get(tagKey);
    if (!kindMap.has(kind)) {
      const stored = await this.state.storage.get(`tagkind:${tagKey}:${kind}`);
      if (stored) {
        kindMap.set(kind, this.deserializeIndex(stored));
      }
    }
  }
  async saveMetadata() {
    await this.state.storage.put("metadata", {
      shardStartTime: this.shardStartTime,
      shardEndTime: this.shardEndTime,
      eventCount: this.eventCount,
      isStale: this.isStale
    });
  }
  async triggerBackfillFromReplica0() {
    const currentId = this.state.id.toString();
    const baseShardId = currentId.replace(/-r\d+$/, "");
    const replica0Id = `${baseShardId}-r0`;
    console.log(`Backfill: Copying data from ${replica0Id} to ${currentId}`);
    try {
      const replica0Stub = this.env.EVENT_SHARD_DO.get(this.env.EVENT_SHARD_DO.idFromName(replica0Id));
      const response = await replica0Stub.fetch("https://internal/query", {
        method: "POST",
        headers: { "Content-Type": "application/msgpack" },
        body: pack({
          kinds: void 0,
          authors: void 0,
          limit: 5e5
        })
      });
      if (!response.ok) {
        throw new Error(`Replica 0 query failed: HTTP ${response.status}`);
      }
      const result = unpack(new Uint8Array(await response.arrayBuffer()));
      if (result.events && result.events.length > 0) {
        console.log(`Backfill: Found ${result.events.length} events in ${replica0Id}, inserting...`);
        for (const event of result.events) {
          await this.queueInsert(event);
        }
        console.log(`Backfill: Successfully backfilled ${result.events.length} events to ${currentId}`);
      } else {
        console.log(`Backfill: Replica 0 is empty, no backfill needed`);
      }
      await this.state.storage.put("backfill_completed", true);
    } catch (error) {
      console.error(`Backfill failed for ${currentId}:`, error.message);
      throw error;
    }
  }
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/insert" && request.method === "POST") {
        return await this.handleInsert(request);
      }
      if (path === "/query" && request.method === "POST") {
        return await this.handleQuery(request);
      }
      if (path === "/get-events" && request.method === "POST") {
        return await this.handleGetEvents(request);
      }
      if (path === "/delete-events" && request.method === "POST") {
        return await this.handleDeleteEvents(request);
      }
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("EventShardDO error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  async handleInsert(request) {
    let events;
    try {
      events = unpack(new Uint8Array(await request.arrayBuffer()));
    } catch (error) {
      if (error.message?.includes("client disconnected")) {
        console.log("Client disconnected during insert request");
        return new Response("Client disconnected", { status: 499 });
      }
      throw error;
    }
    const wasEmpty = this.eventCount === 0;
    const promises = events.map((event) => this.queueInsert(event));
    const results = await Promise.all(promises);
    const inserted = results.filter((r) => r).length;
    if (wasEmpty && inserted > 0 && !await this.state.storage.get("backfill_completed")) {
      const replicaId = this.env.DO_NAME || "";
      if (replicaId && !replicaId.endsWith("-r0")) {
        this.triggerBackfillFromReplica0().catch(
          (err) => console.error(`Background backfill failed for ${replicaId}:`, err.message)
        );
      }
    }
    const response = {
      inserted,
      eventCount: this.eventCount,
      isStale: this.isStale
    };
    return new Response(pack(response), {
      headers: { "Content-Type": "application/msgpack" }
    });
  }
  async queueInsert(event) {
    return new Promise((resolve, reject) => {
      this.queueResolvers.set(event.id, { resolve, reject });
      this.insertQueue.push(event);
      if (!this.isProcessingQueue) {
        this.processInsertQueue();
      }
    });
  }
  async processInsertQueue() {
    if (this.isProcessingQueue)
      return;
    this.isProcessingQueue = true;
    try {
      while (this.insertQueue.length > 0) {
        const batch = this.insertQueue.splice(0, this.MAX_BATCH_SIZE);
        await this.processBatchInsert(batch);
        if (this.insertQueue.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY_MS));
        }
      }
    } finally {
      this.isProcessingQueue = false;
      if (this.insertQueue.length > 0) {
        this.processInsertQueue();
      }
    }
  }
  async processBatchInsert(events) {
    const insertedIds = /* @__PURE__ */ new Set();
    const skippedIds = /* @__PURE__ */ new Set();
    const storageBatch = {};
    for (const event of events) {
      try {
        const exists = await this.state.storage.get(`event:${event.id}`);
        if (exists) {
          const isFullyIndexed = this.isEventFullyIndexed(event);
          if (isFullyIndexed) {
            skippedIds.add(event.id);
            continue;
          }
          console.log(`Re-indexing existing event ${event.id} (found in storage but missing from indices)`);
          this.indexEventInBatch(event, storageBatch);
          insertedIds.add(event.id);
          continue;
        }
      } catch (error) {
        console.error(`Error checking existence for event ${event.id}:`, error);
        skippedIds.add(event.id);
        continue;
      }
      if (this.isReplaceableKind(event.kind)) {
        const replaceableKey = this.getReplaceableKey(event.kind, event.pubkey);
        const existingEventId = this.replaceableIndex.get(replaceableKey);
        if (existingEventId) {
          const existingData = await this.state.storage.get(`event:${existingEventId}`);
          if (existingData) {
            try {
              const existingEvent = unpack(existingData);
              const existingCreatedAt = existingEvent.created_at;
              if (existingCreatedAt >= event.created_at) {
                continue;
              }
              await this.deleteEventById(existingEventId);
            } catch (err) {
              console.warn(`MessagePack read failed for ${existingEventId}:`, err);
            }
          }
        }
        this.replaceableIndex.set(replaceableKey, event.id);
        storageBatch[`replaceable:${replaceableKey}`] = event.id;
      }
      if (this.isAddressableKind(event.kind)) {
        const dTag = this.getDTag(event);
        const addressableKey = this.getAddressableKey(event.kind, event.pubkey, dTag);
        const existingEventId = this.addressableIndex.get(addressableKey);
        if (existingEventId) {
          const existingData = await this.state.storage.get(`event:${existingEventId}`);
          if (existingData) {
            try {
              const existingEvent = unpack(existingData);
              const existingCreatedAt = existingEvent.created_at;
              if (existingCreatedAt >= event.created_at) {
                continue;
              }
              await this.deleteEventById(existingEventId);
            } catch (err) {
              console.warn(`MessagePack read failed for ${existingEventId}:`, err);
            }
          }
        }
        this.addressableIndex.set(addressableKey, event.id);
        storageBatch[`addressable:${addressableKey}`] = event.id;
      }
      if (this.isChannelMetadataKind(event.kind)) {
        const eTag = this.getETag(event);
        const channelMetadataKey = this.getChannelMetadataKey(event.pubkey, eTag);
        const existingEventId = this.channelMetadataIndex.get(channelMetadataKey);
        if (existingEventId) {
          const existingData = await this.state.storage.get(`event:${existingEventId}`);
          if (existingData) {
            try {
              const existingEvent = unpack(existingData);
              const existingCreatedAt = existingEvent.created_at;
              if (existingCreatedAt >= event.created_at) {
                continue;
              }
              await this.deleteEventById(existingEventId);
            } catch (err) {
              console.warn(`MessagePack read failed for ${existingEventId}:`, err);
            }
          }
        }
        this.channelMetadataIndex.set(channelMetadataKey, event.id);
        storageBatch[`channelmeta:${channelMetadataKey}`] = event.id;
      }
      const eventData = pack(event);
      storageBatch[`event:${event.id}`] = eventData;
      this.indexEventInBatch(event, storageBatch);
      this.addToEventCache(event);
      this.eventCount++;
      if (!this.shardStartTime || event.created_at * 1e3 < this.shardStartTime) {
        this.shardStartTime = event.created_at * 1e3;
      }
      if (!this.shardEndTime || event.created_at * 1e3 > this.shardEndTime) {
        this.shardEndTime = event.created_at * 1e3;
      }
      insertedIds.add(event.id);
    }
    try {
      if (Object.keys(storageBatch).length > 0) {
        await this.state.storage.put(storageBatch);
      }
      if (insertedIds.size > 0) {
        await this.saveMetadata();
        if (this.eventCount > this.MAX_EVENTS_PER_SHARD) {
          this.isStale = true;
          await this.saveMetadata();
        }
      }
      for (const event of events) {
        const resolver = this.queueResolvers.get(event.id);
        if (resolver) {
          const success = insertedIds.has(event.id) || skippedIds.has(event.id);
          resolver.resolve(success);
          this.queueResolvers.delete(event.id);
        }
      }
    } catch (error) {
      for (const event of events) {
        const resolver = this.queueResolvers.get(event.id);
        if (resolver) {
          resolver.reject(error);
          this.queueResolvers.delete(event.id);
        }
      }
      console.error("Batch insert error:", error);
      throw error;
    }
  }
  indexEventInBatch(event, storageBatch) {
    const entry = {
      eventId: event.id,
      created_at: event.created_at,
      kind: event.kind,
      pubkey: event.pubkey
    };
    this.updateIndexInBatch(this.kindIndex, `kind:${event.kind}`, event.kind, entry, storageBatch);
    this.updateIndexInBatch(this.authorIndex, `author:${event.pubkey}`, event.pubkey, entry, storageBatch);
    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagType = tag[0];
        const tagValue = tag[1];
        const tagKey = `${tagType}:${tagValue}`;
        this.updateIndexInBatch(this.tagIndex, `tag:${tagKey}`, tagKey, entry, storageBatch);
      }
    }
    this.updateCompositeIndexInBatch(
      this.pubkeyKindIndex,
      event.pubkey,
      event.kind,
      `pubkeykind:${event.pubkey}:${event.kind}`,
      entry,
      storageBatch
    );
    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `${tag[0]}:${tag[1]}`;
        this.updateCompositeIndexInBatch(
          this.tagKindIndex,
          tagKey,
          event.kind,
          `tagkind:${tagKey}:${event.kind}`,
          entry,
          storageBatch
        );
      }
    }
    this.updateGlobalCreatedIndexInBatch(entry, storageBatch);
    if (event.kind === 1 && event.content) {
      this.indexContentInBatch(event, storageBatch);
    }
    const expirationTimestamp = this.getExpirationTimestamp(event);
    if (expirationTimestamp !== null) {
      this.expirationIndex.set(event.id, expirationTimestamp);
      storageBatch["expiration_index"] = Array.from(this.expirationIndex.entries());
    }
  }
  findInsertPosition(entries, timestamp) {
    let left = 0;
    let right = entries.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (entries[mid].created_at > timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    return left;
  }
  trimIndexIfNeeded(index, indexName, isCreatedIndex = false) {
    const maxSize = isCreatedIndex ? this.MAX_CREATED_INDEX_SIZE : this.MAX_INDEX_SIZE;
    const warningThreshold = isCreatedIndex ? this.CREATED_INDEX_WARNING_THRESHOLD : this.INDEX_WARNING_THRESHOLD;
    if (index.count === warningThreshold) {
      console.warn(
        `INDEX CAPACITY WARNING: Index "${indexName}" has ${index.count} entries (${Math.round(index.count / maxSize * 100)}% of ${maxSize} limit). Consider increasing index size limit or implementing index archival.`
      );
    }
    if (index.count > maxSize) {
      const untrimmedForStorage = {
        entries: [...index.entries],
        eventIdSet: new Set(index.eventIdSet),
        count: index.count,
        minTime: index.minTime,
        maxTime: index.maxTime,
        lastUpdate: index.lastUpdate
      };
      const removed = index.entries.splice(maxSize);
      for (const r of removed) {
        index.eventIdSet.delete(r.eventId);
      }
      index.count = index.entries.length;
      this.trimmedIndices.add(indexName);
      console.warn(
        `INDEX TRIMMED: Index "${indexName}" exceeded ${maxSize} in-memory limit. Trimmed ${removed.length} oldest entries from memory. Full index (${untrimmedForStorage.count} entries) remains in storage for fallback queries.`
      );
      return { untrimmedForStorage, wasTrimmed: true };
    }
    return { untrimmedForStorage: null, wasTrimmed: false };
  }
  updateIndexInBatch(indexMap, storageKey, mapKey, entry, storageBatch) {
    let index = indexMap.get(mapKey);
    if (!index) {
      index = {
        entries: [],
        eventIdSet: /* @__PURE__ */ new Set(),
        count: 0,
        minTime: entry.created_at,
        maxTime: entry.created_at,
        lastUpdate: Date.now()
      };
      indexMap.set(mapKey, index);
    }
    if (index.eventIdSet.has(entry.eventId)) {
      return;
    }
    const insertPos = this.findInsertPosition(index.entries, entry.created_at);
    index.entries.splice(insertPos, 0, entry);
    index.eventIdSet.add(entry.eventId);
    index.count++;
    index.minTime = Math.min(index.minTime, entry.created_at);
    index.maxTime = Math.max(index.maxTime, entry.created_at);
    index.lastUpdate = Date.now();
    const { untrimmedForStorage, wasTrimmed } = this.trimIndexIfNeeded(index, storageKey);
    const indexToStore = wasTrimmed ? untrimmedForStorage : index;
    const serialized = {
      entries: indexToStore.entries,
      count: indexToStore.count,
      minTime: indexToStore.minTime,
      maxTime: indexToStore.maxTime,
      lastUpdate: indexToStore.lastUpdate
    };
    storageBatch[storageKey] = serialized;
  }
  updateCompositeIndexInBatch(compositeMap, firstKey, kind, storageKey, entry, storageBatch) {
    if (!compositeMap.has(firstKey)) {
      compositeMap.set(firstKey, /* @__PURE__ */ new Map());
    }
    const kindMap = compositeMap.get(firstKey);
    let index = kindMap.get(kind);
    if (!index) {
      index = {
        entries: [],
        eventIdSet: /* @__PURE__ */ new Set(),
        count: 0,
        minTime: entry.created_at,
        maxTime: entry.created_at,
        lastUpdate: Date.now()
      };
      kindMap.set(kind, index);
    }
    if (index.eventIdSet.has(entry.eventId)) {
      return;
    }
    const insertPos = this.findInsertPosition(index.entries, entry.created_at);
    index.entries.splice(insertPos, 0, entry);
    index.eventIdSet.add(entry.eventId);
    index.count++;
    index.minTime = Math.min(index.minTime, entry.created_at);
    index.maxTime = Math.max(index.maxTime, entry.created_at);
    index.lastUpdate = Date.now();
    const { untrimmedForStorage, wasTrimmed } = this.trimIndexIfNeeded(index, storageKey);
    const indexToStore = wasTrimmed ? untrimmedForStorage : index;
    const serialized = {
      entries: indexToStore.entries,
      count: indexToStore.count,
      minTime: indexToStore.minTime,
      maxTime: indexToStore.maxTime,
      lastUpdate: indexToStore.lastUpdate
    };
    storageBatch[storageKey] = serialized;
  }
  updateGlobalCreatedIndexInBatch(entry, storageBatch) {
    if (!this.createdIndex) {
      this.createdIndex = {
        entries: [],
        eventIdSet: /* @__PURE__ */ new Set(),
        count: 0,
        minTime: entry.created_at,
        maxTime: entry.created_at,
        lastUpdate: Date.now()
      };
    }
    if (this.createdIndex.eventIdSet.has(entry.eventId)) {
      return;
    }
    const insertPos = this.findInsertPosition(this.createdIndex.entries, entry.created_at);
    this.createdIndex.entries.splice(insertPos, 0, entry);
    this.createdIndex.eventIdSet.add(entry.eventId);
    this.createdIndex.count++;
    this.createdIndex.minTime = Math.min(this.createdIndex.minTime, entry.created_at);
    this.createdIndex.maxTime = Math.max(this.createdIndex.maxTime, entry.created_at);
    this.createdIndex.lastUpdate = Date.now();
    const { untrimmedForStorage, wasTrimmed } = this.trimIndexIfNeeded(this.createdIndex, "created_index", true);
    const indexToStore = wasTrimmed ? untrimmedForStorage : this.createdIndex;
    const serialized = {
      entries: indexToStore.entries,
      count: indexToStore.count,
      minTime: indexToStore.minTime,
      maxTime: indexToStore.maxTime,
      lastUpdate: indexToStore.lastUpdate
    };
    storageBatch["created_index"] = serialized;
  }
  indexContentInBatch(event, storageBatch) {
    if (!event.content || event.content.trim().length === 0) {
      return;
    }
    const tokens = this.tokenizeContent(event.content);
    for (const token of tokens) {
      let eventSet = this.contentIndex.get(token);
      if (!eventSet) {
        eventSet = /* @__PURE__ */ new Set();
        this.contentIndex.set(token, eventSet);
      }
      eventSet.add(event.id);
      storageBatch[`content:${token}`] = Array.from(eventSet);
    }
    const truncatedContent = event.content.substring(0, this.MAX_CONTENT_LENGTH);
    this.eventContent.set(event.id, truncatedContent);
    storageBatch[`eventcontent:${event.id}`] = truncatedContent;
  }
  searchContent(searchQuery, candidateIds) {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }
    const queryTokens = this.tokenizeContent(searchQuery);
    if (queryTokens.length === 0) {
      return [];
    }
    const eventScores = /* @__PURE__ */ new Map();
    for (const token of queryTokens) {
      const matchingEvents = this.contentIndex.get(token);
      if (!matchingEvents)
        continue;
      for (const eventId of matchingEvents) {
        if (candidateIds && !candidateIds.has(eventId)) {
          continue;
        }
        const currentScore = eventScores.get(eventId) || 0;
        eventScores.set(eventId, currentScore + 1);
      }
    }
    const rankedEvents = Array.from(eventScores.entries()).sort((a, b) => b[1] - a[1]).map(([eventId]) => eventId);
    return rankedEvents;
  }
  async handleQuery(request) {
    let filter;
    try {
      filter = unpack(new Uint8Array(await request.arrayBuffer()));
    } catch (error) {
      if (error.message?.includes("client disconnected")) {
        console.log("Client disconnected during query request");
        return new Response("Client disconnected", { status: 499 });
      }
      throw error;
    }
    const eventIds = await this.executeQuery(filter);
    const events = [];
    if (eventIds.length > 0) {
      const eventMap = /* @__PURE__ */ new Map();
      const missingIds = [];
      for (const id of eventIds) {
        const cached = this.eventCache.get(id);
        if (cached) {
          eventMap.set(id, cached);
        } else {
          missingIds.push(id);
        }
      }
      if (missingIds.length > 0) {
        const storageKeys = missingIds.map((id) => `event:${id}`);
        const eventDataMap = await this.state.storage.get(storageKeys);
        for (const id of missingIds) {
          const eventData = eventDataMap.get(`event:${id}`);
          if (eventData) {
            try {
              const event = unpack(eventData);
              eventMap.set(id, event);
              this.addToEventCache(event);
            } catch (err) {
              console.warn(`Failed to unpack event ${id}:`, err);
            }
          }
        }
      }
      for (const id of eventIds) {
        const event = eventMap.get(id);
        if (event) {
          events.push(event);
        }
      }
    }
    const response = {
      eventIds,
      events,
      count: eventIds.length,
      latencyMs: 0,
      shardInfo: {
        startTime: this.shardStartTime,
        endTime: this.shardEndTime,
        eventCount: this.eventCount,
        isStale: this.isStale
      }
    };
    return new Response(pack(response), {
      headers: { "Content-Type": "application/msgpack" }
    });
  }
  addToEventCache(event) {
    if (this.eventCache.size >= this.MAX_EVENT_CACHE_SIZE) {
      const firstKey = this.eventCache.keys().next().value;
      if (firstKey) {
        this.eventCache.delete(firstKey);
      }
    }
    this.eventCache.set(event.id, event);
  }
  async executeQuery(filter) {
    const since = filter.since ?? 0;
    const until = filter.until ?? Math.floor(Date.now() / 1e3);
    const limit = filter.limit ?? 5e3;
    if (filter.ids && filter.ids.length > 0) {
      const results = [];
      for (const id of filter.ids) {
        if (this.deletedEvents.has(id)) {
          continue;
        }
        const eventData = await this.state.storage.get(`event:${id}`);
        if (!eventData) {
          continue;
        }
        try {
          const event = unpack(eventData);
          if (event.created_at < since || event.created_at > until) {
            continue;
          }
        } catch (err) {
          console.warn(`MessagePack read failed for ${id}, skipping:`, err);
          continue;
        }
        results.push(id);
        if (results.length >= limit) {
          break;
        }
      }
      return results;
    }
    if (filter.kinds?.length === 0 || filter.authors?.length === 0) {
      return [];
    }
    if (filter.tags) {
      for (const tagValues of Object.values(filter.tags)) {
        if (tagValues.length === 0) {
          return [];
        }
      }
    }
    const hasKinds = filter.kinds && filter.kinds.length > 0;
    const hasAuthors = filter.authors && filter.authors.length > 0;
    const hasTags = filter.tags && Object.keys(filter.tags).length > 0;
    const hasSearch = filter.search && filter.search.trim().length > 0;
    if (hasAuthors && filter.authors.length === 1 && hasKinds && !hasTags && !hasSearch) {
      const inMemoryResults2 = await this.queryPubkeyKind(filter.authors[0], filter.kinds, since, until, limit);
      return await this.queryStorageIndices(filter, inMemoryResults2);
    }
    if (hasTags && hasKinds && !hasAuthors && !hasSearch) {
      const tagEntries = Object.entries(filter.tags);
      if (tagEntries.length === 1 && tagEntries[0][1].length === 1) {
        const [tagType, tagValues] = tagEntries[0];
        const tagKey = `${tagType}:${tagValues[0]}`;
        const inMemoryResults2 = await this.queryTagKind(tagKey, filter.kinds, since, until, limit);
        return await this.queryStorageIndices(filter, inMemoryResults2);
      }
    }
    if (!hasKinds && !hasAuthors && !hasTags && !hasSearch) {
      const inMemoryResults2 = this.queryGlobalCreated(since, until, limit);
      return await this.queryStorageIndices(filter, inMemoryResults2);
    }
    if (hasSearch) {
      let candidates2 = null;
      if (hasTags) {
        for (const [tagType, tagValues] of Object.entries(filter.tags)) {
          const tagCandidates = await this.queryCandidatesByTag(tagType, tagValues, since, until);
          candidates2 = candidates2 ? this.intersectSets(candidates2, tagCandidates) : tagCandidates;
        }
      }
      if (hasAuthors) {
        const authorCandidates = await this.queryCandidatesByAuthor(filter.authors, since, until);
        candidates2 = candidates2 ? this.intersectSets(candidates2, authorCandidates) : authorCandidates;
      }
      if (hasKinds) {
        const kindCandidates = await this.queryCandidatesByKind(filter.kinds, since, until);
        candidates2 = candidates2 ? this.intersectSets(candidates2, kindCandidates) : kindCandidates;
      }
      if (!candidates2) {
        candidates2 = await this.queryCandidatesByKind([1], since, until);
      }
      const rankedResults = this.searchContent(filter.search || "", candidates2);
      const inMemoryResults2 = rankedResults.slice(0, limit);
      return await this.queryStorageIndices(filter, inMemoryResults2);
    }
    if (!hasKinds && !hasAuthors && !hasTags) {
      const candidates2 = await this.getAllEventsInTimeRange(since, until);
      const inMemoryResults2 = this.sortAndLimit(Array.from(candidates2), limit);
      return await this.queryStorageIndices(filter, inMemoryResults2);
    }
    let candidates = null;
    if (hasTags) {
      for (const [tagType, tagValues] of Object.entries(filter.tags)) {
        const tagCandidates = await this.queryCandidatesByTag(tagType, tagValues, since, until);
        candidates = candidates ? this.intersectSets(candidates, tagCandidates) : tagCandidates;
      }
    }
    if (hasAuthors) {
      const authorCandidates = await this.queryCandidatesByAuthor(filter.authors, since, until);
      candidates = candidates ? this.intersectSets(candidates, authorCandidates) : authorCandidates;
    }
    if (hasKinds) {
      const kindCandidates = await this.queryCandidatesByKind(filter.kinds, since, until);
      candidates = candidates ? this.intersectSets(candidates, kindCandidates) : kindCandidates;
    }
    const inMemoryResults = this.sortAndLimit(Array.from(candidates || []), limit);
    return await this.queryStorageIndices(filter, inMemoryResults);
  }
  async queryStorageIndices(filter, inMemoryResults) {
    const since = filter.since ?? 0;
    const until = filter.until ?? Math.floor(Date.now() / 1e3);
    const limit = filter.limit ?? 5e3;
    const hasKinds = filter.kinds && filter.kinds.length > 0;
    const hasAuthors = filter.authors && filter.authors.length > 0;
    const hasTags = filter.tags && Object.keys(filter.tags).length > 0;
    let needsFallback = false;
    const storageKeysToLoad = [];
    if (hasKinds) {
      for (const kind of filter.kinds) {
        const storageKey = `kind:${kind}`;
        if (this.trimmedIndices.has(storageKey)) {
          needsFallback = true;
          storageKeysToLoad.push(storageKey);
        }
      }
    }
    if (hasAuthors) {
      for (const author of filter.authors) {
        const storageKey = `author:${author}`;
        if (this.trimmedIndices.has(storageKey)) {
          needsFallback = true;
          storageKeysToLoad.push(storageKey);
        }
      }
    }
    if (hasTags) {
      for (const [tagType, tagValues] of Object.entries(filter.tags)) {
        for (const tagValue of tagValues) {
          const storageKey = `tag:${tagType}:${tagValue}`;
          if (this.trimmedIndices.has(storageKey)) {
            needsFallback = true;
            storageKeysToLoad.push(storageKey);
          }
        }
      }
    }
    if (this.trimmedIndices.has("created_index")) {
      needsFallback = true;
      storageKeysToLoad.push("created_index");
    }
    if (!needsFallback || inMemoryResults.length >= limit) {
      return inMemoryResults;
    }
    console.log(`Storage fallback query: loading ${storageKeysToLoad.length} full indices from storage`);
    const storageResults = await this.state.storage.get(storageKeysToLoad);
    let candidates = null;
    if (hasKinds) {
      for (const kind of filter.kinds) {
        const storageKey = `kind:${kind}`;
        const storedIndex = storageResults.get(storageKey);
        if (storedIndex && storedIndex.entries) {
          const indexCandidates = this.queryCandidatesFromStoredIndex(storedIndex, since, until);
          candidates = candidates ? this.unionSets(candidates, indexCandidates) : indexCandidates;
        }
      }
    }
    if (hasAuthors) {
      const authorCandidates = /* @__PURE__ */ new Set();
      for (const author of filter.authors) {
        const storageKey = `author:${author}`;
        const storedIndex = storageResults.get(storageKey);
        if (storedIndex && storedIndex.entries) {
          const indexCandidates = this.queryCandidatesFromStoredIndex(storedIndex, since, until);
          for (const id of indexCandidates) {
            authorCandidates.add(id);
          }
        }
      }
      candidates = candidates ? this.intersectSets(candidates, authorCandidates) : authorCandidates;
    }
    if (hasTags) {
      for (const [tagType, tagValues] of Object.entries(filter.tags)) {
        const tagCandidates = /* @__PURE__ */ new Set();
        for (const tagValue of tagValues) {
          const storageKey = `tag:${tagType}:${tagValue}`;
          const storedIndex = storageResults.get(storageKey);
          if (storedIndex && storedIndex.entries) {
            const indexCandidates = this.queryCandidatesFromStoredIndex(storedIndex, since, until);
            for (const id of indexCandidates) {
              tagCandidates.add(id);
            }
          }
        }
        candidates = candidates ? this.intersectSets(candidates, tagCandidates) : tagCandidates;
      }
    }
    const inMemorySet = new Set(inMemoryResults);
    if (candidates) {
      for (const id of candidates) {
        inMemorySet.add(id);
      }
    }
    return this.sortAndLimit(Array.from(inMemorySet), limit);
  }
  queryCandidatesFromStoredIndex(storedIndex, since, until) {
    const results = /* @__PURE__ */ new Set();
    if (!storedIndex.entries) {
      return results;
    }
    for (const entry of storedIndex.entries) {
      if (entry.created_at >= since && entry.created_at <= until) {
        if (!this.deletedEvents.has(entry.eventId)) {
          results.add(entry.eventId);
        }
      }
    }
    return results;
  }
  unionSets(setA, setB) {
    const result = new Set(setA);
    for (const item of setB) {
      result.add(item);
    }
    return result;
  }
  async queryCandidatesByKind(kinds, since, until) {
    const results = /* @__PURE__ */ new Set();
    await Promise.all(kinds.map((k) => this.ensureKindIndexLoaded(k)));
    for (const kind of kinds) {
      const index = this.kindIndex.get(kind);
      if (!index)
        continue;
      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }
    return results;
  }
  async queryCandidatesByAuthor(authors, since, until) {
    const results = /* @__PURE__ */ new Set();
    await Promise.all(authors.map((a) => this.ensureAuthorIndexLoaded(a)));
    for (const author of authors) {
      const index = this.authorIndex.get(author);
      if (!index)
        continue;
      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }
    return results;
  }
  async queryCandidatesByTag(tagType, tagValues, since, until) {
    const results = /* @__PURE__ */ new Set();
    const tagKeys = tagValues.map((v) => `${tagType}:${v}`);
    await Promise.all(tagKeys.map((tk) => this.ensureTagIndexLoaded(tk)));
    for (const tagValue of tagValues) {
      const tagKey = `${tagType}:${tagValue}`;
      const index = this.tagIndex.get(tagKey);
      if (!index)
        continue;
      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }
    return results;
  }
  async getAllEventsInTimeRange(since, until) {
    const results = /* @__PURE__ */ new Set();
    for (const [_, index] of this.kindIndex) {
      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.add(entry.eventId);
        }
      }
    }
    return results;
  }
  intersectSets(set1, set2) {
    const result = /* @__PURE__ */ new Set();
    const smaller = set1.size < set2.size ? set1 : set2;
    const larger = set1.size < set2.size ? set2 : set1;
    for (const item of smaller) {
      if (larger.has(item)) {
        result.add(item);
      }
    }
    return result;
  }
  async queryPubkeyKind(pubkey, kinds, since, until, limit) {
    const results = [];
    await Promise.all(kinds.map((k) => this.ensurePubkeyKindIndexLoaded(pubkey, k)));
    const kindMap = this.pubkeyKindIndex.get(pubkey);
    if (!kindMap) {
      return [];
    }
    for (const kind of kinds) {
      const index = kindMap.get(kind);
      if (!index)
        continue;
      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.push(entry.eventId);
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }
    return results;
  }
  async queryTagKind(tagKey, kinds, since, until, limit) {
    const results = [];
    await Promise.all(kinds.map((k) => this.ensureTagKindIndexLoaded(tagKey, k)));
    const kindMap = this.tagKindIndex.get(tagKey);
    if (!kindMap) {
      return [];
    }
    for (const kind of kinds) {
      const index = kindMap.get(kind);
      if (!index)
        continue;
      for (const entry of index.entries) {
        if (entry.created_at >= since && entry.created_at <= until) {
          results.push(entry.eventId);
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }
    return results;
  }
  queryGlobalCreated(since, until, limit) {
    if (!this.createdIndex) {
      return [];
    }
    const results = [];
    for (const entry of this.createdIndex.entries) {
      if (entry.created_at >= since && entry.created_at <= until) {
        results.push(entry.eventId);
        if (results.length >= limit) {
          break;
        }
      }
    }
    return results;
  }
  sortAndLimit(eventIds, limit) {
    if (eventIds.length === 0)
      return [];
    const timestampMap = /* @__PURE__ */ new Map();
    if (this.createdIndex) {
      const eventIdSet = new Set(eventIds);
      for (const entry of this.createdIndex.entries) {
        if (eventIdSet.has(entry.eventId)) {
          timestampMap.set(entry.eventId, entry.created_at);
        }
      }
    }
    const sorted = eventIds.sort((a, b) => {
      const timeA = timestampMap.get(a) ?? 0;
      const timeB = timestampMap.get(b) ?? 0;
      return timeB - timeA;
    });
    return sorted.slice(0, limit);
  }
  async handleGetEvents(request) {
    let eventIds;
    try {
      const payload = unpack(new Uint8Array(await request.arrayBuffer()));
      eventIds = payload.eventIds;
    } catch (error) {
      if (error.message?.includes("client disconnected")) {
        console.log("Client disconnected during get-events request");
        return new Response("Client disconnected", { status: 499 });
      }
      throw error;
    }
    if (!eventIds || !Array.isArray(eventIds)) {
      const error = { error: "eventIds array required" };
      return new Response(pack(error), {
        status: 400,
        headers: { "Content-Type": "application/msgpack" }
      });
    }
    const events = [];
    const missing = [];
    for (const eventId of eventIds) {
      if (this.deletedEvents.has(eventId)) {
        missing.push(eventId);
        continue;
      }
      const eventData = await this.state.storage.get(`event:${eventId}`);
      if (eventData) {
        try {
          const event = unpack(eventData);
          events.push(event);
        } catch (err) {
          console.warn(`MessagePack deserialization failed for ${eventId}:`, err);
          missing.push(eventId);
        }
      } else {
        missing.push(eventId);
      }
    }
    const response = {
      events,
      count: events.length,
      missing: missing.length > 0 ? missing : void 0
    };
    return new Response(pack(response), {
      headers: { "Content-Type": "application/msgpack" }
    });
  }
  async deleteEventById(eventId) {
    const eventData = await this.state.storage.get(`event:${eventId}`);
    if (!eventData)
      return;
    let event;
    try {
      event = unpack(eventData);
    } catch (err) {
      console.warn(`MessagePack read failed for ${eventId}:`, err);
      return;
    }
    const storageBatch = {};
    const keysToDelete = [];
    const kindIdx = this.kindIndex.get(event.kind);
    if (kindIdx) {
      const entryIndex = kindIdx.entries.findIndex((e) => e.eventId === eventId);
      if (entryIndex >= 0) {
        kindIdx.entries.splice(entryIndex, 1);
        kindIdx.eventIdSet.delete(eventId);
        kindIdx.count--;
        storageBatch[`kind:${event.kind}`] = {
          entries: kindIdx.entries,
          count: kindIdx.count,
          minTime: kindIdx.minTime,
          maxTime: kindIdx.maxTime,
          lastUpdate: kindIdx.lastUpdate
        };
      }
    }
    const authorIdx = this.authorIndex.get(event.pubkey);
    if (authorIdx) {
      const entryIndex = authorIdx.entries.findIndex((e) => e.eventId === eventId);
      if (entryIndex >= 0) {
        authorIdx.entries.splice(entryIndex, 1);
        authorIdx.eventIdSet.delete(eventId);
        authorIdx.count--;
        storageBatch[`author:${event.pubkey}`] = {
          entries: authorIdx.entries,
          count: authorIdx.count,
          minTime: authorIdx.minTime,
          maxTime: authorIdx.maxTime,
          lastUpdate: authorIdx.lastUpdate
        };
      }
    }
    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `${tag[0]}:${tag[1]}`;
        const tagIdx = this.tagIndex.get(tagKey);
        if (tagIdx) {
          const entryIndex = tagIdx.entries.findIndex((e) => e.eventId === eventId);
          if (entryIndex >= 0) {
            tagIdx.entries.splice(entryIndex, 1);
            tagIdx.eventIdSet.delete(eventId);
            tagIdx.count--;
            storageBatch[`tag:${tagKey}`] = {
              entries: tagIdx.entries,
              count: tagIdx.count,
              minTime: tagIdx.minTime,
              maxTime: tagIdx.maxTime,
              lastUpdate: tagIdx.lastUpdate
            };
          }
        }
      }
    }
    if (event.kind === 1 && this.eventContent.has(eventId)) {
      const content = this.eventContent.get(eventId);
      if (content) {
        const tokens = this.tokenizeContent(content);
        for (const token of tokens) {
          const eventSet = this.contentIndex.get(token);
          if (eventSet) {
            eventSet.delete(eventId);
            if (eventSet.size === 0) {
              this.contentIndex.delete(token);
              keysToDelete.push(`content:${token}`);
            } else {
              storageBatch[`content:${token}`] = Array.from(eventSet);
            }
          }
        }
      }
      this.eventContent.delete(eventId);
      keysToDelete.push(`eventcontent:${eventId}`);
    }
    if (this.isReplaceableKind(event.kind)) {
      const replaceableKey = this.getReplaceableKey(event.kind, event.pubkey);
      if (this.replaceableIndex.get(replaceableKey) === eventId) {
        this.replaceableIndex.delete(replaceableKey);
        keysToDelete.push(`replaceable:${replaceableKey}`);
      }
    }
    if (this.isAddressableKind(event.kind)) {
      const dTag = this.getDTag(event);
      const addressableKey = this.getAddressableKey(event.kind, event.pubkey, dTag);
      if (this.addressableIndex.get(addressableKey) === eventId) {
        this.addressableIndex.delete(addressableKey);
        keysToDelete.push(`addressable:${addressableKey}`);
      }
    }
    if (this.isChannelMetadataKind(event.kind)) {
      const eTag = this.getETag(event);
      const channelMetadataKey = this.getChannelMetadataKey(event.pubkey, eTag);
      if (this.channelMetadataIndex.get(channelMetadataKey) === eventId) {
        this.channelMetadataIndex.delete(channelMetadataKey);
        keysToDelete.push(`channelmeta:${channelMetadataKey}`);
      }
    }
    const pubkeyKindMap = this.pubkeyKindIndex.get(event.pubkey);
    if (pubkeyKindMap) {
      const pkIndex = pubkeyKindMap.get(event.kind);
      if (pkIndex) {
        const entryIndex = pkIndex.entries.findIndex((e) => e.eventId === eventId);
        if (entryIndex >= 0) {
          pkIndex.entries.splice(entryIndex, 1);
          pkIndex.eventIdSet.delete(eventId);
          pkIndex.count--;
          if (pkIndex.count === 0) {
            pubkeyKindMap.delete(event.kind);
            keysToDelete.push(`pubkeykind:${event.pubkey}:${event.kind}`);
          } else {
            storageBatch[`pubkeykind:${event.pubkey}:${event.kind}`] = {
              entries: pkIndex.entries,
              count: pkIndex.count,
              minTime: pkIndex.minTime,
              maxTime: pkIndex.maxTime,
              lastUpdate: pkIndex.lastUpdate
            };
          }
        }
      }
    }
    for (const tag of event.tags) {
      if (tag.length >= 2) {
        const tagKey = `${tag[0]}:${tag[1]}`;
        const tagKindMap = this.tagKindIndex.get(tagKey);
        if (tagKindMap) {
          const tkIndex = tagKindMap.get(event.kind);
          if (tkIndex) {
            const entryIndex = tkIndex.entries.findIndex((e) => e.eventId === eventId);
            if (entryIndex >= 0) {
              tkIndex.entries.splice(entryIndex, 1);
              tkIndex.eventIdSet.delete(eventId);
              tkIndex.count--;
              if (tkIndex.count === 0) {
                tagKindMap.delete(event.kind);
                keysToDelete.push(`tagkind:${tagKey}:${event.kind}`);
              } else {
                storageBatch[`tagkind:${tagKey}:${event.kind}`] = {
                  entries: tkIndex.entries,
                  count: tkIndex.count,
                  minTime: tkIndex.minTime,
                  maxTime: tkIndex.maxTime,
                  lastUpdate: tkIndex.lastUpdate
                };
              }
            }
          }
        }
      }
    }
    if (this.createdIndex) {
      const entryIndex = this.createdIndex.entries.findIndex((e) => e.eventId === eventId);
      if (entryIndex >= 0) {
        this.createdIndex.entries.splice(entryIndex, 1);
        this.createdIndex.eventIdSet.delete(eventId);
        this.createdIndex.count--;
        storageBatch["created_index"] = {
          entries: this.createdIndex.entries,
          count: this.createdIndex.count,
          minTime: this.createdIndex.minTime,
          maxTime: this.createdIndex.maxTime,
          lastUpdate: this.createdIndex.lastUpdate
        };
      }
    }
    if (this.expirationIndex.has(eventId)) {
      this.expirationIndex.delete(eventId);
      storageBatch["expiration_index"] = Array.from(this.expirationIndex.entries());
    }
    this.deletedEvents.add(eventId);
    keysToDelete.push(`event:${eventId}`);
    if (Object.keys(storageBatch).length > 0) {
      await this.state.storage.put(storageBatch);
    }
    if (keysToDelete.length > 0) {
      await this.state.storage.delete(keysToDelete);
    }
    this.eventCount--;
  }
  async handleDeleteEvents(request) {
    let eventIds;
    try {
      const payload = unpack(new Uint8Array(await request.arrayBuffer()));
      eventIds = payload.eventIds;
    } catch (error) {
      if (error.message?.includes("client disconnected")) {
        console.log("Client disconnected during delete-events request");
        return new Response("Client disconnected", { status: 499 });
      }
      throw error;
    }
    if (!eventIds || !Array.isArray(eventIds)) {
      return new Response(
        pack({ error: "eventIds array required" }),
        { status: 400, headers: { "Content-Type": "application/msgpack" } }
      );
    }
    let deletedCount = 0;
    for (const eventId of eventIds) {
      const eventData = await this.state.storage.get(`event:${eventId}`);
      if (eventData) {
        await this.deleteEventById(eventId);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      await this.state.storage.put("deleted_events", Array.from(this.deletedEvents));
      await this.saveMetadata();
    }
    return new Response(
      pack({
        deleted: deletedCount,
        total: eventIds.length
      }),
      { headers: { "Content-Type": "application/msgpack" } }
    );
  }
};
__name(_EventShardDO, "EventShardDO");
var EventShardDO = _EventShardDO;

// src/payment-do.ts
init_msgpackr();
var _PaymentDO = class _PaymentDO {
  constructor(state, _env) {
    this.paidPubkeys = /* @__PURE__ */ new Map();
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      await this.loadPayments();
    });
  }
  async loadPayments() {
    try {
      const stored = await this.state.storage.list({ prefix: "paid:" });
      for (const [key, record] of stored) {
        const pubkey = key.substring(5);
        if (record.expiresAt && record.expiresAt < Date.now() / 1e3) {
          await this.state.storage.delete(key);
          continue;
        }
        this.paidPubkeys.set(pubkey, record);
      }
      console.log(`[PaymentDO] Loaded ${this.paidPubkeys.size} payment records`);
    } catch (error) {
      console.error("[PaymentDO] Error loading payment data:", error);
    }
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/check") {
      return this.handleCheck(request);
    } else if (url.pathname === "/add") {
      return this.handleAdd(request);
    } else if (url.pathname === "/remove") {
      return this.handleRemove(request);
    }
    return new Response("Not found", { status: 404 });
  }
  async handleCheck(request) {
    try {
      let pubkey;
      try {
        const payload = unpack(new Uint8Array(await request.arrayBuffer()));
        pubkey = payload.pubkey;
      } catch (error) {
        if (error.message?.includes("client disconnected")) {
          console.log("[PaymentDO] Client disconnected during check request");
          return new Response("Client disconnected", { status: 499 });
        }
        throw error;
      }
      if (!pubkey) {
        const error = { error: "Missing pubkey" };
        return new Response(pack(error), {
          status: 400,
          headers: { "Content-Type": "application/msgpack" }
        });
      }
      const record = this.paidPubkeys.get(pubkey);
      if (record?.expiresAt && record.expiresAt < Date.now() / 1e3) {
        this.paidPubkeys.delete(pubkey);
        await this.state.storage.delete(`paid:${pubkey}`);
        const response2 = {
          hasPaid: false,
          reason: "expired"
        };
        return new Response(pack(response2), {
          headers: { "Content-Type": "application/msgpack" }
        });
      }
      const response = {
        hasPaid: record !== void 0,
        record: record ? {
          paidAt: record.paidAt,
          amountSats: record.amountSats,
          expiresAt: record.expiresAt
        } : void 0
      };
      return new Response(pack(response), {
        headers: { "Content-Type": "application/msgpack" }
      });
    } catch (error) {
      console.error("[PaymentDO] Error checking payment:", error);
      const errorResponse = { error: error.message };
      return new Response(pack(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/msgpack" }
      });
    }
  }
  async handleAdd(request) {
    try {
      let record;
      try {
        record = unpack(new Uint8Array(await request.arrayBuffer()));
      } catch (error) {
        if (error.message?.includes("client disconnected")) {
          console.log("[PaymentDO] Client disconnected during add request");
          return new Response("Client disconnected", { status: 499 });
        }
        throw error;
      }
      if (!record.pubkey) {
        const error = { error: "Missing pubkey" };
        return new Response(pack(error), {
          status: 400,
          headers: { "Content-Type": "application/msgpack" }
        });
      }
      this.paidPubkeys.set(record.pubkey, record);
      await this.state.storage.put(`paid:${record.pubkey}`, record);
      const response = {
        success: true,
        message: "Payment recorded"
      };
      return new Response(pack(response), {
        headers: { "Content-Type": "application/msgpack" }
      });
    } catch (error) {
      console.error("[PaymentDO] Error adding payment:", error);
      const errorResponse = { error: error.message };
      return new Response(pack(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/msgpack" }
      });
    }
  }
  async handleRemove(request) {
    try {
      let pubkey;
      try {
        const payload = unpack(new Uint8Array(await request.arrayBuffer()));
        pubkey = payload.pubkey;
      } catch (error) {
        if (error.message?.includes("client disconnected")) {
          console.log("[PaymentDO] Client disconnected during remove request");
          return new Response("Client disconnected", { status: 499 });
        }
        throw error;
      }
      if (!pubkey) {
        const error = { error: "Missing pubkey" };
        return new Response(pack(error), {
          status: 400,
          headers: { "Content-Type": "application/msgpack" }
        });
      }
      this.paidPubkeys.delete(pubkey);
      await this.state.storage.delete(`paid:${pubkey}`);
      const response = {
        success: true,
        message: "Payment record removed"
      };
      return new Response(pack(response), {
        headers: { "Content-Type": "application/msgpack" }
      });
    } catch (error) {
      console.error("[PaymentDO] Error removing payment:", error);
      const errorResponse = { error: error.message };
      return new Response(pack(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/msgpack" }
      });
    }
  }
};
__name(_PaymentDO, "PaymentDO");
var PaymentDO = _PaymentDO;

// src/index.ts
init_broadcast_consumer();
export {
  ConnectionDO,
  EventShardDO,
  PaymentDO,
  SessionManagerDO,
  broadcast_consumer_default as broadcastConsumer,
  relay_worker_default as default
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/modular.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/curve.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/abstract/weierstrass.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/_shortw_utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
