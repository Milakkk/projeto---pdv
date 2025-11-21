import { Component, type ReactNode } from 'react'

type Props = {
  fallback?: ReactNode
  children: ReactNode
}

type State = {
  hasError: boolean
  error?: any
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Log básico para o console do renderer
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="max-w-md text-center">
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Algo deu errado</h1>
              <p className="text-gray-600 mb-4">Detectamos uma falha ao renderizar esta tela. Tente recarregar.</p>
              <button
                className="px-4 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                  try { window.location.reload() } catch {}
                }}
              >
                Recarregar
              </button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
