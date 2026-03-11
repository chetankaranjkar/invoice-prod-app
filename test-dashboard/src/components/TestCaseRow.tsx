import { useState } from 'react'
import type { TestCase } from '../types'

interface Props {
  test: TestCase
}

export function TestCaseRow({ test }: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = test.error || (test.steps && test.steps.length > 0)

  return (
    <div className="border-b border-slate-800 last:border-b-0">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`flex w-full items-center gap-4 px-6 py-3 text-left ${
          hasDetails ? 'hover:bg-slate-800/30 cursor-pointer' : 'cursor-default'
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${
            test.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {test.passed ? '✓' : '✗'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm text-slate-200">
            {test.name}
          </p>
          {test.duration != null && (
            <p className="text-xs text-slate-500">
              {(test.duration / 1000).toFixed(3)}s
            </p>
          )}
        </div>
        {hasDetails && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {expanded && hasDetails && (
        <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-4 pl-14">
          {test.steps && test.steps.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Steps
              </p>
              <ol className="list-inside list-decimal space-y-1 text-sm text-slate-300">
                {test.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          {test.error && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Error
              </p>
              <pre className="overflow-x-auto rounded bg-red-950/30 p-3 text-sm text-red-300">
                {test.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
