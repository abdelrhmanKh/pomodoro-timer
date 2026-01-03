// Web Worker for reliable background timing
// This runs independently of the main thread and doesn't get throttled

let timerInterval = null;
let startTime = null;
let initialRemaining = null;

self.onmessage = function (e) {
    const { command, remaining } = e.data;

    switch (command) {
        case 'start':
            startTime = Date.now();
            initialRemaining = remaining;

            // Clear any existing interval
            if (timerInterval) {
                clearInterval(timerInterval);
            }

            // Tick every second
            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const currentRemaining = Math.max(0, initialRemaining - elapsed);

                self.postMessage({
                    type: 'tick',
                    remaining: currentRemaining,
                    elapsed: elapsed
                });

                // If timer completed, notify and stop
                if (currentRemaining <= 0) {
                    self.postMessage({ type: 'complete' });
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            }, 1000);
            break;

        case 'stop':
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            startTime = null;
            initialRemaining = null;
            break;

        case 'sync':
            // Update the worker's remaining time (e.g., when mode switches)
            startTime = Date.now();
            initialRemaining = remaining;

            // If interval was stopped (e.g., after completion), restart it
            if (!timerInterval && remaining > 0) {
                timerInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const currentRemaining = Math.max(0, initialRemaining - elapsed);

                    self.postMessage({
                        type: 'tick',
                        remaining: currentRemaining,
                        elapsed: elapsed
                    });

                    // If timer completed, notify and stop
                    if (currentRemaining <= 0) {
                        self.postMessage({ type: 'complete' });
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }
                }, 1000);
            }
            break;

        case 'getStatus':
            if (startTime && initialRemaining !== null) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                self.postMessage({
                    type: 'status',
                    remaining: Math.max(0, initialRemaining - elapsed),
                    isRunning: timerInterval !== null
                });
            } else {
                self.postMessage({
                    type: 'status',
                    remaining: 0,
                    isRunning: false
                });
            }
            break;
    }
};
