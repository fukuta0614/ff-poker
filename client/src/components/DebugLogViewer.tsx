/**
 * デバッグログビューアー
 * サーバーのデバッグログを表示・クリアするコンポーネント
 */

import React, { useState } from 'react';

interface DebugLogViewerProps {
  onClose: () => void;
}

export const DebugLogViewer: React.FC<DebugLogViewerProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const fetchLogs = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/debug/logs`);

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs || 'No logs available');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLogs('');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all debug logs?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/debug/logs`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear logs');
      }

      setLogs('');
      alert('Debug logs cleared successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '900px',
          width: '90%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>Debug Logs</h2>
          <button
            onClick={onClose}
            style={{
              padding: '5px 15px',
              fontSize: '18px',
              cursor: 'pointer',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ color: 'red', marginBottom: '10px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            {loading ? 'Loading...' : '🔄 Refresh Logs'}
          </button>
          <button
            onClick={clearLogs}
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            {loading ? 'Clearing...' : '🗑️ Clear Logs'}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '15px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {logs || 'Click "Refresh Logs" to load debug logs...'}
        </div>
      </div>
    </div>
  );
};
