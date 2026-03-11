import { useState } from 'react'
import type { TestSuite } from '../types'
import { TestCaseRow } from './TestCaseRow'

interface Props {
  title: string
  suite: TestSuite
  icon: string
}

export function SuiteCard({ title, suite, icon }: Props) {
  const [expanded, setExpanded] = useState(true)
  const passRate = suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(0) : '0'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            <p className="text-sm text-slate-400">
              {suite.passed} passed, {suite.failed} failed
              {suite.duration != null && ` • ${(suite.duration / 1000).toFixed(2)}s`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              suite.failed === 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {passRate}% pass
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700">
          {suite.tests.map((test, i) => (
            <TestCaseRow key={i} test={test} />
          ))}
        </div>
      )}
    </div>
  )
}
