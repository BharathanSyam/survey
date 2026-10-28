/* Minimal QR code encoder (byte mode, error correction M, versions 1-15).
 * Written for the Survey Tool so QR codes are drawn on your own site, with no outside service. */
var QR = (function () {
  'use strict';
  // [ec codewords per block, blocks in group 1, data codewords per block g1, blocks g2, data per block g2]
  var M = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44], [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70]];

  function utf8(s) { var out = [], e = unescape(encodeURIComponent(s)); for (var i = 0; i < e.length; i++) out.push(e.charCodeAt(i)); return out; }
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function divisor(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < deg; i++) { for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 2); }
    return r;
  }
  function remainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= mul(c, f); }); });
    return r;
  }
  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  function encode(text) {
    var bytes = utf8(text), ver = 0;
    for (var v = 1; v <= 15; v++) {
      var t = M[v], cap = 8 * (t[1] * t[2] + t[3] * t[4]), cc = v < 10 ? 8 : 16;
      if (4 + cc + 8 * bytes.length <= cap) { ver = v; break; }
    }
    if (!ver) throw new Error('Text too long for a QR code');
    var T = M[ver], capBits = 8 * (T[1] * T[2] + T[3] * T[4]), ccBits = ver < 10 ? 8 : 16;
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4); push(bytes.length, ccBits); bytes.forEach(function (b) { push(b, 8); });
    push(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
    for (var p = 0; data.length < capBits / 8; p++) data.push(p % 2 ? 0x11 : 0xEC);
    // blocks
    var blocks = [], pos = 0, div = divisor(T[0]);
    [[T[1], T[2]], [T[3], T[4]]].forEach(function (g) { for (var n = 0; n < g[0]; n++) { var d = data.slice(pos, pos + g[1]); pos += g[1]; blocks.push({ d: d, e: remainder(d, div) }); } });
    var all = [], maxD = Math.max.apply(null, blocks.map(function (b) { return b.d.length; }));
    for (i = 0; i < maxD; i++) blocks.forEach(function (b) { if (i < b.d.length) all.push(b.d[i]); });
    for (i = 0; i < T[0]; i++) blocks.forEach(function (b) { all.push(b.e[i]); });

    var size = ver * 4 + 17, mod = [], fn = [];
    for (var y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, d) { mod[y][x] = d; fn[y][x] = true; }
    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var xx = c[0] + dx, yy = c[1] + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, dist !== 2 && dist !== 4);
      }
    });
    var al = ALIGN[ver], n = al.length;
    for (i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++) setF(al[i] + dx2, al[j] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    function drawFormat(mask) {
      var d = (0 << 3) | mask, rem = d;
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((d << 10) | rem) ^ 0x5412;
      for (q = 0; q <= 5; q++) setF(8, q, bit(f, q));
      setF(8, 7, bit(f, 6)); setF(8, 8, bit(f, 7)); setF(7, 8, bit(f, 8));
      for (q = 9; q < 15; q++) setF(14 - q, 8, bit(f, q));
      for (q = 0; q < 8; q++) setF(size - 1 - q, 8, bit(f, q));
      for (q = 8; q < 15; q++) setF(8, size - 15 + q, bit(f, q));
      setF(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var r2 = ver; for (i = 0; i < 12; i++) r2 = (r2 << 1) ^ ((r2 >>> 11) * 0x1F25);
      var vb = (ver << 12) | r2;
      for (i = 0; i < 18; i++) { var c = bit(vb, i), a = size - 11 + (i % 3), bb = Math.floor(i / 3); setF(a, bb, c); setF(bb, a, c); }
    }
    // data
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, yy2 = up ? size - 1 - vert : vert;
        if (!fn[yy2][x] && idx < all.length * 8) { mod[yy2][x] = bit(all[idx >>> 3], 7 - (idx & 7)); idx++; }
      }
    }
    function applyMask(m) {
      for (var y3 = 0; y3 < size; y3++) for (var x3 = 0; x3 < size; x3++) {
        if (fn[y3][x3]) continue;
        var inv;
        switch (m) {
          case 0: inv = (x3 + y3) % 2 === 0; break; case 1: inv = y3 % 2 === 0; break; case 2: inv = x3 % 3 === 0; break;
          case 3: inv = (x3 + y3) % 3 === 0; break; case 4: inv = (Math.floor(x3 / 3) + Math.floor(y3 / 2)) % 2 === 0; break;
          case 5: inv = (x3 * y3) % 2 + (x3 * y3) % 3 === 0; break; case 6: inv = ((x3 * y3) % 2 + (x3 * y3) % 3) % 2 === 0; break;
          default: inv = ((x3 + y3) % 2 + (x3 * y3) % 3) % 2 === 0;
        }
        if (inv) mod[y3][x3] = !mod[y3][x3];
      }
    }
    function penalty() {
      var s = 0, dark = 0, y4, x4;
      for (y4 = 0; y4 < size; y4++) {
        for (var dir = 0; dir < 2; dir++) {
          var run = 1;
          for (x4 = 1; x4 < size; x4++) {
            var a1 = dir ? mod[x4][y4] : mod[y4][x4], a0 = dir ? mod[x4 - 1][y4] : mod[y4][x4 - 1];
            if (a1 === a0) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1;
          }
        }
      }
      for (y4 = 0; y4 < size - 1; y4++) for (x4 = 0; x4 < size - 1; x4++) { var c0 = mod[y4][x4]; if (c0 === mod[y4][x4 + 1] && c0 === mod[y4 + 1][x4] && c0 === mod[y4 + 1][x4 + 1]) s += 3; }
      var pat = [true, false, true, true, true, false, true];
      for (y4 = 0; y4 < size; y4++) for (x4 = 0; x4 + 6 < size; x4++) {
        var h = true, v2 = true;
        for (var k2 = 0; k2 < 7; k2++) { if (mod[y4][x4 + k2] !== pat[k2]) h = false; if (mod[x4 + k2][y4] !== pat[k2]) v2 = false; }
        if (h) s += 40; if (v2) s += 40;
      }
      for (y4 = 0; y4 < size; y4++) for (x4 = 0; x4 < size; x4++) if (mod[y4][x4]) dark++;
      s += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return s;
    }
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) { applyMask(m); drawFormat(m); var pp = penalty(); if (pp < bestP) { bestP = pp; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size: size, version: ver, modules: mod };
  }

  // Draw onto a canvas with a 4-module quiet zone.
  function toCanvas(text, canvas, scale) {
    var q = encode(text), s = scale || 10, border = 4, px = (q.size + border * 2) * s;
    canvas.width = px; canvas.height = px;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px); ctx.fillStyle = '#000';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.modules[y][x]) ctx.fillRect((x + border) * s, (y + border) * s, s, s);
    return q;
  }
  return { encode: encode, toCanvas: toCanvas };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = QR;
