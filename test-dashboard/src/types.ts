export interface TestCase {
  name: string
  fullName?: string
  passed: boolean
  duration?: number
  error?: string
  steps?: string[]
}

export interface TestSuite {
  name: string
  total: number
  passed: number
  failed: number
  skipped?: number
  duration?: number
  tests: TestCase[]
}

export interface TestSuiteResult {
  backend?: TestSuite
  frontend?: TestSuite
  timestamp: string
}
