import vm from 'vm'
import { importModule } from 'local-pkg'
import type { Environment } from '../../types'
import { createProcessObject } from './utils'

export default <Environment>({
  name: 'happy-dom',
  async setup() {
    const { Window } = await importModule('happy-dom') as typeof import('happy-dom')
    const win: any = new Window()

    const context = vm.createContext(win)

    win.global = win
    win.process = createProcessObject()

    return {
      get context() {
        return context
      },
      teardown() {
        win.happyDOM.cancelAsync()
        // keys.forEach(key => delete global[key])
      },
    }
  },
})
