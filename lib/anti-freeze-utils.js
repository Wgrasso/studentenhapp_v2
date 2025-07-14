// Anti-Freeze Utilities
// Helper functions to prevent the app from freezing

/**
 * Wraps any async operation with a timeout to prevent hanging
 * @param {Promise} operation - The async operation to wrap
 * @param {number} timeoutMs - Timeout in milliseconds (default 10 seconds)
 * @param {string} operationName - Name for logging purposes
 * @returns {Promise} - The operation result or timeout error
 */
export const withTimeout = async (operation, timeoutMs = 10000, operationName = 'Operation') => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operationName} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    console.log(`⏱️ Starting ${operationName} with ${timeoutMs}ms timeout`);
    const result = await Promise.race([operation, timeoutPromise]);
    console.log(`✅ ${operationName} completed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error.message);
    throw error;
  }
};

/**
 * Creates multiple safety timeouts for critical operations
 * @param {Function} onTimeout - Function to call when timeout triggers
 * @param {Array} timeouts - Array of {ms, message} objects
 * @returns {Array} - Array of timeout IDs to clear later
 */
export const createSafetyTimeouts = (onTimeout, timeouts = []) => {
  const defaultTimeouts = [
    { ms: 5000, message: 'Operation taking longer than expected...' },
    { ms: 10000, message: 'Operation timeout - forcing recovery' }
  ];
  
  const timeoutsToUse = timeouts.length > 0 ? timeouts : defaultTimeouts;
  
  return timeoutsToUse.map(({ ms, message }, index) => {
    return setTimeout(() => {
      console.log(`⚠️ SAFETY TIMEOUT ${index + 1}: ${message}`);
      if (index === timeoutsToUse.length - 1) {
        // Last timeout - force recovery
        onTimeout();
      }
    }, ms);
  });
};

/**
 * Clears all safety timeouts
 * @param {Array} timeouts - Array of timeout IDs
 */
export const clearSafetyTimeouts = (timeouts) => {
  timeouts.forEach(timeout => clearTimeout(timeout));
};

/**
 * Forces a state reset with error handling
 * @param {Object} stateSetters - Object with setState functions
 */
export const forceStateReset = (stateSetters) => {
  try {
    Object.entries(stateSetters).forEach(([key, setter]) => {
      try {
        if (typeof setter === 'function') {
          setter(false); // Assuming most are boolean states
        }
      } catch (error) {
        console.log(`⚠️ Error resetting ${key}:`, error);
      }
    });
  } catch (error) {
    console.log('⚠️ Error in force state reset:', error);
  }
};

/**
 * Wraps a UI operation with freeze prevention
 * @param {Function} uiOperation - The UI operation to wrap
 * @param {string} operationName - Name for logging
 * @param {number} timeoutMs - Timeout in milliseconds
 */
export const withUIProtection = async (uiOperation, operationName = 'UI Operation', timeoutMs = 8000) => {
  let timeoutId;
  
  try {
    console.log(`🔒 Starting protected ${operationName}`);
    
    // Set up timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operationName} UI timeout`));
      }, timeoutMs);
    });
    
    // Race the operation against timeout
    await Promise.race([uiOperation(), timeoutPromise]);
    
    console.log(`✅ Protected ${operationName} completed`);
    
  } catch (error) {
    console.error(`❌ Protected ${operationName} failed:`, error);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

/**
 * Monitors app performance and logs potential freeze conditions
 */
export const startFreezeMonitor = () => {
  let lastCheck = Date.now();
  
  const monitor = () => {
    const now = Date.now();
    const timeDiff = now - lastCheck;
    
    if (timeDiff > 2000) { // If more than 2 seconds passed
      console.warn(`🚨 FREEZE DETECTION: ${timeDiff}ms gap detected`);
    }
    
    lastCheck = now;
  };
  
  // Check every 500ms
  const intervalId = setInterval(monitor, 500);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};

/**
 * Emergency app state reset function
 * Call this when the app seems frozen
 */
export const emergencyReset = () => {
  console.log('🚨 EMERGENCY RESET: Attempting to unfreeze app');
  
  try {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear any pending timeouts/intervals
    for (let i = 1; i < 999999; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    console.log('✅ Emergency reset completed');
  } catch (error) {
    console.error('❌ Emergency reset failed:', error);
  }
}; 