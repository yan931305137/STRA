import { useSignal } from '@stra/react'
import { tree } from './tree'
import { inc, dec } from './actions'

export function App() {
  const count = useSignal(tree.count)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#0a0a0f',
      color: '#e8e8ed',
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#6366f1' }}>
        STRA App
      </h1>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <button
          onClick={dec}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            border: '1px solid #1e1e2e',
            background: '#111118',
            color: '#e8e8ed',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
        >
          −
        </button>
        <span style={{
          fontSize: '2rem',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 64,
          textAlign: 'center',
          fontFeatureSettings: '"tnum"',
        }}>
          {count}
        </span>
        <button
          onClick={inc}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            border: '1px solid #1e1e2e',
            background: '#111118',
            color: '#e8e8ed',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
      <p style={{
        marginTop: '2rem',
        fontSize: '0.75rem',
        color: '#71717a',
      }}>
        Tree = SSOT · Action = sole write entry · Signal = sole response
      </p>
    </div>
  )
}
