import { describe, expect, it, vi } from 'vitest';
import { TypedEmitter } from '../src/engine/emitter';

interface Events {
  select: { id: string };
  ready: undefined;
}

describe('TypedEmitter', () => {
  it('delivers payloads to subscribers', () => {
    const emitter = new TypedEmitter<Events>();
    const handler = vi.fn();
    emitter.on('select', handler);
    emitter.emit('select', { id: 'a' });
    expect(handler).toHaveBeenCalledWith({ id: 'a' });
  });

  it('stops delivering after unsubscribe', () => {
    const emitter = new TypedEmitter<Events>();
    const handler = vi.fn();
    const off = emitter.on('select', handler);
    off();
    emitter.emit('select', { id: 'a' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps notifying other handlers when one throws', () => {
    const emitter = new TypedEmitter<Events>();
    const second = vi.fn();
    emitter.on('ready', () => {
      throw new Error('boom');
    });
    emitter.on('ready', second);
    expect(() => emitter.emit('ready', undefined)).not.toThrow();
    expect(second).toHaveBeenCalled();
  });
});
