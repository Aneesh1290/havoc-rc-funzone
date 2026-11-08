'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Admin Runtime Error Captured]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center p-6 text-white">
      <div className="max-w-lg w-full bg-[#18202f] border border-gray-700/80 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">An unexpected error occurred</h2>
        <div className="text-xs font-mono text-red-300 bg-red-950/40 p-3 rounded-xl border border-red-800/60 text-left overflow-auto max-h-40 break-words">
          {error?.message || "Unknown error occurred"}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <button
            onClick={() => window.location.href = '/admin/bookings'}
            className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold text-xs transition-all"
          >
            Go to Bookings
          </button>
        </div>
      </div>
    </div>
  );
}
