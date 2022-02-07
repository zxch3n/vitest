import process from 'process'

export const rpc = () => {
  return process.__vitest_worker__!.rpc
}
