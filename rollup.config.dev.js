import { readdirSync, accessSync } from 'node:fs'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'
import resolve from '@rollup/plugin-node-resolve'
import postcss from 'rollup-plugin-postcss'
import postcssPresetEnv from 'postcss-preset-env'
import commonjs from '@rollup/plugin-commonjs'

function getPageEntries() {
  try {
    return Object.fromEntries(
      readdirSync('src/pages', { recursive: true })
        .filter((f) => f.endsWith('.js'))
        .map((f) => {
          const normalized = f.replace(/\\/g, '/')
          return [normalized.replace(/\.js$/, ''), `src/pages/${normalized}`]
        })
    )
  } catch {
    return {}
  }
}

function checkGlobalJs() {
  return {
    name: 'check-global-js',
    buildStart() {
      try {
        accessSync('src/components/global.js')
      } catch {
        this.warn(
          'src/components/global.js not found. Global initialization will be skipped at runtime.'
        )
      }
    },
  }
}

export default defineConfig({
  input: {
    main: 'src/main.js',
    ...getPageEntries(),
  },
  output: {
    // Dev output is kept out of dist/ on purpose. dist/ is the deploy
    // artifact and is committed; a watch build writing into it overwrites
    // the shipped bundle with unminified, console-laden, sourcemapped code.
    dir: 'dev',
    format: 'es',
    entryFileNames: '[name].js',
    // No content hash here, unlike prod. The hash exists to bust the CDN
    // cache, and jsDelivr is not involved in dev — http-server runs with
    // -c-1. With a hash, every save emits a new filename and the old chunk
    // is never cleaned up, so the directory grows by one file per edit.
    chunkFileNames: '[name].js',
    sourcemap: true,
  },
  plugins: [
    del({ targets: 'dev/*', runOnce: true }),
    checkGlobalJs(),
    resolve(),
    commonjs(),
    postcss({
      plugins: [postcssPresetEnv({ stage: 2 })],
      extract: 'styles.css',
      minimize: true,
      sourceMap: true,
    }),
  ],
})
