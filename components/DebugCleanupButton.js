import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { quickFix, getConflictDiagnostics } from '../lib/emergencyCleanup';

export default function DebugCleanupButton({ style }) {
  const [isRunning, setIsRunning] = useState(false);

  const handleQuickFix = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    
    try {
      console.log('🔧 [DEBUG] Running emergency cleanup...');
      
      // First get diagnostics
      const diagnostics = await getConflictDiagnostics();
      
      if (!diagnostics.success) {
        Alert.alert('Error', `Failed to get diagnostics: ${diagnostics.error}`);
        return;
      }
      
      console.log('🔧 [DEBUG] Diagnostics:', diagnostics);
      
      if (diagnostics.groupsNeedingCleanup.length === 0) {
        Alert.alert(
          'All Clean! ✅', 
          `No conflicts found in your ${diagnostics.summary.totalGroups} groups. Everything looks good!`
        );
        return;
      }
      
      // Run the quick fix
      const result = await quickFix();
      
      console.log('🔧 [DEBUG] Quick fix result:', result);
      
      if (result.success) {
        Alert.alert(
          'Fixed! ✅',
          `${result.message}\n\nYou can now create dinner requests normally.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Partial Fix ⚠️',
          `${result.message}\n\nSome issues may remain. Error: ${result.error}`,
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('🔧 [DEBUG] Emergency cleanup failed:', error);
      Alert.alert(
        'Error ❌',
        `Emergency cleanup failed: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.debugButton, style, isRunning && styles.debugButtonRunning]}
      onPress={handleQuickFix}
      disabled={isRunning}
    >
      <Text style={styles.debugButtonText}>
        {isRunning ? '🔧 Fixing...' : '🔧 Fix Database Issues'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  debugButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  debugButtonRunning: {
    backgroundColor: '#888888',
  },
  debugButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
}); 