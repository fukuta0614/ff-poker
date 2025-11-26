/**
 * 再接続中モーダルコンポーネント
 *
 * Socket切断時に表示され、再接続処理の進行中であることをユーザーに通知する。
 * UI要件:
 * - シンプルなモーダルダイアログ
 * - "再接続中..." テキスト表示
 * - ローディングスピナー
 * - キャンセルボタンなし（自動再接続）
 */

import React from 'react';

interface ReconnectionModalProps {
  isOpen: boolean;
}

export const ReconnectionModal: React.FC<ReconnectionModalProps> = ({ isOpen }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconnection-title"
    >
      <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full mx-4">
        <div className="flex flex-col items-center space-y-4">
          {/* ローディングスピナー */}
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
            role="status"
            aria-label="読み込み中"
          />

          {/* 再接続中メッセージ */}
          <h2 id="reconnection-title" className="text-xl font-semibold text-gray-800">
            再接続中...
          </h2>

          <p className="text-sm text-gray-600 text-center">
            サーバーへの接続を試みています。
            <br />
            しばらくお待ちください。
          </p>
        </div>
      </div>
    </div>
  );
};
