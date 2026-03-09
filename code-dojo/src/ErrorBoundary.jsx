import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen-center">
          <section className="panel loading-panel">
            <span className="eyebrow">Code Dojo</span>
            <h1>Something went wrong</h1>
            <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
              style={{ marginTop: 16 }}
            >
              Reload App
            </button>
          </section>
        </div>
      )
    }
    return this.props.children
  }
}
