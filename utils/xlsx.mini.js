/**
 * XLSX 解析器 - 微信小程序精简版
 * 支持读取 .xlsx 文件中的文本和数字数据
 *
 * 注意：这是一个精简版本。如需完整功能，请在微信开发者工具中
 * 使用 npm install xlsx 安装完整版 SheetJS 库。
 *
 * 使用方法（完整版 SheetJS）：
 * 1. 在小程序根目录运行：npm install xlsx
 * 2. 在微信开发者工具中点击"工具" -> "构建 npm"
 * 3. 代码中使用：const XLSX = require('xlsx')
 *
 * 当前精简版通过直接解析 xlsx 的 ZIP 结构来读取数据，
 * 无需 npm 依赖，适合简单的名单上传场景。
 */

// ============================================================
// ZIP 解压缩 (XLSX 本质是 ZIP 文件)
// ============================================================

class ZipReader {
  constructor(data) {
    this.data = new Uint8Array(data)
    this.files = {}
    this.parse()
  }

  parse() {
    const data = this.data
    // 查找 End of Central Directory
    let eocdOffset = -1
    for (let i = data.length - 22; i >= 0; i--) {
      if (data[i] === 0x50 && data[i + 1] === 0x4B &&
          data[i + 2] === 0x05 && data[i + 3] === 0x06) {
        eocdOffset = i
        break
      }
    }

    if (eocdOffset === -1) throw new Error('不是有效的 ZIP/XLSX 文件')

    const cdOffset = this.readUint32(eocdOffset + 16)
    const cdEntries = this.readUint16(eocdOffset + 10)

    let offset = cdOffset
    for (let i = 0; i < cdEntries; i++) {
      if (data[offset] !== 0x50 || data[offset + 1] !== 0x4B) break

      const nameLen = this.readUint16(offset + 28)
      const extraLen = this.readUint16(offset + 30)
      const commentLen = this.readUint16(offset + 32)
      const localOffset = this.readUint32(offset + 42)
      const name = this.readString(offset + 46, nameLen)

      // 读取本地文件头
      const lNameLen = this.readUint16(localOffset + 26)
      const lExtraLen = this.readUint16(localOffset + 28)
      const compSize = this.readUint32(localOffset + 18)
      const uncompSize = this.readUint32(localOffset + 22)
      const method = this.readUint16(localOffset + 8)
      const dataStart = localOffset + 30 + lNameLen + lExtraLen

      if (method === 0) {
        // 无压缩
        this.files[name] = data.slice(dataStart, dataStart + uncompSize)
      } else if (method === 8) {
        // Deflate 压缩 - 使用 pako 或直接存储原始数据
        this.files[name] = this.inflate(data.slice(dataStart, dataStart + compSize))
      }

      offset += 46 + nameLen + extraLen + commentLen
    }
  }

  readUint16(offset) {
    return this.data[offset] | (this.data[offset + 1] << 8)
  }

  readUint32(offset) {
    return (this.data[offset] |
            (this.data[offset + 1] << 8) |
            (this.data[offset + 2] << 16) |
            (this.data[offset + 3] << 24)) >>> 0
  }

  readString(offset, length) {
    let str = ''
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.data[offset + i])
    }
    return str
  }

  // 简化版 inflate (Deflate 解压)
  inflate(data) {
    // 使用微信小程序的 ArrayBuffer 方法
    try {
      // 添加 zlib header 来使用 pako
      const zlibData = new Uint8Array(data.length + 6)
      zlibData[0] = 0x78
      zlibData[1] = 0x9C
      zlibData.set(data, 2)
      // 尝试使用内置解压
      return this.rawInflate(data)
    } catch (e) {
      return data
    }
  }

  // Raw Deflate 解压缩实现
  rawInflate(input) {
    let inputIdx = 0
    let bitBuf = 0
    let bitCount = 0
    const output = []

    function readBits(n) {
      while (bitCount < n) {
        if (inputIdx >= input.length) return -1
        bitBuf |= input[inputIdx++] << bitCount
        bitCount += 8
      }
      const val = bitBuf & ((1 << n) - 1)
      bitBuf >>= n
      bitCount -= n
      return val
    }

    function readByte() {
      return readBits(8)
    }

    // 固定 Huffman 表
    const lengthBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258]
    const lengthExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]
    const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577]
    const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]

    let bfinal = 0
    while (!bfinal) {
      bfinal = readBits(1)
      const btype = readBits(2)

      if (btype === 0) {
        // 无压缩块
        bitBuf = 0
        bitCount = 0
        const len = input[inputIdx] | (input[inputIdx + 1] << 8)
        inputIdx += 4 // len + nlen
        for (let i = 0; i < len; i++) {
          output.push(input[inputIdx++])
        }
      } else if (btype === 1 || btype === 2) {
        // 固定或动态 Huffman
        let litLenTree, distTree

        if (btype === 1) {
          // 固定 Huffman 树
          litLenTree = buildFixedLitLenTree()
          distTree = buildFixedDistTree()
        } else {
          // 动态 Huffman 树
          const trees = readDynamicTrees()
          litLenTree = trees.litLen
          distTree = trees.dist
        }

        while (true) {
          const code = decodeSymbol(litLenTree)
          if (code === 256) break // 块结束
          if (code < 256) {
            output.push(code)
          } else {
            // 长度-距离对
            const lenIdx = code - 257
            let length = lengthBase[lenIdx] + readBits(lengthExtra[lenIdx])
            const distCode = decodeSymbol(distTree)
            let distance = distBase[distCode] + readBits(distExtra[distCode])

            // 从输出缓冲区复制
            const start = output.length - distance
            for (let i = 0; i < length; i++) {
              output.push(output[start + i])
            }
          }
        }
      }
    }

    function buildFixedLitLenTree() {
      const lengths = new Array(288)
      for (let i = 0; i <= 143; i++) lengths[i] = 8
      for (let i = 144; i <= 255; i++) lengths[i] = 9
      for (let i = 256; i <= 279; i++) lengths[i] = 7
      for (let i = 280; i <= 287; i++) lengths[i] = 8
      return buildHuffmanTree(lengths)
    }

    function buildFixedDistTree() {
      const lengths = new Array(30).fill(5)
      return buildHuffmanTree(lengths)
    }

    function readDynamicTrees() {
      const hlit = readBits(5) + 257
      const hdist = readBits(5) + 1
      const hclen = readBits(4) + 4

      const codeLenOrder = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]
      const codeLenLengths = new Array(19).fill(0)
      for (let i = 0; i < hclen; i++) {
        codeLenLengths[codeLenOrder[i]] = readBits(3)
      }
      const codeLenTree = buildHuffmanTree(codeLenLengths)

      const lengths = []
      while (lengths.length < hlit + hdist) {
        const sym = decodeSymbol(codeLenTree)
        if (sym < 16) {
          lengths.push(sym)
        } else if (sym === 16) {
          const repeat = readBits(2) + 3
          const prev = lengths[lengths.length - 1] || 0
          for (let i = 0; i < repeat; i++) lengths.push(prev)
        } else if (sym === 17) {
          const repeat = readBits(3) + 3
          for (let i = 0; i < repeat; i++) lengths.push(0)
        } else if (sym === 18) {
          const repeat = readBits(7) + 11
          for (let i = 0; i < repeat; i++) lengths.push(0)
        }
      }

      return {
        litLen: buildHuffmanTree(lengths.slice(0, hlit)),
        dist: buildHuffmanTree(lengths.slice(hlit))
      }
    }

    function buildHuffmanTree(lengths) {
      const maxLen = Math.max(...lengths, 1)
      const counts = new Array(maxLen + 1).fill(0)
      for (const len of lengths) {
        if (len > 0) counts[len]++
      }

      const offsets = new Array(maxLen + 1).fill(0)
      for (let i = 1; i <= maxLen; i++) {
        offsets[i] = offsets[i - 1] + counts[i - 1]
      }

      const symbols = new Array(lengths.length)
      for (let i = 0; i < lengths.length; i++) {
        if (lengths[i] > 0) {
          symbols[offsets[lengths[i]]++] = i
        }
      }

      return { lengths, symbols, counts, maxLen }
    }

    function decodeSymbol(tree) {
      let code = 0
      let first = 0
      let index = 0

      for (let len = 1; len <= tree.maxLen; len++) {
        code |= readBits(1)
        const count = tree.counts[len]
        if (code - first < count) {
          return tree.symbols[index + (code - first)]
        }
        index += count
        first = (first + count) << 1
        code <<= 1
      }
      return -1
    }

    return new Uint8Array(output)
  }
}

// ============================================================
// XML 解析器（简单实现）
// ============================================================

function parseXML(xmlString) {
  const nodes = []
  const tagRegex = /<(\/?)([\w:.]+)([^>]*?)(\/?)\s*>/g
  let match

  while ((match = tagRegex.exec(xmlString)) !== null) {
    const isClosing = match[1] === '/'
    const tagName = match[2]
    const attrs = match[3]
    const selfClosing = match[4] === '/'

    nodes.push({
      type: isClosing ? 'close' : (selfClosing ? 'self' : 'open'),
      name: tagName,
      attrs: parseAttrs(attrs),
      index: match.index,
      end: match.index + match[0].length
    })
  }

  return nodes
}

function parseAttrs(attrString) {
  const attrs = {}
  const attrRegex = /([\w:]+)\s*=\s*"([^"]*)"/g
  let m
  while ((m = attrRegex.exec(attrString)) !== null) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

function getInnerText(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'g')
  const results = []
  let m
  while ((m = regex.exec(xml)) !== null) {
    results.push(m[1])
  }
  return results
}

function getTagContent(xml, tagName) {
  const regex = new RegExp(`<${tagName}([^>]*)>([\\s\\S]*?)</${tagName}>`, 'g')
  const results = []
  let m
  while ((m = regex.exec(xml)) !== null) {
    results.push({ attrs: parseAttrs(m[1]), content: m[2] })
  }
  return results
}

// ============================================================
// XLSX 解析核心
// ============================================================

function decodeUTF8(bytes) {
  let str = ''
  for (let i = 0; i < bytes.length;) {
    const byte = bytes[i]
    if (byte < 128) {
      str += String.fromCharCode(byte)
      i++
    } else if (byte < 224) {
      str += String.fromCharCode(((byte & 0x1F) << 6) | (bytes[i + 1] & 0x3F))
      i += 2
    } else if (byte < 240) {
      str += String.fromCharCode(((byte & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F))
      i += 3
    } else {
      i += 4 // 跳过 4 字节 Unicode
    }
  }
  return str
}

function read(data, opts) {
  const zip = new ZipReader(data instanceof ArrayBuffer ? data : data.buffer || data)

  const workbook = {
    SheetNames: [],
    Sheets: {}
  }

  // 解析共享字符串
  const sharedStrings = []
  const sst = zip.files['xl/sharedStrings.xml']
  if (sst) {
    const sstXml = decodeUTF8(sst)
    // 提取 <si> 标签中的文本
    const siRegex = /<si>([\s\S]*?)<\/si>/g
    let siMatch
    while ((siMatch = siRegex.exec(sstXml)) !== null) {
      const siContent = siMatch[1]
      // 提取所有 <t> 标签内容并合并
      const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g
      let text = ''
      let tMatch
      while ((tMatch = tRegex.exec(siContent)) !== null) {
        text += tMatch[1]
      }
      // 处理 XML 实体
      text = text.replace(/&amp;/g, '&')
                 .replace(/&lt;/g, '<')
                 .replace(/&gt;/g, '>')
                 .replace(/&quot;/g, '"')
                 .replace(/&apos;/g, "'")
      sharedStrings.push(text)
    }
  }

  // 解析工作簿
  const wbXml = zip.files['xl/workbook.xml']
  if (wbXml) {
    const wbStr = decodeUTF8(wbXml)
    const sheetRegex = /<sheet\s+name="([^"]+)"[^>]*\/?\s*>/g
    let sheetMatch
    while ((sheetMatch = sheetRegex.exec(wbStr)) !== null) {
      workbook.SheetNames.push(sheetMatch[1])
    }
  }

  // 解析工作表
  for (let i = 0; i < workbook.SheetNames.length; i++) {
    const sheetFile = zip.files[`xl/worksheets/sheet${i + 1}.xml`]
    if (!sheetFile) continue

    const sheetXml = decodeUTF8(sheetFile)
    const sheet = {}

    // 解析单元格
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g
    let rowMatch
    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      const rowContent = rowMatch[1]
      const cellRegex = /<c\s+r="([A-Z]+\d+)"([^>]*)>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g
      const cellSelfRegex = /<c\s+r="([A-Z]+\d+)"([^>]*)\/>/g

      let cellMatch
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const ref = cellMatch[1]
        const attrs = cellMatch[2]
        const value = cellMatch[3]

        let cellValue
        if (attrs.includes('t="s"')) {
          // 共享字符串引用
          cellValue = sharedStrings[parseInt(value)] || ''
        } else if (attrs.includes('t="b"')) {
          cellValue = value === '1'
        } else {
          // 数值
          cellValue = isNaN(value) ? value : Number(value)
        }

        sheet[ref] = { v: cellValue, t: typeof cellValue === 'number' ? 'n' : 's' }
      }
    }

    // 计算范围
    const refs = Object.keys(sheet)
    if (refs.length > 0) {
      let minCol = Infinity, maxCol = 0, minRow = Infinity, maxRow = 0
      for (const ref of refs) {
        const col = ref.replace(/\d+/g, '')
        const row = parseInt(ref.replace(/[A-Z]+/g, ''))
        const colNum = colToNum(col)
        minCol = Math.min(minCol, colNum)
        maxCol = Math.max(maxCol, colNum)
        minRow = Math.min(minRow, row)
        maxRow = Math.max(maxRow, row)
      }
      sheet['!ref'] = numToCol(minCol) + minRow + ':' + numToCol(maxCol) + maxRow
    }

    workbook.Sheets[workbook.SheetNames[i]] = sheet
  }

  return workbook
}

function colToNum(col) {
  let num = 0
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + col.charCodeAt(i) - 64
  }
  return num
}

function numToCol(num) {
  let col = ''
  while (num > 0) {
    const mod = (num - 1) % 26
    col = String.fromCharCode(65 + mod) + col
    num = Math.floor((num - 1) / 26)
  }
  return col
}

// sheet_to_json: 将工作表转为 JSON 数组
function sheet_to_json(sheet, opts) {
  opts = opts || {}
  const defval = opts.defval !== undefined ? opts.defval : undefined

  if (!sheet['!ref']) return []

  const range = sheet['!ref']
  const parts = range.split(':')
  const startCol = colToNum(parts[0].replace(/\d+/g, ''))
  const startRow = parseInt(parts[0].replace(/[A-Z]+/g, ''))
  const endCol = colToNum(parts[1].replace(/\d+/g, ''))
  const endRow = parseInt(parts[1].replace(/[A-Z]+/g, ''))

  // 第一行作为表头
  const headers = []
  for (let c = startCol; c <= endCol; c++) {
    const ref = numToCol(c) + startRow
    const cell = sheet[ref]
    headers.push(cell ? String(cell.v) : `Column${c}`)
  }

  const result = []
  for (let r = startRow + 1; r <= endRow; r++) {
    const row = {}
    let hasData = false
    for (let c = startCol; c <= endCol; c++) {
      const ref = numToCol(c) + r
      const cell = sheet[ref]
      const header = headers[c - startCol]
      if (cell !== undefined) {
        row[header] = cell.v
        hasData = true
      } else if (defval !== undefined) {
        row[header] = defval
      }
    }
    if (hasData) result.push(row)
  }

  return result
}

const utils = { sheet_to_json }
export { read, utils }
export default { read, utils }
