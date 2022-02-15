import process from 'process'
import type { ResolvedConfig } from '../types'
import { setupGlobalEnv } from './setup'
import { startTests } from './run'

export async function run(file: string, config: ResolvedConfig): Promise<void> {
  await setupGlobalEnv(config)

  process.__vitest_worker__.filepath = file

  await startTests([file], config)

  if (!['node', 'jsdom', 'happy-dom'].includes(env))
    throw new Error(`Unsupported environment: ${env}`)

  __vitest_worker__.filepath = file

  await withEnv(env as BuiltinEnvironment, config.environmentOptions || {}, async() => {
    await startTests([file], config)
  })

  __vitest_worker__.filepath = undefined
}
