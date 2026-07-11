import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error) => React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error);
      }
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center p-8 max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-6">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
