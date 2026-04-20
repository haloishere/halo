function varint(n: number): Uint8Array {
  const out: number[] = [];
  let v = n;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return new Uint8Array(out);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function ld(fieldNumber: number, data: Uint8Array): Uint8Array {
  return concat(varint((fieldNumber << 3) | 2), varint(data.length), data);
}

export function vi(fieldNumber: number, n: number): Uint8Array {
  return concat(varint((fieldNumber << 3) | 0), varint(n));
}

export function str(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function grpcWebFrame(body: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + body.length);
  out[0] = 0;
  new DataView(out.buffer).setUint32(1, body.length, false);
  out.set(body, 5);
  return out;
}
