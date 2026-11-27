import * as esbuild from 'esbuild'
import { createRequire } from 'module';
import commandLineArgs from 'command-line-args'
import path from 'path';
import { writeFileSync } from 'fs';
import fs from 'node:fs';
import { spawn } from 'child_process';
import vuePlugin from 'esbuild-vue/src/index.js';
const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const options = commandLineArgs([
    {name: 'target', type: String},
    {name: 'watch', type: Boolean},
    {name: 'serve', type: Boolean},
    {name: 'launch', type: Boolean},
    {name: 'host', type: String},
    {name: 'port', type: Number},
    {name: 'analyze', type: Boolean},
])

function conditionalImportPlugin(name, config) {
    return {
        name: 'conditional-import-plugin-'+name,
        /**
         * @param {esbuild.PluginBuild} build
         */
        setup(build) {
            build.onResolve({ filter: config.filter }, args => {
                if (config.library) {
                    return { path: path.join(process.cwd(), 'node_modules', path.dirname(args.path), config.file) };
                } else {
                    return { path: path.join(args.resolveDir, path.dirname(args.path), config.file) };
                }
            });
        }
    };
};
/**
 * Load GLSL shader files as strings. Same functionality as the
 * esbuild-plugin-glsl package, which is not used here because newer versions
 * of it require a newer Node.js version than the one supported by the
 * Windows 7 build.
 */
function glslPlugin(should_minify) {
    return {
        name: 'glsl-plugin',
        setup(build) {
            build.onLoad({ filter: /\.(glsl|vert|frag)$/ }, async (args) => {
                let contents = await fs.promises.readFile(args.path, 'utf8');
                if (should_minify) {
                    contents = contents
                        .split('\n')
                        .map(line => line.trim().startsWith('#') ? line.trim() : line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '').trim())
                        .filter(line => line.length > 0)
                        .join('\n');
                }
                return { contents, loader: 'text' };
            });
        }
    };
};
function createJsonPlugin(ext_suffix, namespace) {
    return {
        name: `${namespace}-plugin`,
        setup(build) {
            // Intercept import paths with the specified extension
            build.onResolve({ filter: new RegExp(`${ext_suffix}$`) }, args => ({
                path: path.join(
                    args.resolveDir,
                    args.path
                ),
                namespace: `${namespace}-ns`,
            }))

            // Load paths tagged with the given namespace and treat them as JSON
            build.onLoad({ filter: /.*/, namespace: `${namespace}-ns` }, async (args) => {
                // Read the content of the file
                const content = await fs.promises.readFile(args.path, 'utf8');

                // Return the content as JSON
                return {
                    contents: content,
                    loader: 'json',
                }
            })
        }
    };
};

let electron_process = null;
function createElectronPlugin() {
    if (!isApp || !options.launch) return null;
    return {
        name: 'electron-launcher',
        setup(build) {
            build.onEnd((result) => {
                if (result.errors.length > 0) return;

                if (!electron_process) {
                    electron_process = spawn('electron', ['.', '--remote-debugging-port=9223'], {
                        stdio: 'inherit',
                        shell: true,
                    });

                    electron_process.on('close', () => process.exit(0));
                }
            })
        }
    }
}

const isApp = options.target == 'electron';
const dev_mode = options.watch || options.serve;
const minify = !dev_mode;

/**
 * @type {esbuild.BuildOptions} BuildOptions
 */
const config = {
    entryPoints: ['./js/main.js'],
    define: {
        isApp: isApp.toString(),
        appVersion: `"${pkg.version}"`,
        // `global` only exists in the renderer because of Node integration,
        // map it to `globalThis` so the bundle also runs without it.
        global: 'globalThis',
    },
    platform: 'node',
    // Chromium 108 / Node 16.16 ship with Electron 22, which is the last
    // version that runs on Windows 7 and 8. A newer target would produce
    // syntax and APIs that this browser can not handle.
    target: 'chrome108',
    // The web build is an ES module that is loaded from a server. The desktop
    // build is an IIFE, because Chromium loads `<script type="module">` with
    // CORS, and that always fails for local files. See build-electron.mjs.
    format: isApp ? 'iife' : 'esm',
    bundle: true,
    minify,
    outfile: isApp ? './dist/bundle.electron.js' : './dist/bundle.js',
    mainFields: ['module', 'main'],
    logLevel: 'info',
    logOverride: {
        'commonjs-variable-in-esm': 'silent'
    },
    external: [
        'electron',
    ],
    loader: {
        '.bbtheme': 'text',
        '.png': 'dataurl'
    },
    plugins: [
        conditionalImportPlugin(2, {
            filter: /native_apis/,
            file: isApp ? 'native_apis.ts' : 'native_apis_web.ts'
        }),
        conditionalImportPlugin(3, {
            filter: /vue.js/,
            file: dev_mode ? 'vue.js' : 'vue.min.js',
            library: true,
        }),
        conditionalImportPlugin(1, {
            filter: /desktop/,
            file: isApp ? 'desktop.ts' : 'web.ts'
        }),
        createJsonPlugin('.bbkeymap', 'bbkeymap'),
        vuePlugin(),
        glslPlugin(minify),
        createElectronPlugin(),
    ].filter(plugin => plugin != null),
    sourcemap: true,
}

if (options.watch || options.serve) {
    let ctx = await esbuild.context(config);
    if (isApp) {
        await ctx.watch({});
    } else {
        await ctx.serve({
            servedir: process.cwd(),
            host: options.host,
            port: options.port
        });
    }
} else {
    if (options.analyze) config.metafile = true;
    let result = await esbuild.build(config);
    if (options.analyze) {
        writeFileSync('./dist/esbuild-metafile.json', JSON.stringify(result.metafile))
    }
}
