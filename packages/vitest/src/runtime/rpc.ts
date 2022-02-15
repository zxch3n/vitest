import process from 'process'

export const rpc = () => {
  return __vitest_worker__!.rpc
}
