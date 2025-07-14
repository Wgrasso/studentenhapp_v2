import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { getTopVotedMeals } from '../lib/mealRequestService';

// Safe image component
const SafeDrawing = ({ source, style, resizeMode = "contain" }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  return (
    <Image
      source={source}
      style={[style, { opacity: imageLoaded ? 1 : 0 }]}
      resizeMode={resizeMode}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageLoaded(false)}
    />
  );
};

export default function ResultsScreen({ route, navigation }) {
  const { requestId, groupName, groupId } = route.params;
  
  // State management
  const [loading, setLoading] = useState(true);
  const [topMeals, setTopMeals] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    console.log('📊 [RESULTS] Loading voting results for request:', requestId);
    setLoading(true);
    setError(null);

    try {
      const result = await getTopVotedMeals(requestId);
      
      if (result.success) {
        console.log(`✅ Loaded results for ${result.topMeals?.length || 0} meals`);
        setTopMeals(result.topMeals || []);
      } else {
        console.log('❌ Failed to load results:', result.error);
        setError(result.error || 'Failed to load voting results');
      }
    } catch (error) {
      console.error('❌ Error loading results:', error);
      setError('An unexpected error occurred while loading results');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    if (!minutes) return 'Unknown';
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  const getMedalEmoji = (index) => {
    switch (index) {
      case 0: return '1';
      case 1: return '2';
      case 2: return '3';
      default: return '#';
    }
  };

  const getPositionText = (index) => {
    switch (index) {
      case 0: return '1st Place';
      case 1: return '2nd Place';
      case 2: return '3rd Place';
      default: return `${index + 1}th Place`;
    }
  };

  const getRankColor = (index) => {
    switch (index) {
      case 0: return '#FFD700'; // Gold
      case 1: return '#C0C0C0'; // Silver
      case 2: return '#CD7F32'; // Bronze
      default: return '#8B7355';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B7355" />
          <Text style={styles.loadingText}>Calculating voting results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to Load Results</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadResults}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back to Group</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Drawings - Elegant Positioning */}
      <SafeDrawing 
        source={require('../assets/drawing3.png')}
        style={styles.backgroundDrawingMain}
      />
      <SafeDrawing 
        source={require('../assets/drawing7.png')}
        style={styles.backgroundDrawingSecondary}
      />
      <SafeDrawing 
        source={require('../assets/drawing5.png')}
        style={styles.backgroundDrawingAccent}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.groupNameText}>{groupName}</Text>
          <Text style={styles.headerSubtext}>Voting Results</Text>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.resultsTitle}>Top Voted Meals</Text>
          <Text style={styles.resultsSubtitle}>
            Here are the group's favorite meal choices
          </Text>
        </View>

        {/* Results Cards */}
        <View style={styles.resultsContainer}>
          {topMeals.length > 0 ? (
            topMeals.map((meal, index) => (
              <View 
                key={meal.meal_option_id} 
                style={[
                  styles.resultCard,
                  index === 0 && styles.firstPlaceCard,
                  index === 1 && styles.secondPlaceCard,
                  index === 2 && styles.thirdPlaceCard,
                ]}
              >
                {/* Rank Badge */}
                <View style={[styles.rankBadge, { backgroundColor: getRankColor(index) }]}>
                  <Text style={styles.rankEmoji}>{getMedalEmoji(index)}</Text>
                  <Text style={styles.rankText}>{getPositionText(index)}</Text>
                </View>

                {/* Meal Image */}
                <Image 
                  source={{ 
                    uri: meal.meal_data.thumbnail_url || 
                         'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
                  }} 
                  style={styles.resultImage}
                  resizeMode="cover"
                />
                
                {/* Meal Info */}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {meal.meal_data.name || 'Delicious Recipe'}
                  </Text>
                  
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultTime}>
                      {formatTime(meal.meal_data.total_time_minutes)}
                    </Text>
                    
                    {meal.meal_data.description && (
                      <Text style={styles.resultDescription} numberOfLines={2}>
                        {meal.meal_data.description}
                      </Text>
                    )}
                  </View>
                  
                  {/* Voting Stats */}
                  <View style={styles.votingStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>👍 Likes</Text>
                      <Text style={styles.statValue}>{meal.yes_votes || 0}</Text>
                      <Text style={styles.statPercentage}>{meal.yes_percentage || 0}%</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>👎 Dislikes</Text>
                      <Text style={styles.statValue}>{meal.no_votes || 0}</Text>
                      <Text style={styles.statPercentage}>{meal.no_percentage || 0}%</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>⏳ Not Voted</Text>
                      <Text style={styles.statValue}>
                        {((meal.not_voted_percentage || 0) / 100 * (meal.yes_votes + meal.no_votes + 1)) || 0}
                      </Text>
                      <Text style={styles.statPercentage}>{meal.not_voted_percentage || 0}%</Text>
                    </View>
                  </View>
                  
                  {/* Progress Bar */}
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          width: `${meal.yes_percentage || 0}%`,
                          backgroundColor: '#8B7355'
                        }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          width: `${meal.no_percentage || 0}%`,
                          backgroundColor: '#CC4444',
                          left: `${meal.yes_percentage || 0}%`
                        }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsTitle}>No Votes Yet</Text>
              <Text style={styles.noResultsText}>
                No votes have been cast for this meal request yet. Encourage group members to start voting!
              </Text>
            </View>
          )}
        </View>

        {/* Summary Section */}
        {topMeals.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Voting Summary</Text>
            <Text style={styles.summaryText}>
              The group has spoken! These are the top {topMeals.length} meal choices based on member votes. 
              The voting session is still active until terminated.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  backgroundDrawingMain: {
    position: 'absolute',
    top: '10%',
    right: '-20%',
    width: 180,
    height: 180,
    opacity: 0.06,
    zIndex: -1,
    transform: [{ rotate: '20deg' }],
  },
  backgroundDrawingSecondary: {
    position: 'absolute',
    bottom: '25%',
    left: '-15%',
    width: 140,
    height: 140,
    opacity: 0.05,
    zIndex: -1,
    transform: [{ rotate: '-30deg' }],
  },
  backgroundDrawingAccent: {
    position: 'absolute',
    top: '50%',
    left: '85%',
    width: 100,
    height: 100,
    opacity: 0.04,
    zIndex: -1,
    transform: [{ rotate: '45deg' }],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#6B6B6B',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.1,
  },
  retryButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E8E6E3',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  backButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F0',
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F5F3F0',
  },
  backArrow: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    color: '#8B7355',
    marginRight: 6,
  },
  backText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
  headerCenter: {
    alignItems: 'center',
  },
  groupNameText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.3,
  },
  headerSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 18,
    color: '#6B6B6B',
    marginTop: 2,
  },
  headerRight: {
    width: 100,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resultsTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#2D2D2D',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  resultsContainer: {
    gap: 24,
    marginBottom: 32,
  },
  resultCard: {
    backgroundColor: '#F8F6F3',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  firstPlaceCard: {
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.3,
  },
  secondPlaceCard: {
    borderWidth: 2,
    borderColor: '#C0C0C0',
    shadowColor: '#C0C0C0',
    shadowOpacity: 0.2,
  },
  thirdPlaceCard: {
    borderWidth: 2,
    borderColor: '#CD7F32',
    shadowColor: '#CD7F32',
    shadowOpacity: 0.2,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rankEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  rankText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
  },
  resultImage: {
    width: '100%',
    height: 200,
  },
  resultInfo: {
    padding: 20,
  },
  resultTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  resultMeta: {
    marginBottom: 16,
    gap: 8,
  },
  resultTime: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#8B7355',
    letterSpacing: 0.1,
  },
  resultDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  votingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B6B6B',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    lineHeight: 22,
    color: '#2D2D2D',
    marginBottom: 2,
  },
  statPercentage: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#8B7355',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E8E6E3',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    position: 'absolute',
    top: 0,
    borderRadius: 3,
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(248, 246, 243, 0.5)',
    borderRadius: 16,
  },
  noResultsTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  noResultsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  summarySection: {
    backgroundColor: 'rgba(139, 115, 85, 0.05)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  summaryTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  summaryText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
}); 