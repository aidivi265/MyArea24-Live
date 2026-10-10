import React from 'react';

interface ErrorStateProps {
  errorMessage: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ errorMessage, onRetry }) => {
  return (
    <div className="error-state" role="alert">
      <div className="error-icon">⚠️</div>
      <h3 className="error-heading">Unable to Load Intelligence Feed</h3>
      <p className="error-message">{errorMessage}</p>
      <div className="error-hint">
        <strong>Troubleshooting steps:</strong>
        <ul>
          <li>Ensure the MyArea24 FastAPI backend is running (<code>python -m backend.app.main</code> or <code>uvicorn backend.app.main:app --reload</code> on port 8000).</li>
          <li>Verify CORS settings and network connectivity.</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="error-retry-btn"
      >
        Retry Connection
      </button>
    </div>
  );
};
