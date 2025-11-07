import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../services/agent';

export const SimpleIdleWarning: React.FC = () => {
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        const checkIdleTime = () => {
            const timeUntilTimeout = api.idleTimeout.getTimeUntilTimeout();

            // Show warning when less than 30 seconds remain
            if (timeUntilTimeout > 0 && timeUntilTimeout <= 30000) {
                setShowWarning(true);
                setTimeLeft(Math.ceil(timeUntilTimeout / 1000));
            } else {
                setShowWarning(false);
            }
        };

        const interval = setInterval(checkIdleTime, 1000);
        return () => clearInterval(interval);
    }, []);

    const resetTimer = () => {
        api.idleTimeout.resetTimer();
        setShowWarning(false);
    };

    if (!showWarning) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 p-4 rounded-lg shadow-lg max-w-sm z-50">
            <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h4 className="font-medium text-yellow-800">Session About to Expire</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                        Your session will expire in {timeLeft} seconds due to inactivity.
                    </p>
                    <button
                        onClick={resetTimer}
                        className="mt-2 bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors"
                    >
                        Continue Working
                    </button>
                </div>
            </div>
        </div>
    );
};