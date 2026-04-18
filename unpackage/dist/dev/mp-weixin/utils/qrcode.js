"use strict";
const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
function draw(text, canvas, ctx, size) {
  const modules = generateQRModules(text);
  const moduleCount = modules.length;
  const cellSize = size / moduleCount;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules[row][col]) {
        ctx.fillStyle = "#000000";
      } else {
        ctx.fillStyle = "#FFFFFF";
      }
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }
}
function generateQRModules(text) {
  const encoder = new QRCodeEncoder(text, QRErrorCorrectLevel.L);
  return encoder.modules;
}
class QRCodeEncoder {
  constructor(text, errorCorrectLevel) {
    this.text = text;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = [];
    this.moduleCount = 0;
    const dataLength = this.getUTF8Length(text);
    if (dataLength <= 17)
      this.version = 1;
    else if (dataLength <= 32)
      this.version = 2;
    else if (dataLength <= 53)
      this.version = 3;
    else if (dataLength <= 78)
      this.version = 4;
    else if (dataLength <= 106)
      this.version = 5;
    else if (dataLength <= 134)
      this.version = 6;
    else if (dataLength <= 154)
      this.version = 7;
    else if (dataLength <= 192)
      this.version = 8;
    else if (dataLength <= 230)
      this.version = 9;
    else
      this.version = 10;
    this.moduleCount = this.version * 4 + 17;
    this.make();
  }
  getUTF8Length(str) {
    let length = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 127)
        length += 1;
      else if (code <= 2047)
        length += 2;
      else if (code <= 65535)
        length += 3;
      else
        length += 4;
    }
    return length;
  }
  make() {
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount);
      for (let col = 0; col < this.moduleCount; col++) {
        this.modules[row][col] = null;
      }
    }
    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupFormatInfo(0);
    if (this.version >= 7) {
      this.setupVersionInfo();
    }
    const data = this.createData();
    this.mapData(data, 0);
  }
  setupPositionProbePattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      if (row + r < 0 || this.moduleCount <= row + r)
        continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c < 0 || this.moduleCount <= col + c)
          continue;
        if (0 <= r && r <= 6 && (c === 0 || c === 6) || 0 <= c && c <= 6 && (r === 0 || r === 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }
  setupPositionAdjustPattern() {
    const pos = this.getAlignmentPositions();
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] !== null)
          continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }
  getAlignmentPositions() {
    const positions = [
      [],
      // version 0 不存在
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50]
    ];
    return positions[this.version] || [];
  }
  setupTimingPattern() {
    for (let i = 8; i < this.moduleCount - 8; i++) {
      if (this.modules[i][6] !== null)
        continue;
      this.modules[i][6] = i % 2 === 0;
    }
    for (let i = 8; i < this.moduleCount - 8; i++) {
      if (this.modules[6][i] !== null)
        continue;
      this.modules[6][i] = i % 2 === 0;
    }
  }
  setupFormatInfo(maskPattern) {
    const data = this.errorCorrectLevel << 3 | maskPattern;
    const bits = this.getBCHFormatInfo(data);
    for (let i = 0; i < 15; i++) {
      const mod = (bits >> i & 1) === 1;
      if (i < 6) {
        this.modules[i][8] = mod;
      } else if (i < 8) {
        this.modules[i + 1][8] = mod;
      } else {
        this.modules[this.moduleCount - 15 + i][8] = mod;
      }
      if (i < 8) {
        this.modules[8][this.moduleCount - i - 1] = mod;
      } else if (i < 9) {
        this.modules[8][15 - i - 1 + 1] = mod;
      } else {
        this.modules[8][15 - i - 1] = mod;
      }
    }
    this.modules[this.moduleCount - 8][8] = true;
  }
  setupVersionInfo() {
    const bits = this.getBCHVersionInfo(this.version);
    for (let i = 0; i < 18; i++) {
      const mod = (bits >> i & 1) === 1;
      this.modules[Math.floor(i / 3)][this.moduleCount - 11 + i % 3] = mod;
      this.modules[this.moduleCount - 11 + i % 3][Math.floor(i / 3)] = mod;
    }
  }
  getBCHFormatInfo(data) {
    let d = data << 10;
    while (this.getBCHDigit(d) - this.getBCHDigit(1335) >= 0) {
      d ^= 1335 << this.getBCHDigit(d) - this.getBCHDigit(1335);
    }
    return (data << 10 | d) ^ 21522;
  }
  getBCHVersionInfo(data) {
    let d = data << 12;
    while (this.getBCHDigit(d) - this.getBCHDigit(7973) >= 0) {
      d ^= 7973 << this.getBCHDigit(d) - this.getBCHDigit(7973);
    }
    return data << 12 | d;
  }
  getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  }
  createData() {
    const utf8 = [];
    for (let i = 0; i < this.text.length; i++) {
      const code = this.text.charCodeAt(i);
      if (code <= 127) {
        utf8.push(code);
      } else if (code <= 2047) {
        utf8.push(192 | code >> 6);
        utf8.push(128 | code & 63);
      } else if (code <= 65535) {
        utf8.push(224 | code >> 12);
        utf8.push(128 | code >> 6 & 63);
        utf8.push(128 | code & 63);
      }
    }
    const buffer = new BitBuffer();
    buffer.put(4, 4);
    const cciBits = this.version <= 9 ? 8 : 16;
    buffer.put(utf8.length, cciBits);
    for (let i = 0; i < utf8.length; i++) {
      buffer.put(utf8[i], 8);
    }
    const totalDataBits = this.getDataCapacity() * 8;
    if (buffer.length + 4 <= totalDataBits) {
      buffer.put(0, 4);
    }
    while (buffer.length % 8 !== 0) {
      buffer.putBit(false);
    }
    const padBytes = [236, 17];
    let padIndex = 0;
    while (buffer.length < totalDataBits) {
      buffer.put(padBytes[padIndex % 2], 8);
      padIndex++;
    }
    return this.createBytes(buffer);
  }
  getDataCapacity() {
    const capacities = [0, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274];
    return capacities[this.version] || 19;
  }
  createBytes(buffer) {
    const totalCodewords = this.getTotalCodewords();
    const dataCapacity = this.getDataCapacity();
    const data = new Array(totalCodewords);
    for (let i = 0; i < dataCapacity; i++) {
      data[i] = buffer.buffer[i] || 0;
    }
    for (let i = dataCapacity; i < totalCodewords; i++) {
      data[i] = 0;
    }
    return data;
  }
  getTotalCodewords() {
    const totals = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
    return totals[this.version] || 26;
  }
  mapData(data, maskPattern) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6)
        col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = (data[byteIndex] >>> bitIndex & 1) === 1;
            }
            if ((row + (col - c)) % 2 === 0) {
              dark = !dark;
            }
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex < 0) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
}
class BitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  get(index) {
    const bufIndex = Math.floor(index / 8);
    return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
  }
  put(num, length) {
    for (let i = 0; i < length; i++) {
      this.putBit((num >>> length - i - 1 & 1) === 1);
    }
  }
  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 128 >>> this.length % 8;
    }
    this.length++;
  }
}
const QRCode = { draw, QRErrorCorrectLevel };
exports.QRCode = QRCode;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/qrcode.js.map
