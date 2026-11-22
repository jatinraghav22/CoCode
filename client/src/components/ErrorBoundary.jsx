import React, { Component } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronRight } from "lucide-react";

/**
 * Production-ready React Error Boundary for CoCode.
 * Catches unhandled runtime rendering errors in components/routes and
 * presents a user-friendly recovery interface without crashing the entire app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, log error without personal secrets
    console.error("CoCode ErrorBoundary captured an unhandled error:", error?.message, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoDashboard = () => {
    window.location.href = "/dashboard";
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#080914",
            color: "#f1f2ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "580px",
              width: "100%",
              backgroundColor: "#13152b",
              border: "1px solid rgba(170, 173, 229, 0.2)",
              borderRadius: "16px",
              padding: "36px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(244, 63, 94, 0.15)",
                color: "#f43f5e",
                marginBottom: "20px",
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "12px",
                color: "#ffffff",
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: "0.95rem",
                color: "#a1a6c3",
                lineHeight: 1.5,
                marginBottom: "28px",
              }}
            >
              An unexpected issue occurred in the application view. Your files and project data are
              safely stored on the cloud server.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: "24px",
              }}
            >
              <button
                onClick={this.handleReload}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  backgroundColor: "#7848f7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <RefreshCw size={16} /> Reload Page
              </button>

              <button
                onClick={this.handleGoDashboard}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  backgroundColor: "#1b1d39",
                  color: "#c4b5fd",
                  border: "1px solid rgba(170, 173, 229, 0.2)",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <Home size={16} /> Return to Dashboard
              </button>
            </div>

            <div style={{ textAlign: "left", marginTop: "20px" }}>
              <button
                onClick={this.toggleDetails}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a6c3",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: 0,
                  margin: "0 auto",
                }}
              >
                {this.state.showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Technical Details
              </button>

              {this.state.showDetails && (
                <pre
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    backgroundColor: "#080914",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#f87171",
                    fontSize: "0.78rem",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    maxHeight: "160px",
                  }}
                >
                  {this.state.error?.message || "Unknown error"}
                  {"\n"}
                  {this.state.errorInfo?.componentStack || ""}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
