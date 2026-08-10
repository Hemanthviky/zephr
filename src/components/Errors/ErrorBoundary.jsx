import { Component } from 'react'
import CrashScreen from './CrashScreen'

/**
 * Catches render-time crashes anywhere below it and prints the receipt.
 *
 * Still a class: `getDerivedStateFromError` has no hook equivalent, and React
 * has no plans to add one.
 *
 * "Try again" only clears the error state — it re-renders the same tree, which
 * is the right move for a transient failure (a bad response, a race) and futile
 * for a deterministic one. So retries are counted, and after two the button
 * stops being offered and the honest option, a full reload, takes its place.
 * Offering an infinite retry that visibly does nothing is worse than not
 * offering it.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, retries: 0 }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // No reporting service wired up — but this is where it would go, and until
    // then the console is the only record anyone gets.
    console.error('[Zephr] Uncaught error:', error, info?.componentStack)
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, retries: s.retries + 1 }))
  }

  render() {
    const { error, retries } = this.state

    if (error) {
      return <CrashScreen error={error} onRetry={this.handleRetry} canRetry={retries < 2} />
    }

    return this.props.children
  }
}
