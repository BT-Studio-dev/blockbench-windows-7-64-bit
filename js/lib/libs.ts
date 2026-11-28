import * as GIFEnc from 'gifenc'
import $ from 'jquery'
import * as threejs from "three"
import Vue from 'vue/dist/vue.js'
import JSZip from 'jszip'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import GIF from './gif'
import vSortable from 'vue-sortable'
import Sortable from 'sortablejs'
import {marked} from 'marked'
import { APNGencoder } from './canvas2apng'
import DOMPurify from 'dompurify'
// VuePrismEditor is a UMD bundle. Inside an esbuild bundle the shim always
// provides `exports`/`module`, so the library takes its CommonJS branch and
// assigns the component to its own local `exports` object instead of
// `window.VuePrismEditor`. The app references it as a global (see
// js/interface/themes.ts), so re-export it onto the window explicitly.
// `import * as` keeps the assignment working for both the IIFE desktop build
// and the ES module web build.
import * as VuePrismEditorModule from './VuePrismEditor.min'
const VuePrismEditor = (VuePrismEditorModule as any).default ?? VuePrismEditorModule;
(window as any).VuePrismEditor = VuePrismEditor;

Vue.use(vSortable)
Vue.directive('sortable', {
    inserted: function (el, binding) {
        new Sortable(el, binding.value || {})
    }
})

const THREE = Object.assign({}, threejs);

export {
    GIFEnc,
    GIF,
    THREE,
    $,
    $ as jQuery,
    Vue,
    JSZip,
    Prism,
    marked,
    APNGencoder,
    DOMPurify,
}
const global = {
    GIFEnc,
    THREE,
    jQuery: $,
    $,
    Vue,
    JSZip,
    Prism,
    marked,
    APNGencoder,
    DOMPurify,
}
Object.assign(window, global);
