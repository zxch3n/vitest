import process from 'process'
import type { ResolvedConfig } from '../types'
import { setupGlobalEnv } from './setup'
import { startTests } from './run'

export async function run(file: string, config: ResolvedConfig): Promise<void> {
  await setupGlobalEnv(config)

  process.__vitest_worker__.filepath = file

  await startTests([file], config)

  process.__vitest_worker__.filepath = undefined
}
