import { useState, useEffect, useCallback, useRef } from 'react';

interface UseIdleTimeoutProps {
    onTimeout: () => void;
    idleTime: number; // in minutes
}

export const useIdleTimeout = ({ onTimeout, idleTime }: UseIdleTimeoutProps) => {
    const [isIdle, setIsIdle] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const resetTimeout = useCallback(() => {
        if (isIdle) {
            setIsIdle(false);
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setIsIdle(true);
            onTimeout();
        }, idleTime * 60 * 1000);
    }, [onTimeout, idleTime, isIdle]);

    useEffect(() => {
        // Add event listeners for user activity
        events.forEach(event => {
            document.addEventListener(event, resetTimeout);
        });

        // Set initial timeout
        resetTimeout();

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            events.forEach(event => {
                document.removeEventListener(event, resetTimeout);
            });
        };
    }, [resetTimeout]);

    return { isIdle, resetTimeout };
};