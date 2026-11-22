// Tiny stack VM for make.fun's tiny-stack-vm-01-run-20261122: an exact port of
// the reference VM (program/generator/subject/vm.mjs) — every trap, limit and
// edge case matches ISA.md. Node 22, stdlib only, no clock, no randomness.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode table: code = (imm << 4) | (pops << 2) | pushes. HALT (0) and RET
// (52) are valid with code 0; any other byte with code 0 is unknown.
const T = new Uint8Array(256);
for (let o = 16; o <= 22; o++) T[o] = 9;
for (let o = 24; o <= 26; o++) T[o] = 9;
for (let o = 28; o <= 30; o++) T[o] = 9;
for (let o = 32; o <= 34; o++) T[o] = 9;
T[1] = 17; T[2] = 65; T[3] = 4; T[4] = 6; T[5] = 10; T[6] = 11; T[7] = 15;
T[23] = 5; T[27] = 5; T[48] = 32; T[49] = 36; T[50] = 36; T[51] = 32;
T[64] = 5; T[65] = 8; T[80] = 4; T[81] = 4; T[82] = 1; T[83] = 4;

function run(p, inp) {
  const n = p.length;
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let cp = 0;
  const M = new Int32Array(256);
  const out = new Uint8Array(65536);
  let ol = 0, ip = 0, pc = 0, st = 0;
  const end = (e) => ({ o: out.subarray(0, ol), c: e });
  for (;;) {
    if (st === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const o = p[pc];
    const c = T[o];
    if (!c && o !== 0 && o !== 52) return end(5);
    const im = c >> 4;
    if (pc + im >= n) return end(9);
    st++;
    const po = (c >> 2) & 3, pu = c & 3;
    if (sp < po) return end(2);
    if (sp - po + pu > 256) return end(3);
    pc += 1 + im;
    if (o >= 16 && o <= 34 && o !== 23 && o !== 27) {
      const b = D[sp - 1], a = D[sp - 2];
      let r;
      if (o === 16) r = (a + b) | 0;
      else if (o === 17) r = (a - b) | 0;
      else if (o === 18) r = Math.imul(a, b);
      else if (o === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
      else if (o === 20) { if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
      else if (o === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
      else if (o === 22) { if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
      else if (o === 24) r = a & b;
      else if (o === 25) r = a | b;
      else if (o === 26) r = a ^ b;
      else if (o === 28) r = a << (b & 31);
      else if (o === 29) r = a >> (b & 31);
      else if (o === 30) r = (a >>> (b & 31)) | 0;
      else if (o === 32) r = a === b ? 1 : 0;
      else if (o === 33) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      D[sp - 2] = r; sp--;
      continue;
    }
    switch (o) {
      case 0: return end(0);
      case 1: D[sp++] = (p[pc - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[pc - 4] | (p[pc - 3] << 8) | (p[pc - 2] << 16) | (p[pc - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = (-D[sp - 1]) | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 48: case 49: case 50: {
        const rel = ((p[pc - 2] | (p[pc - 1] << 8)) << 16) >> 16;
        let take = true;
        if (o !== 48) { const v = D[--sp]; take = o === 49 ? v === 0 : v !== 0; }
        if (take) pc += rel;
        break;
      }
      case 51:
        if (cp === 64) return end(7);
        C[cp++] = pc;
        pc = p[pc - 2] | (p[pc - 1] << 8);
        break;
      case 52:
        if (cp === 0) return end(8);
        pc = C[--cp];
        break;
      case 64: { const a = D[sp - 1]; if (a < 0 || a >= 256) return end(6); D[sp - 1] = M[a]; break; }
      case 65: { const a = D[sp - 1], v = D[sp - 2]; if (a < 0 || a >= 256) return end(6); sp -= 2; M[a] = v; break; }
      case 80: {
        const s = String(D[sp - 1]);
        if (ol + s.length > 65536) return end(11);
        sp--;
        for (let i = 0; i < s.length; i++) out[ol++] = s.charCodeAt(i);
        break;
      }
      case 81:
        if (ol + 1 > 65536) return end(11);
        out[ol++] = D[--sp] & 255;
        break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return end(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.o);
  writeFileSync(join(O, id, 'exit.txt'), r.c + '\n');
}
