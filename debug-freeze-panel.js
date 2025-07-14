// Debug Freeze Prevention Panel
// Add this temporarily to any screen during development to monitor app health

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const DebugFreezePanel = ({ onEmergencyReset }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [operationCount, setOperationCount] = useState(0);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    // Monitor app health every second
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceUpdate = now - lastUpdate;
      
      if (timeSinceUpdate > 3000) {
        setWarnings(prev => [...prev.slice(-2), `Potential freeze: ${timeSinceUpdate}ms gap`]);
      }
      
      setLastUpdate(now);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  const handleEmergencyReset = () => {
    console.log('🚨 EMERGENCY RESET triggered from debug panel');
    setOperationCount(0);
    setWarnings([]);
    
    if (onEmergencyReset) {
      onEmergencyReset();
    }
    
    // Force state resets
    try {
      // Clear all timeouts/intervals
      for (let i = 1; i < 999999; i++) {
        clearTimeout(i);
        clearInterval(i);
      }
    } catch (error) {
      console.log('Debug reset error:', error);
    }
  };

  const trackOperation = (operationName) => {
    console.log(`📊 TRACKED: ${operationName}`);
    setOperationCount(prev => prev + 1);
  };

  // Make tracking function globally available
  useEffect(() => {
    window.trackOperation = trackOperation;
    return () => {
      delete window.trackOperation;
    };
  }, []);

  return (
    <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>Debug Panel</Text>
      
      <View style={styles.debugRow}>
        <Text style={styles.debugLabel}>Operations:</Text>
        <Text style={styles.debugValue}>{operationCount}</Text>
      </View>
      
      <View style={styles.debugRow}>
        <Text style={styles.debugLabel}>Last Update:</Text>
        <Text style={styles.debugValue}>{new Date(lastUpdate).toLocaleTimeString()}</Text>
      </View>
      
      {warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          <Text style={styles.warningTitle}>Warnings:</Text>
          {warnings.slice(-3).map((warning, index) => (
            <Text key={index} style={styles.warningText}>{warning}</Text>
          ))}
        </View>
      )}
      
      <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyReset}>
        <Text style={styles.emergencyButtonText}>🚨 Emergency Reset</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.testButton} 
        onPress={() => trackOperation('Manual Test')}
      >
        <Text style={styles.testButtonText}>Test Track</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  debugPanel: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 8,
    minWidth: 200,
    zIndex: 9999,
  },
  debugTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 12,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  debugLabel: {
    color: 'white',
    fontSize: 10,
  },
  debugValue: {
    color: '#00ff00',
    fontSize: 10,
    fontWeight: 'bold',
  },
  warningsContainer: {
    marginTop: 8,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 0, 0.2)',
    borderRadius: 4,
  },
  warningTitle: {
    color: 'yellow',
    fontSize: 10,
    fontWeight: 'bold',
  },
  warningText: {
    color: 'yellow',
    fontSize: 9,
  },
  emergencyButton: {
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#4444ff',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 9,
  },
});

export default DebugFreezePanel;

// Usage instructions:
// 1. Import this component in any screen where you want to monitor freezes
// 2. Add <DebugFreezePanel /> to the JSX (temporarily during development)
// 3. The panel will show operation counts and detect potential freezes
// 4. Use the emergency reset button if the app seems frozen
// 5. Remove before production

// Example usage in GroupsScreen.js:
// import DebugFreezePanel from '../debug-freeze-panel';
// 
// // In the JSX return statement, add:
// {__DEV__ && <DebugFreezePanel />} 