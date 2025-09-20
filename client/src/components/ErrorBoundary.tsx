import React, { Component } from 'react';
import type { ReactNode } from 'react';
import errorReportingService from '../services/errorReportingService';
import './ErrorBoundary.scss';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Report error to service
    errorReportingService.reportError({
      message: `React Error Boundary: ${error.message}`,
      stackTrace: error.stack,
      severity: 'high',
      errorCode: 'REACT_ERROR_BOUNDARY',
      userInfo: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'ErrorBoundary',
        props: this.props.children ? 'HasChildren' : 'NoChildren'
      }
    });

    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <h2 className="error-boundary__title">Oops! Something went wrong</h2>
            <p className="error-boundary__message">
              We're sorry, but something unexpected happened. The error has been reported and we'll look into it.
            </p>
            
            <div className="error-boundary__actions">
              <button 
                className="error-boundary__retry-btn"
                onClick={this.handleRetry}
              >
                Try Again
              </button>
              <button 
                className="error-boundary__reload-btn"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary__details">
                <summary>Error Details (Development Mode)</summary>
                <pre className="error-boundary__stack">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;