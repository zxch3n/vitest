import { existsSync, promises as fs } from 'fs'
import { dirname, resolve } from 'pathe'
import type { Vitest } from '../../node'
import type { File, Reporter, Suite, TaskState, Test } from '../../types'
import { getSuites, getTests } from '../../utils'

// for compatibility reasons, the reporter produces a JSON similar to the one produced by the Jest JSON reporter
// the following types are extracted from the Jest repository (and simplified)
// the commented-out fields are the missing ones

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled'
type Milliseconds = number
const StatusMap: Record<TaskState, Status> = {
  fail: 'failed',
  only: 'pending',
  pass: 'passed',
  run: 'pending',
  skip: 'skipped',
  todo: 'todo',
}

interface FormattedAssertionResult {
  ancestorTitles: Array<string>
  fullName: string
  status: Status
  title: string
  duration?: Milliseconds | null
  failureMessages: Array<string>
  // location?: Callsite | null
}

interface FormattedTestResult {
  message: string
  name: string
  status: 'failed' | 'passed'
  startTime: number
  endTime: number
  assertionResults: Array<FormattedAssertionResult>
  // summary: string
  // coverage: unknown
}

interface FormattedTestResults {
  numFailedTests: number
  numFailedTestSuites: number
  numPassedTests: number
  numPassedTestSuites: number
  numPendingTests: number
  numPendingTestSuites: number
  numTodoTests: number
  numTotalTests: number
  numTotalTestSuites: number
  startTime: number
  success: boolean
  testResults: Array<FormattedTestResult>
  // coverageMap?: CoverageMap | null | undefined
  // numRuntimeErrorTestSuites: number
  // snapshot: SnapshotSummary
  // wasInterrupted: boolean
}

export class JsonReporter implements Reporter {
  start = 0
  ctx!: Vitest

  onInit(ctx: Vitest): void {
    this.ctx = ctx
    this.start = Date.now()
  }

  protected async logTasks(files: File[]) {
    const suites = getSuites(files)
    const numTotalTestSuites = suites.length
    const fileToTestCases = new Map<File, Test[]>()

    for (const file of files) {
      const relatedTests = getTests([file])
      fileToTestCases.set(file, relatedTests)
    }

    const tests = [...fileToTestCases.values()].flat()
    const numTotalTests = tests.length
    const numFailedTestSuites = suites.filter(s => s.result?.error).length
    const numPassedTestSuites = numTotalTestSuites - numFailedTestSuites
    const numPendingTestSuites = suites.filter(s => s.result?.state === 'run').length
    const numFailedTests = tests.filter(t => t.result?.state === 'fail').length
    const numPassedTests = numTotalTests - numFailedTests
    const numPendingTests = tests.filter(t => t.result?.state === 'run').length
    const numTodoTests = tests.filter(t => t.mode === 'todo').length
    const testResults: Array<FormattedTestResult> = []

    const success = numFailedTestSuites === 0 && numFailedTests === 0

    for (const [file, tests] of fileToTestCases) {
      let startTime = tests.reduce((prev, next) => Math.min(prev, next.result?.startTime ?? Infinity), Infinity)
      if (startTime === Infinity)
        startTime = this.start

      const endTime = tests.reduce((prev, next) => Math.max(prev, (next.result?.startTime ?? 0) + (next.result?.duration ?? 0)), startTime)
      const assertionResults = tests.map((t) => {
        const ancestorTitles = [] as string[]
        let iter: Suite | undefined = t.suite
        while (iter) {
          ancestorTitles.push(iter.name)
          iter = iter.suite
        }
        ancestorTitles.reverse()

        return {
          ancestorTitles,
          fullName: ancestorTitles.length > 0 ? `${ancestorTitles.join(' ')} ${t.name}` : t.name,
          status: t.result != null ? StatusMap[t.result.state] : 'skipped',
          title: t.name,
          duration: t.result?.duration,
          failureMessages: t.result?.error?.message == null ? [] : [t.result.error.message],
        } as FormattedAssertionResult
      })

      testResults.push({
        assertionResults,
        startTime,
        endTime,
        status: tests.every(t =>
          t.result?.state === 'pass'
           || t.result?.state === 'skip'
            || t.result?.state === 'todo')
          ? 'passed'
          : 'failed',
        message: file.result?.error?.message ?? '',
        name: file.filepath,
      })
    }

    const result: FormattedTestResults = {
      numTotalTestSuites,
      numPassedTestSuites,
      numFailedTestSuites,
      numPendingTestSuites,
      numTotalTests,
      numPassedTests,
      numFailedTests,
      numPendingTests,
      numTodoTests,
      startTime: this.start,
      success,
      testResults,
    }

    await this.writeReport(JSON.stringify(result, null, 2))
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    await this.logTasks(files)
  }

  /**
   * Writes the report to an output file if specified in the config,
   * or logs it to the console otherwise.
   * @param report
   */
  async writeReport(report: string) {
    if (this.ctx.config.outputFile) {
      const reportFile = resolve(this.ctx.config.root, this.ctx.config.outputFile)

      const outputDirectory = dirname(reportFile)
      if (!existsSync(outputDirectory))
        await fs.mkdir(outputDirectory, { recursive: true })

      await fs.writeFile(reportFile, report, 'utf-8')
      this.ctx.log(`JSON report written to ${reportFile}`)
    }
    else {
      this.ctx.log(report)
    }
  }
}
