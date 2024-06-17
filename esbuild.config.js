const esbuild = require('esbuild');

Promise.all([
  esbuild.build({
    entryPoints: ['relay-worker.js'],
    bundle: true,
    outfile: 'dist/relay-worker.js',
    platform: 'neutral',
    target: 'es2020',
    format: 'esm',
    allowOverwrite: true,
  }),
  esbuild.build({
    entryPoints: ['event-worker.js'],
    bundle: true,
    outfile: 'dist/event-worker.js',
    platform: 'neutral',
    target: 'es2020',
    format: 'esm',
    allowOverwrite: true,
  }),
  esbuild.build({
    entryPoints: ['req-worker.js'],
    bundle: true,
    outfile: 'dist/req-worker.js',
    platform: 'neutral',
    target: 'es2020',
    format: 'esm',
    allowOverwrite: true,
  })
]).catch(() => process.exit(1));