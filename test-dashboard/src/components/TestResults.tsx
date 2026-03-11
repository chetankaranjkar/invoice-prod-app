import type { TestSuiteResult } from '../types'
import { SuiteCard } from './SuiteCard'

interface Props {
  results: TestSuiteResult
}

export function TestResults({ results }: Props) {
  const hasBackend = results.backend && results.backend.tests.length > 0
  const hasFrontend = results.frontend && results.frontend.tests.length > 0

  return (
    <div className="mt-8 space-y-8">
      <p className="text-sm text-slate-500">
        Last run: {new Date(results.timestamp).toLocaleString()}
      </p>

      {hasBackend && (
        <SuiteCard
          title="Backend (.NET)"
          suite={results.backend!}
          icon="🔷"
        />
      )}

      {hasFrontend && (
        <SuiteCard
          title="Frontend (Vitest)"
          suite={results.frontend!}
          icon="🟢"
        />
      )}

      {!hasBackend && !hasFrontend && (
        <p className="rounded-lg border border-slate-600 bg-slate-800/50 p-6 text-slate-400">
          No test results. Check that tests ran successfully.
        </p>
      )}
    </div>
  )
}
