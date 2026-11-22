import { useEffect, useState } from 'react'
export function useRequest(loader, dependencies, enabled = true) {
  const [state, setState] = useState({ loading: enabled, data: null, error: null })
  useEffect(() => {
    let current = true
    if (!enabled) { setState({ loading: false, data: null, error: null }); return }
    setState({ loading: true, data: null, error: null })
    Promise.resolve().then(loader).then(
      data => { if (current) setState({ loading: false, data, error: null }) },
      error => { if (current) setState({ loading: false, data: null, error }) },
    )
    return () => { current = false }
  }, [...dependencies, enabled])
  return state
}
