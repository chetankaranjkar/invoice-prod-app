import { useState } from 'react'
import { TestResults } from './components/TestResults'
import { RunTestsButton } from './components/RunTestsButton'
import type { TestSuiteResult } from './types'

function App() {
  const [results, setResults] = useState<TestSuiteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRunTests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/run-tests')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tests')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-700 bg-slate-900/50 px-6 py-4">
        <h1 className="text-2xl font-bold text-emerald-400">
          Invoice App – Test Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Run backend (.NET) and frontend (Vitest) tests and view results
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <RunTestsButton onClick={handleRunTests} loading={loading} />

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/50 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        {results && <TestResults results={results} />}
      </main>
    </div>
  )
}

export default App
