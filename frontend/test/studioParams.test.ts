import { describe, expect, it } from 'vitest';
import { parseStudioParams } from '../src/studio/params';

describe('parseStudioParams', () => {
  it('reads an http or https model address', () => {
    expect(parseStudioParams('?glb=https%3A%2F%2Fcdn.test%2Fm.glb')).toEqual({ glb: 'https://cdn.test/m.glb' });
    expect(parseStudioParams('?glb=http%3A%2F%2F127.0.0.1%3A8333%2Fm.glb')).toEqual({ glb: 'http://127.0.0.1:8333/m.glb' });
  });

  it('accepts same origin paths', () => {
    expect(parseStudioParams('?glb=%2Fmodels%2Fa.glb')).toEqual({ glb: '/models/a.glb' });
  });

  it('refuses anything that is not a glb over http', () => {
    for (const q of ['', '?glb=', '?glb=javascript%3Aalert(1)', '?glb=data%3Amodel%2Fgltf-binary%3Bbase64%2CAA', '?glb=file%3A%2F%2F%2Fetc%2Fpasswd', '?glb=https%3A%2F%2Fcdn.test%2Fa.txt', '?glb=%2F%2Fevil.test%2Fa.glb']) {
      expect(parseStudioParams(q)).toBeNull();
    }
  });
});
