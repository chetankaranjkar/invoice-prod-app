import React, { useState, useEffect } from 'react';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { AlertTriangle } from 'lucide-react';

interface AutoLogoutProps {
  onLogout: () => void;
  showWarning?: boolean;
  warningTime?: number; // seconds before logout to show warning
}

export const AutoLogout: React.FC<AutoLogoutProps> = ({ 
  onLogout, 
  showWarning = true,
  warningTime = 30 // Show warning 30 seconds before logout
}) => {
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [countdown, setCountdown] = useState(warningTime);
  const warningTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const handleTimeout = () => {
    onLogout();
  };

  const { isIdle, resetTimeout } = useIdleTimeout({
    onTimeout: handleTimeout,
    idleTime: 3 // 3 minutes
  });

  // Clear all timeouts
  const clearAllTimeouts = () => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  // Show warning modal before logout
  useEffect(() => {
    if (isIdle && showWarning) {
      setShowWarningModal(true);
      setCountdown(warningTime);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearAllTimeouts();
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto logout after warning time
      warningTimeoutRef.current = setTimeout(() => {
        clearAllTimeouts();
        handleTimeout();
      }, warningTime * 1000);
    } else {
      setShowWarningModal(false);
      clearAllTimeouts();
    }

    return () => {
      clearAllTimeouts();
    };
  }, [isIdle, warningTime, showWarning]);

  const handleContinue = () => {
    resetTimeout();
    setShowWarningModal(false);
    clearAllTimeouts();
  };

  const handleLogoutNow = () => {
    clearAllTimeouts();
    handleTimeout();
  };

  if (!showWarningModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <div className="bg-yellow-100 p-3 rounded-full mr-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Session Timeout Warning
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Your session will expire due to inactivity in {countdown} seconds.
            </p>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-yellow-500 h-2 rounded-full transition-all duration-1000"
            style={{ width: `${(countdown / warningTime) * 100}%` }}
          ></div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleContinue}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Continue Session
          </button>
          <button
            onClick={handleLogoutNow}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
};