/**
 * Whether the browser can create a WebGL context. Without one the app shows the list view instead of the map.
 */
export function supportsWebGL(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
