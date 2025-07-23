import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function RequestSelectionForm({ 
  selectedGroup, 
  selectedDate, 
  selectedTime, 
  selectedRecipe,
  onGroupPress,
  onDatePress,
  onTimePress,
  onRecipeChange,
  formatTime 
}) {
  return (
    <View style={styles.container}>
      {/* Title Section */}
      <View style={styles.requestSection}>
        <Text style={styles.requestTitle}>Request a Dinner</Text>
        <Text style={styles.requestSubtitle}>Choose your group, date, and time</Text>
      </View>

      {/* Selection Buttons */}
      <View style={styles.selectionContainer}>
        {/* Group Selection */}
        <TouchableOpacity 
          style={[styles.selectionButton, selectedGroup && styles.selectionButtonSelected]}
          onPress={onGroupPress}
        >
          <Text style={styles.selectionLabel}>Group</Text>
          <Text style={[styles.selectionValue, !selectedGroup && styles.selectionValueEmpty]}>
            {selectedGroup ? (selectedGroup.group_name || selectedGroup.name) : 'Select a group'}
          </Text>
        </TouchableOpacity>

        {/* Date Selection */}
        <TouchableOpacity 
          style={[styles.selectionButton, selectedDate && styles.selectionButtonSelected]}
          onPress={onDatePress}
        >
          <Text style={styles.selectionLabel}>Date</Text>
          <Text style={[styles.selectionValue, !selectedDate && styles.selectionValueEmpty]}>
            {selectedDate ? selectedDate.label : 'Select a date'}
          </Text>
        </TouchableOpacity>

        {/* Time Selection */}
        <TouchableOpacity 
          style={[styles.selectionButton, selectedTime.hour !== null && styles.selectionButtonSelected]}
          onPress={onTimePress}
        >
          <Text style={styles.selectionLabel}>Time</Text>
          <Text style={[styles.selectionValue, selectedTime.hour === null && styles.selectionValueEmpty]}>
            {selectedTime.hour !== null ? formatTime(selectedTime.hour, selectedTime.minutes) : 'Select a time'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recipe Type Selection */}
      <View style={styles.recipeSection}>
        <Text style={styles.recipeTitle}>Recipe Type</Text>
        <View style={styles.recipeOptions}>
          <TouchableOpacity 
            style={[
              styles.recipeOption,
              selectedRecipe === 'random' && styles.recipeOptionSelected
            ]}
            onPress={() => onRecipeChange('random')}
          >
            <Text style={[
              styles.recipeOptionText,
              selectedRecipe === 'random' && styles.recipeOptionTextSelected
            ]}>Random</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.recipeOption,
              selectedRecipe === 'wishlist' && styles.recipeOptionSelected
            ]}
            onPress={() => onRecipeChange('wishlist')}
          >
            <Text style={[
              styles.recipeOptionText,
              selectedRecipe === 'wishlist' && styles.recipeOptionTextSelected
            ]}>Wishlist</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.recipeOption,
              selectedRecipe === 'swipe' && styles.recipeOptionSelected
            ]}
            onPress={() => onRecipeChange('swipe')}
          >
            <Text style={[
              styles.recipeOptionText,
              selectedRecipe === 'swipe' && styles.recipeOptionTextSelected
            ]}>Swipe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  requestSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  requestTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  requestSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  selectionContainer: {
    marginBottom: 32,
  },
  selectionButton: {
    backgroundColor: '#F8F6F3',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectionButtonSelected: {
    borderColor: '#8B7355',
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
  },
  selectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    marginBottom: 4,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  selectionValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  selectionValueEmpty: {
    color: '#A0A0A0',
    fontStyle: 'italic',
  },
  
  // Recipe Section Styles
  recipeSection: {
    marginBottom: 32,
  },
  recipeTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  recipeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  recipeOption: {
    flex: 1,
    backgroundColor: '#F8F6F3',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  recipeOptionSelected: {
    borderColor: '#8B7355',
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
  },
  recipeOptionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  recipeOptionTextSelected: {
    color: '#8B7355',
    fontFamily: 'Inter_600SemiBold',
  },
}); 