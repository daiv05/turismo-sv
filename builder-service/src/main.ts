import { createApp } from './server';
import { ThumbnailRenderer } from './render';

const token = process.env.BUILDER_TOKEN;
if (!token || token.length < 16) {
  console.error('BUILDER_TOKEN must be set to a secret of at least 16 characters');
  process.exit(1);
}

const renderer = new ThumbnailRenderer({ chromiumPath: process.env.CHROMIUM_PATH });
const server = createApp({ token, renderer });
const port = Number(process.env.PORT ?? 3100);

server.listen(port, '0.0.0.0', () => console.log(`builder-service listening on ${port}`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void renderer.close().finally(() => process.exit(0));
  });
}
