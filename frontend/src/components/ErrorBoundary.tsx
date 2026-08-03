import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import ErrorFallback from "../pages/ErrorFallback";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRefresh = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRefresh={this.handleRefresh} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
