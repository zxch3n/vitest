import vm from 'vm'
import type { Environment } from '../../types'
import { createProcessObject } from './utils'

export default <Environment>({
  name: 'node',
  async setup(ctx) {
    ctx.context = vm.createContext()
    const global = vm.runInContext(
      'this',
      ctx.context,
    )
    global.global = global
    global.clearInterval = clearInterval
    global.clearTimeout = clearTimeout
    global.setInterval = setInterval
    global.setTimeout = setTimeout
    global.Buffer = Buffer
    global.setImmediate = setImmediate
    global.clearImmediate = clearImmediate
    global.ArrayBuffer = ArrayBuffer
    global.Uint8Array = Uint8Array
    global.process = createProcessObject()
    // URL and URLSearchParams are global in Node >= 10
    if (typeof URL !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      global.URL = URL
      global.URLSearchParams = URLSearchParams
    }
    // TextDecoder and TextDecoder are global in Node >= 11
    if (
      typeof TextEncoder !== 'undefined'
      && typeof TextDecoder !== 'undefined'
    ) {
      global.TextEncoder = TextEncoder
      global.TextDecoder = TextDecoder
    }
    // queueMicrotask is global in Node >= 11
    if (typeof queueMicrotask !== 'undefined')
      global.queueMicrotask = queueMicrotask

    // AbortController is global in Node >= 15
    if (typeof AbortController !== 'undefined')
      global.AbortController = AbortController

    // AbortSignal is global in Node >= 15
    if (typeof AbortSignal !== 'undefined')
      global.AbortSignal = AbortSignal

    // Event is global in Node >= 15.4
    if (typeof Event !== 'undefined')
      global.Event = Event

    // EventTarget is global in Node >= 15.4
    if (typeof EventTarget !== 'undefined')
      global.EventTarget = EventTarget

    // performance is global in Node >= 16
    if (typeof performance !== 'undefined')
      global.performance = performance

    // atob and btoa are global in Node >= 16
    if (typeof atob !== 'undefined' && typeof btoa !== 'undefined') {
      global.atob = atob
      global.btoa = btoa
    }
    return {
      context: ctx.context,
      teardown() {
      },
    }
  },
})
