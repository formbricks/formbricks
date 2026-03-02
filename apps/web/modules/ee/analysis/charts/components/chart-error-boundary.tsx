"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ChartErrorBoundaryProps {
  fallbackMessage: string;
  children: ReactNode;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ChartRenderer error:", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          {this.props.fallbackMessage}
        </div>
      );
    }

    return this.props.children;
  }
}
