import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the diagnostic in the console rather than shipping it to a server.
    console.error('Frame by Frame crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center">
        <p className="micro text-paper/50">Projection interrupted</p>
        <h1 className="mt-4 font-display text-4xl text-paper sm:text-5xl">
          Something broke in the projector.
        </h1>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-paper-muted">
          Your archive is still in this browser's local storage. Reload the page to re-enter the
          museum; if the error repeats, reset the demo data from the footer.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-primary mt-7"
        >
          Reload
        </button>
        <p className="mt-6 max-w-lg font-mono text-[10px] leading-relaxed text-paper-muted/70">
          {this.state.error.message}
        </p>
      </div>
    )
  }
}
