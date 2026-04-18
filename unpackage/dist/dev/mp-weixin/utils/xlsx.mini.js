"use strict";
class ZipReader {
  constructor(data) {
    this.data = new Uint8Array(data);
    this.files = {};
    this.parse();
  }
  parse() {
    const data = this.data;
    let eocdOffset = -1;
    for (let i = data.length - 22; i >= 0; i--) {
      if (data[i] === 80 && data[i + 1] === 75 && data[i + 2] === 5 && data[i + 3] === 6) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1)
      throw new Error("不是有效的 ZIP/XLSX 文件");
    const cdOffset = this.readUint32(eocdOffset + 16);
    const cdEntries = this.readUint16(eocdOffset + 10);
    let offset = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      if (data[offset] !== 80 || data[offset + 1] !== 75)
        break;
      const nameLen = this.readUint16(offset + 28);
      const extraLen = this.readUint16(offset + 30);
      const commentLen = this.readUint16(offset + 32);
      const localOffset = this.readUint32(offset + 42);
      const name = this.readString(offset + 46, nameLen);
      const lNameLen = this.readUint16(localOffset + 26);
      const lExtraLen = this.readUint16(localOffset + 28);
      const compSize = this.readUint32(localOffset + 18);
      const uncompSize = this.readUint32(localOffset + 22);
      const method = this.readUint16(localOffset + 8);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      if (method === 0) {
        this.files[name] = data.slice(dataStart, dataStart + uncompSize);
      } else if (method === 8) {
        this.files[name] = this.inflate(data.slice(dataStart, dataStart + compSize));
      }
      offset += 46 + nameLen + extraLen + commentLen;
    }
  }
  readUint16(offset) {
    return this.data[offset] | this.data[offset + 1] << 8;
  }
  readUint32(offset) {
    return (this.data[offset] | this.data[offset + 1] << 8 | this.data[offset + 2] << 16 | this.data[offset + 3] << 24) >>> 0;
  }
  readString(offset, length) {
    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.data[offset + i]);
    }
    return str;
  }
  // 简化版 inflate (Deflate 解压)
  inflate(data) {
    try {
      const zlibData = new Uint8Array(data.length + 6);
      zlibData[0] = 120;
      zlibData[1] = 156;
      zlibData.set(data, 2);
      return this.rawInflate(data);
    } catch (e) {
      return data;
    }
  }
  // Raw Deflate 解压缩实现
  rawInflate(input) {
    let inputIdx = 0;
    let bitBuf = 0;
    let bitCount = 0;
    const output = [];
    function readBits(n) {
      while (bitCount < n) {
        if (inputIdx >= input.length)
          return -1;
        bitBuf |= input[inputIdx++] << bitCount;
        bitCount += 8;
      }
      const val = bitBuf & (1 << n) - 1;
      bitBuf >>= n;
      bitCount -= n;
      return val;
    }
    const lengthBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    const lengthExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    const distExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    let bfinal = 0;
    while (!bfinal) {
      bfinal = readBits(1);
      const btype = readBits(2);
      if (btype === 0) {
        bitBuf = 0;
        bitCount = 0;
        const len = input[inputIdx] | input[inputIdx + 1] << 8;
        inputIdx += 4;
        for (let i = 0; i < len; i++) {
          output.push(input[inputIdx++]);
        }
      } else if (btype === 1 || btype === 2) {
        let litLenTree, distTree;
        if (btype === 1) {
          litLenTree = buildFixedLitLenTree();
          distTree = buildFixedDistTree();
        } else {
          const trees = readDynamicTrees();
          litLenTree = trees.litLen;
          distTree = trees.dist;
        }
        while (true) {
          const code = decodeSymbol(litLenTree);
          if (code === 256)
            break;
          if (code < 256) {
            output.push(code);
          } else {
            const lenIdx = code - 257;
            let length = lengthBase[lenIdx] + readBits(lengthExtra[lenIdx]);
            const distCode = decodeSymbol(distTree);
            let distance = distBase[distCode] + readBits(distExtra[distCode]);
            const start = output.length - distance;
            for (let i = 0; i < length; i++) {
              output.push(output[start + i]);
            }
          }
        }
      }
    }
    function buildFixedLitLenTree() {
      const lengths = new Array(288);
      for (let i = 0; i <= 143; i++)
        lengths[i] = 8;
      for (let i = 144; i <= 255; i++)
        lengths[i] = 9;
      for (let i = 256; i <= 279; i++)
        lengths[i] = 7;
      for (let i = 280; i <= 287; i++)
        lengths[i] = 8;
      return buildHuffmanTree(lengths);
    }
    function buildFixedDistTree() {
      const lengths = new Array(30).fill(5);
      return buildHuffmanTree(lengths);
    }
    function readDynamicTrees() {
      const hlit = readBits(5) + 257;
      const hdist = readBits(5) + 1;
      const hclen = readBits(4) + 4;
      const codeLenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
      const codeLenLengths = new Array(19).fill(0);
      for (let i = 0; i < hclen; i++) {
        codeLenLengths[codeLenOrder[i]] = readBits(3);
      }
      const codeLenTree = buildHuffmanTree(codeLenLengths);
      const lengths = [];
      while (lengths.length < hlit + hdist) {
        const sym = decodeSymbol(codeLenTree);
        if (sym < 16) {
          lengths.push(sym);
        } else if (sym === 16) {
          const repeat = readBits(2) + 3;
          const prev = lengths[lengths.length - 1] || 0;
          for (let i = 0; i < repeat; i++)
            lengths.push(prev);
        } else if (sym === 17) {
          const repeat = readBits(3) + 3;
          for (let i = 0; i < repeat; i++)
            lengths.push(0);
        } else if (sym === 18) {
          const repeat = readBits(7) + 11;
          for (let i = 0; i < repeat; i++)
            lengths.push(0);
        }
      }
      return {
        litLen: buildHuffmanTree(lengths.slice(0, hlit)),
        dist: buildHuffmanTree(lengths.slice(hlit))
      };
    }
    function buildHuffmanTree(lengths) {
      const maxLen = Math.max(...lengths, 1);
      const counts = new Array(maxLen + 1).fill(0);
      for (const len of lengths) {
        if (len > 0)
          counts[len]++;
      }
      const offsets = new Array(maxLen + 1).fill(0);
      for (let i = 1; i <= maxLen; i++) {
        offsets[i] = offsets[i - 1] + counts[i - 1];
      }
      const symbols = new Array(lengths.length);
      for (let i = 0; i < lengths.length; i++) {
        if (lengths[i] > 0) {
          symbols[offsets[lengths[i]]++] = i;
        }
      }
      return { lengths, symbols, counts, maxLen };
    }
    function decodeSymbol(tree) {
      let code = 0;
      let first = 0;
      let index = 0;
      for (let len = 1; len <= tree.maxLen; len++) {
        code |= readBits(1);
        const count = tree.counts[len];
        if (code - first < count) {
          return tree.symbols[index + (code - first)];
        }
        index += count;
        first = first + count << 1;
        code <<= 1;
      }
      return -1;
    }
    return new Uint8Array(output);
  }
}
function decodeUTF8(bytes) {
  let str = "";
  for (let i = 0; i < bytes.length; ) {
    const byte = bytes[i];
    if (byte < 128) {
      str += String.fromCharCode(byte);
      i++;
    } else if (byte < 224) {
      str += String.fromCharCode((byte & 31) << 6 | bytes[i + 1] & 63);
      i += 2;
    } else if (byte < 240) {
      str += String.fromCharCode((byte & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63);
      i += 3;
    } else {
      i += 4;
    }
  }
  return str;
}
function read(data, opts) {
  const zip = new ZipReader(data instanceof ArrayBuffer ? data : data.buffer || data);
  const workbook = {
    SheetNames: [],
    Sheets: {}
  };
  const sharedStrings = [];
  const sst = zip.files["xl/sharedStrings.xml"];
  if (sst) {
    const sstXml = decodeUTF8(sst);
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let siMatch;
    while ((siMatch = siRegex.exec(sstXml)) !== null) {
      const siContent = siMatch[1];
      const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let text = "";
      let tMatch;
      while ((tMatch = tRegex.exec(siContent)) !== null) {
        text += tMatch[1];
      }
      text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      sharedStrings.push(text);
    }
  }
  const wbXml = zip.files["xl/workbook.xml"];
  if (wbXml) {
    const wbStr = decodeUTF8(wbXml);
    const sheetRegex = /<sheet\s+name="([^"]+)"[^>]*\/?\s*>/g;
    let sheetMatch;
    while ((sheetMatch = sheetRegex.exec(wbStr)) !== null) {
      workbook.SheetNames.push(sheetMatch[1]);
    }
  }
  for (let i = 0; i < workbook.SheetNames.length; i++) {
    const sheetFile = zip.files[`xl/worksheets/sheet${i + 1}.xml`];
    if (!sheetFile)
      continue;
    const sheetXml = decodeUTF8(sheetFile);
    const sheet = {};
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      const rowContent = rowMatch[1];
      const cellRegex = /<c\s+r="([A-Z]+\d+)"([^>]*)>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const ref = cellMatch[1];
        const attrs = cellMatch[2];
        const value = cellMatch[3];
        let cellValue;
        if (attrs.includes('t="s"')) {
          cellValue = sharedStrings[parseInt(value)] || "";
        } else if (attrs.includes('t="b"')) {
          cellValue = value === "1";
        } else {
          cellValue = isNaN(value) ? value : Number(value);
        }
        sheet[ref] = { v: cellValue, t: typeof cellValue === "number" ? "n" : "s" };
      }
    }
    const refs = Object.keys(sheet);
    if (refs.length > 0) {
      let minCol = Infinity, maxCol = 0, minRow = Infinity, maxRow = 0;
      for (const ref of refs) {
        const col = ref.replace(/\d+/g, "");
        const row = parseInt(ref.replace(/[A-Z]+/g, ""));
        const colNum = colToNum(col);
        minCol = Math.min(minCol, colNum);
        maxCol = Math.max(maxCol, colNum);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
      sheet["!ref"] = numToCol(minCol) + minRow + ":" + numToCol(maxCol) + maxRow;
    }
    workbook.Sheets[workbook.SheetNames[i]] = sheet;
  }
  return workbook;
}
function colToNum(col) {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + col.charCodeAt(i) - 64;
  }
  return num;
}
function numToCol(num) {
  let col = "";
  while (num > 0) {
    const mod = (num - 1) % 26;
    col = String.fromCharCode(65 + mod) + col;
    num = Math.floor((num - 1) / 26);
  }
  return col;
}
function sheet_to_json(sheet, opts) {
  opts = opts || {};
  const defval = opts.defval !== void 0 ? opts.defval : void 0;
  if (!sheet["!ref"])
    return [];
  const range = sheet["!ref"];
  const parts = range.split(":");
  const startCol = colToNum(parts[0].replace(/\d+/g, ""));
  const startRow = parseInt(parts[0].replace(/[A-Z]+/g, ""));
  const endCol = colToNum(parts[1].replace(/\d+/g, ""));
  const endRow = parseInt(parts[1].replace(/[A-Z]+/g, ""));
  const headers = [];
  for (let c = startCol; c <= endCol; c++) {
    const ref = numToCol(c) + startRow;
    const cell = sheet[ref];
    headers.push(cell ? String(cell.v) : `Column${c}`);
  }
  const result = [];
  for (let r = startRow + 1; r <= endRow; r++) {
    const row = {};
    let hasData = false;
    for (let c = startCol; c <= endCol; c++) {
      const ref = numToCol(c) + r;
      const cell = sheet[ref];
      const header = headers[c - startCol];
      if (cell !== void 0) {
        row[header] = cell.v;
        hasData = true;
      } else if (defval !== void 0) {
        row[header] = defval;
      }
    }
    if (hasData)
      result.push(row);
  }
  return result;
}
const utils = { sheet_to_json };
const XLSX = { read, utils };
exports.XLSX = XLSX;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/xlsx.mini.js.map
