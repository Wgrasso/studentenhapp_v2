import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Image, ActivityIndicator, Dimensions } from 'react-native';
import { getMealOptions, voteMealOption, getUserVotingProgress } from '../lib/mealRequestService';

const { width: screenWidth } = Dimensions.get('window');

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

export default function VotingScreen({ route, navigation }) {
  const { requestId, groupName, groupId, preloadedMealOptions } = route.params;
  
  // Debug route params
  console.log('🔍 [VOTING] Route params:', { requestId, groupName, groupId, preloadedMealOptions: preloadedMealOptions?.length });
  
  // Simple state management
  const [loading, setLoading] = useState(true);
  const [mealOptions, setMealOptions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voting, setVoting] = useState(false);
  const [votes, setVotes] = useState({});
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    loadMealOptions();
  }, []);

  const handleVote = async (vote) => {
    if (voting || currentIndex >= mealOptions.length) return;
    
    const currentMeal = mealOptions[currentIndex];
    if (!currentMeal) return;
    
    setVoting(true);
    
    try {
      const result = await voteMealOption(requestId, currentMeal.id, vote);
      if (result.success) {
        console.log(`✅ Vote recorded: ${vote} for ${currentMeal.meal_data.name}`);
        setVotes(prev => ({ ...prev, [currentMeal.id]: vote }));
        
        // Move to next card
        setCurrentIndex(prev => prev + 1);
      } else {
        console.log('❌ Vote failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error voting:', error);
    } finally {
      setVoting(false);
    }
  };

  const loadMealOptions = async (retryCount = 0) => {
    console.log(`🍽️ [VOTING] Loading meal options for request: ${requestId} (attempt ${retryCount + 1})`);
    setLoading(true);

    try {
      let mealData = [];
      
      // Check if we have pre-loaded meal options first
      if (preloadedMealOptions && Array.isArray(preloadedMealOptions) && preloadedMealOptions.length > 0) {
        console.log(`✅ Using ${preloadedMealOptions.length} pre-loaded meal options`);
        mealData = preloadedMealOptions;
      } else {
        console.log('🔄 No pre-loaded options, fetching from API...');
        const result = await getMealOptions(requestId);
        
        if (result.success && result.options.length > 0) {
          console.log(`✅ Loaded ${result.options.length} meal options from API`);
          mealData = result.options;
        } else {
          console.log('❌ No meal options found:', result.error);
          
          if (retryCount < 2) {
            console.log('🔄 Retrying meal options load...');
            setTimeout(() => {
              loadMealOptions(retryCount + 1);
            }, 1500);
            return;
          }
          
          navigation.goBack();
          return;
        }
      }
      
      // Set the meal options
      setMealOptions(mealData);
      
      // Check user's voting progress
      if (requestId) {
        const progressResult = await getUserVotingProgress(requestId);
        
        if (progressResult.success) {
          const { progress } = progressResult;
          
          if (progress.votedCount > 0) {
            console.log(`🔄 User has already voted on ${progress.votedCount} meals, resuming from meal ${progress.nextMealIndex + 1}`);
            setIsResuming(true);
            
            if (progress.nextMealIndex >= 0) {
              setCurrentIndex(progress.nextMealIndex);
            } else {
              setCurrentIndex(mealData.length);
            }
          } else {
            console.log('🆕 Fresh voting session, starting from meal 1');
            setIsResuming(false);
            setCurrentIndex(0);
          }
        } else {
          setCurrentIndex(0);
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading meal options:', error);
      
      if (retryCount < 1) {
        console.log('🔄 Retrying due to error...');
        setTimeout(() => {
          loadMealOptions(retryCount + 1);
        }, 1500);
        return;
      }
      
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const getCurrentMeal = () => {
    return mealOptions.length > 0 ? mealOptions[currentIndex] : null;
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

  const getProgress = () => {
    if (currentIndex >= mealOptions.length) {
      return `Complete! ${mealOptions.length} / ${mealOptions.length}`;
    }
    return `${currentIndex + 1} / ${mealOptions.length}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B7355" />
          <Text style={styles.loadingText}>Loading meal options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentMeal = getCurrentMeal();

  // All meals voted on
  if (!currentMeal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.completedContainer}>
          <Text style={styles.completedTitle}>Voting Complete!</Text>
          <Text style={styles.completedText}>
            You've voted on all {mealOptions.length} meals for "{groupName}".
          </Text>
          <Text style={styles.completedSubtext}>
            Check back later to see the results or wait for others to finish voting.
          </Text>
          
          <TouchableOpacity 
            style={styles.backToGroupButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backToGroupButtonText}>← Back to Group</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Drawings */}
      <SafeDrawing 
        source={require('../assets/drawing2.png')}
        style={styles.backgroundDrawingMain}
      />
      <SafeDrawing 
        source={require('../assets/drawing6.jpg')}
        style={styles.backgroundDrawingSecondary}
      />
      <SafeDrawing 
        source={require('../assets/drawing8.png')}
        style={styles.backgroundDrawingAccent}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.groupNameText}>{groupName}</Text>
          <Text style={styles.progressText}>{getProgress()}</Text>
          
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${Math.min(100, Math.max(0, (currentIndex / mealOptions.length) * 100))}%` 
                }
              ]} 
            />
          </View>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>
          {isResuming ? 'Resuming Your Votes' : 'Vote on Group Meals'}
        </Text>
        {isResuming && (
          <Text style={styles.instructionsSubtext}>
            Continuing where you left off
          </Text>
        )}
      </View>

      {/* Card Stack Container */}
      <View style={styles.cardsContainer}>
        <View style={styles.cardStack}>
          {/* Background Card 3 */}
          {mealOptions[currentIndex + 2] && (
            <View style={[styles.mealCard, styles.stackCard3]}>
              <Image 
                source={{ 
                  uri: mealOptions[currentIndex + 2].meal_data.thumbnail_url || 
                       'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
                }} 
                style={styles.mealImage}
                resizeMode="cover"
              />
              <View style={styles.mealInfo}>
                <Text style={styles.mealTitle} numberOfLines={2}>
                  {mealOptions[currentIndex + 2].meal_data.name || 'Delicious Recipe'}
                </Text>
              </View>
            </View>
          )}
          
          {/* Background Card 2 */}
          {mealOptions[currentIndex + 1] && (
            <View style={[styles.mealCard, styles.stackCard2]}>
              <Image 
                source={{ 
                  uri: mealOptions[currentIndex + 1].meal_data.thumbnail_url || 
                       'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
                }} 
                style={styles.mealImage}
                resizeMode="cover"
              />
              <View style={styles.mealInfo}>
                <Text style={styles.mealTitle} numberOfLines={2}>
                  {mealOptions[currentIndex + 1].meal_data.name || 'Delicious Recipe'}
                </Text>
              </View>
            </View>
          )}

          {/* Current Card (Front) */}
          <View style={[styles.mealCard, styles.currentCard]}>
            <Image 
              source={{ 
                uri: currentMeal.meal_data.thumbnail_url || 
                     'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
              }} 
              style={styles.mealImage}
              resizeMode="cover"
            />
            
            <View style={styles.mealInfo}>
              <Text style={styles.mealTitle} numberOfLines={2}>
                {currentMeal.meal_data.name || 'Delicious Recipe'}
              </Text>
              
              <View style={styles.mealMeta}>
                <Text style={styles.mealTime}>
                  {formatTime(currentMeal.meal_data.total_time_minutes)}
                </Text>
                {currentMeal.meal_data.description && (
                  <Text style={styles.mealDescription} numberOfLines={3}>
                    {currentMeal.meal_data.description}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.dislikeButton, voting && styles.buttonDisabled]}
          onPress={() => handleVote('no')}
          disabled={voting}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonLabel}>
            {voting ? ' Voting...' : '✕ Dislike'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.likeButton, voting && styles.buttonDisabled]}
          onPress={() => handleVote('yes')}
          disabled={voting}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonLabel}>
            {voting ? ' Voting...' : '♡ Like'}
          </Text>
        </TouchableOpacity>
      </View>
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
    top: '20%',
    left: '-25%',
    width: 200,
    height: 200,
    opacity: 0.08,
    zIndex: -1,
    transform: [{ rotate: '-15deg' }],
  },
  backgroundDrawingSecondary: {
    position: 'absolute',
    bottom: '15%',
    right: '-20%',
    width: 160,
    height: 160,
    opacity: 0.06,
    zIndex: -1,
    transform: [{ rotate: '25deg' }],
  },
  backgroundDrawingAccent: {
    position: 'absolute',
    top: '60%',
    left: '80%',
    width: 120,
    height: 120,
    opacity: 0.07,
    zIndex: -1,
    transform: [{ rotate: '-35deg' }],
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F0',
    backgroundColor: 'rgba(248, 246, 243, 0.95)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  progressText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 18,
    color: '#6B6B6B',
    marginTop: 2,
  },
  progressBarContainer: {
    width: 120,
    height: 4,
    backgroundColor: 'rgba(139, 115, 85, 0.2)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B7355',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  headerRight: {
    width: 100, // Same width as back button for centering
  },
  instructionsContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  instructionsTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#2D2D2D',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  instructionsSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 18,
    color: '#8B7355',
    textAlign: 'center',
    letterSpacing: 0.1,
    fontStyle: 'italic',
  },
  instructionsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  cardStack: {
    position: 'relative',
    width: screenWidth - 48,
    height: 500,
  },
  mealCard: {
    width: screenWidth - 48,
    height: 500,
    borderRadius: 20,
    backgroundColor: '#F8F6F3',
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.1)',
  },
  mealImage: {
    width: '100%',
    height: 300,
  },
  mealInfo: {
    padding: 24,
    flex: 1,
  },
  mealTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    lineHeight: 28,
    color: '#2D2D2D',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  mealMeta: {
    gap: 12,
  },
  mealTime: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#8B7355',
    letterSpacing: 0.1,
  },
  mealDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 24,
    gap: 32,
  },
  dislikeButton: {
    backgroundColor: '#CC4444',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#CC4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 120,
  },
  likeButton: {
    backgroundColor: '#8B7355',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 120,
  },
  actionButtonLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  completedTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#2D2D2D',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 16,
  },
  completedText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.1,
  },
  completedSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.1,
  },
  backToGroupButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  backToGroupButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
  },
  stackCard3: {
    position: 'absolute',
    top: 12,
    left: 6,
    right: 6,
    height: 500,
    opacity: 0.4,
    transform: [{ scale: 0.9 }],
    zIndex: 1,
  },
  stackCard2: {
    position: 'absolute',
    top: 6,
    left: 3,
    right: 3,
    height: 500,
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
    zIndex: 2,
  },
  currentCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 500,
    zIndex: 10,
  },
}); 