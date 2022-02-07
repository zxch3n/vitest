import { importModule } from 'local-pkg'
import type { Environment, JSDOMOptions } from '../../types'
import { createProcessObject } from './utils'
// import { KEYS } from './jsdom-keys'

export default <Environment>({
  name: 'jsdom',
  async setup(ctx, { jsdom = {} }) {
    const {
      CookieJar,
      JSDOM,
      ResourceLoader,
      VirtualConsole,
    } = await importModule('jsdom') as typeof import('jsdom')
    const {
      html = '<!DOCTYPE html>',
      userAgent,
      url = 'http://localhost:3000',
      contentType = 'text/html',
      pretendToBeVisual = true,
      includeNodeLocations = false,
      runScripts = 'dangerously',
      resources,
      console = false,
      cookieJar = false,
      ...restOptions
    } = jsdom as JSDOMOptions
    const dom = new JSDOM(
      html,
      {
        pretendToBeVisual,
        resources: resources ?? (userAgent ? new ResourceLoader({ userAgent }) : undefined),
        runScripts,
        url,
        virtualConsole: console && globalThis.console ? new VirtualConsole().sendTo(globalThis.console) : undefined,
        cookieJar: cookieJar ? new CookieJar() : undefined,
        includeNodeLocations,
        contentType,
        userAgent,
        ...restOptions,
      },
    )

    const global = dom.window.document.defaultView!

    global.global = global
    global.process = createProcessObject()

    return {
      get context() {
        return dom.getInternalVMContext()
      },
      teardown() {
        global.close()
        // keys.forEach(key => delete global[key])
      },
    }
  },
})
