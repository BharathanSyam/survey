/* Small QR code generator (byte mode, medium error correction).
   Follows the QR Code Model 2 standard; written for this survey tool so no
   outside QR service is ever used. QR.make(text) -> {size, get(x, y)} */
(function (root) {
  'use strict';
  var ECC = { L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28] };
  var BLOCKS = { L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49] };
  var FORMAT = { L: 1, M: 0 };

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v, e) { return Math.floor(rawModules(v) / 8) - ECC[e][v] * BLOCKS[e][v]; }
  function gfMul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < deg; i++) {
      for (var j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = gfMul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= gfMul(c, f); });
    });
    return r;
  }
  function utf8(s) {
    if (root.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(s));
    var out = [], e = unescape(encodeURIComponent(s));
    for (var i = 0; i < e.length; i++) out.push(e.charCodeAt(i));
    return out;
  }

  function make(text, ecl, forceMask) {
    ecl = ecl || 'M';
    var bytes = utf8(text), ver, cap;
    for (ver = 1; ver <= 40; ver++) {
      var ccBits = ver <= 9 ? 8 : 16;
      cap = dataCodewords(ver, ecl) * 8;
      if (4 + ccBits + bytes.length * 8 <= cap) break;
    }
    if (ver > 40) throw new Error('Text too long for a QR code');
    // data bits
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    // error correction and interleaving
    var nb = BLOCKS[ecl][ver], el = ECC[ecl][ver], raw = Math.floor(rawModules(ver) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(el), blocks = [], k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) for (j = 0; j < blocks.length; j++) if (i !== shortLen - el || j >= nShort) all.push(blocks[j][i]);

    var size = ver * 4 + 17, mod = [], fn = [];
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, d) { mod[y][x] = d; fn[y][x] = true; }
    // timing
    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    // finders
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
      }
    });
    // alignment
    var pos = [];
    if (ver > 1) {
      var na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
      pos = [6];
      for (var p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
    }
    pos.forEach(function (a, ai) {
      pos.forEach(function (b, bi) {
        if ((ai === 0 && bi === 0) || (ai === 0 && bi === pos.length - 1) || (ai === pos.length - 1 && bi === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    function formatBits(mask) {
      var d = FORMAT[ecl] << 3 | mask, r = d;
      for (var i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var bitsF = ((d << 10) | r) ^ 0x5412;
      function g(i) { return ((bitsF >>> i) & 1) !== 0; }
      for (i = 0; i <= 5; i++) setF(8, i, g(i));
      setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for (i = 9; i < 15; i++) setF(14 - i, 8, g(i));
      for (i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i));
      for (i = 8; i < 15; i++) setF(8, size - 15 + i, g(i));
      setF(8, size - 8, true);
    }
    formatBits(0);
    if (ver >= 7) {
      var r = ver;
      for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var vb = ver << 12 | r;
      for (i = 0; i < 18; i++) { var bit = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, b2 = Math.floor(i / 3); setF(a, b2, bit); setF(b2, a, bit); }
    }
    // codewords, zigzag
    var bi2 = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi2 < all.length * 8) { mod[y][x] = ((all[bi2 >>> 3] >>> (7 - (bi2 & 7))) & 1) !== 0; bi2++; }
      }
    }
    function applyMask(m) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        if (fn[y][x]) continue;
        var inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (inv) mod[y][x] = !mod[y][x];
      }
    }
    function penalty() {
      var s = 0, dark = 0, x, y;
      function lineScore(get) {
        var sc = 0;
        for (var a = 0; a < size; a++) {
          var run = 1, line = [];
          for (var b = 0; b < size; b++) {
            line.push(get(a, b) ? 1 : 0);
            if (b > 0) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) sc += 3; else if (run > 5) sc++; } else run = 1; }
          }
          var str = line.join('');
          var m1 = str.split('1011101').length - 1;
          for (var q = 0; q + 11 <= size; q++) {
            var seg = str.substr(q, 11);
            if (seg === '10111010000' || seg === '00001011101') sc += 40;
          }
          void m1;
        }
        return sc;
      }
      s += lineScore(function (a, b) { return mod[a][b]; });
      s += lineScore(function (a, b) { return mod[b][a]; });
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
        var c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) s += 3;
      }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
      var total = size * size, kk = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      return s + Math.max(0, kk) * 10;
    }
    var best = 2, bestScore = Infinity;
    // all eight masks are valid; these four read most reliably on phone cameras
    [2, 3, 4, 7].forEach(function (m) {
      applyMask(m); formatBits(m);
      var sc = penalty();
      if (sc < bestScore) { bestScore = sc; best = m; }
      applyMask(m);
    });
    if (forceMask !== undefined) best = forceMask;
    applyMask(best); formatBits(best);
    return { size: size, version: ver, mask: best, get: function (x, y) { return x >= 0 && y >= 0 && x < size && y < size && mod[y][x]; } };
  }

  /** Draw onto a canvas with a 4-module quiet zone */
  function draw(canvas, text, px, color) {
    var qr = make(text), border = 4, n = qr.size + border * 2;
    var scale = Math.max(1, Math.floor((px || 600) / n));
    canvas.width = canvas.height = n * scale;
    var c = canvas.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = color || '#000';
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) if (qr.get(x, y)) c.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    return qr;
  }

  root.QR = { make: make, draw: draw };
  if (typeof module !== 'undefined') module.exports = root.QR;
})(typeof window !== 'undefined' ? window : this);
