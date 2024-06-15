const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/index.mjs'],
  bundle: true,
  outfile: 'dist/worker.js',
  platform: 'neutral',
  target: 'es2020',
  format: 'esm',
  loader: {
    '.js': 'jsx'
  }
}).catch(() => process.exit(1));