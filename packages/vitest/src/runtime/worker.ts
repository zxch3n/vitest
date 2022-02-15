import { promises as fs } from 'fs'
import process from 'process'
import { resolve } from 'pathe'
import { createBirpc } from 'birpc'
import type { BuiltinEnvironment, ModuleCache, ResolvedConfig, Test, WorkerContext, WorkerRPC } from '../types'
import { distDir } from '../constants'
import { executeInViteNode } from '../node/execute'
import * as t from '../integrations/env'
import { rpc } from './rpc'

// import { withEnv } from './setup'

export async function withEnv(
  name: ResolvedConfig['environment'],
  options: ResolvedConfig['environmentOptions'],
  fn: (ctx: { context: any }) => Promise<void>,
) {
  const context = { context: globalThis }
  const env = await t.environments[name].setup(context, options)
  try {
    await fn(env.context)
  }
  finally {
    await env.teardown(env.context)
  }
}

// let _viteNode: {
//   run: (file: string, config: ResolvedConfig) => Promise<void>
//   collect: (file: string, config: ResolvedConfig) => Promise<void>
// }

let _viteNode: {
  run: (files: string[], config: ResolvedConfig) => Promise<void>
}
let __vitest_worker__: WorkerGlobalState

const moduleCache: Map<string, ModuleCache> = new Map()
const mockMap = {}

async function startViteNode(ctx: WorkerContext, nodeContext: any) {
  // if (_viteNode)
  //   return _viteNode

  const processExit = process.exit

  process.on('beforeExit', (code) => {
    rpc().onWorkerExit(code)
  })

  process.exit = (code = process.exitCode || 0): never => {
    rpc().onWorkerExit(code)
    return processExit(code)
  }

  const { config } = ctx

  const { run } = (await executeInViteNode({
    files: [
      resolve(distDir, 'entry.js'),
    ],
    fetchModule(id) {
      return rpc().fetch(id)
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer)
    },
    moduleCache,
    mockMap,
    nodeContext,
    interopDefault: config.deps.interopDefault ?? true,
    root: config.root,
    base: config.base,
  }))[0]

  return { run }
}

function init(ctx: WorkerContext) {
  if (__vitest_worker__ && ctx.config.threads && ctx.config.isolate)
    throw new Error(`worker for ${ctx.files.join(',')} already initialized by ${__vitest_worker__.ctx.files.join(',')}. This is probably an internal bug of Vitest.`)

  process.stdout.write('\0')

  const { config, port } = ctx

  // @ts-expect-error I know what I am doing :P
  globalThis.__vitest_worker__ = {
    ctx,
    moduleCache,
    config,
    rpc: createBirpc<WorkerRPC>(
      {},
      {
        eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
        post(v) { port.postMessage(v) },
        on(fn) { port.addListener('message', fn) },
      },
    ),
  }

  if (ctx.invalidates)
    ctx.invalidates.forEach(i => moduleCache.delete(i))
  ctx.files.forEach(i => moduleCache.delete(i))
}

export async function run(ctx: WorkerContext) {
  init(ctx)
  await Promise.all(ctx.files.map(async(file) => {
    const code = await fs.readFile(file, 'utf-8')

    const env = code.match(/@(?:vitest|jest)-environment\s+?([\w-]+)\b/)?.[1] || ctx.config.environment || 'node'

    if (!['node', 'jsdom', 'happy-dom'].includes(env))
      throw new Error(`Unsupported environment: ${env}`)

    await withEnv(env as BuiltinEnvironment, ctx.config.environmentOptions || {}, async(context) => {
      const { run } = await startViteNode(ctx, context)
      return run(file, ctx.config)
    })
  }))
}

declare global {
  let __vitest_worker__: import('vitest').WorkerGlobalState
}
