type Handler<T> = (payload: T) => void;

/**
 * Minimal typed event emitter used by the engine to talk to Vue without importing it.
 * A throwing handler never prevents the remaining handlers from running.
 */
export class TypedEmitter<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler<never>);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler as Handler<never>);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      try {
        (handler as Handler<Events[K]>)(payload);
      } catch (error) {
        console.error(`Engine event handler for "${String(event)}" failed`, error);
      }
    }
  }
}
