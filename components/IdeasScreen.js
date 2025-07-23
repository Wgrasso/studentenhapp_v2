import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Image, Linking, ActivityIndicator, Modal, Animated, Dimensions, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { getUserWishlist, addToWishlist as addToWishlistDB, removeFromWishlist as removeFromWishlistDB, clearWishlist as clearWishlistDB } from '../lib/wishlistService';

// Safe image component that handles missing drawings gracefully
const SafeDrawing = ({ source, style, resizeMode = "contain" }) => {
  const [imageError, setImageError] = useState(false);
  
  if (imageError) return null;
  
  return (
    <Image 
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => setImageError(true)}
    />
  );
};

export default function IdeasScreen({ route, navigation, hideBottomNav }) {
  const { isGuest } = route.params || { isGuest: true };
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [allLoadedRecipes, setAllLoadedRecipes] = useState([]); // Store all 100 recipes
  const [displayedCount, setDisplayedCount] = useState(20); // How many we're currently showing
  const [isInitialized, setIsInitialized] = useState(false); // Track if data has been loaded
  const [userPreferences, setUserPreferences] = useState({
    cuisines: [],
    dietaryRestrictions: []
  });
  
  // Tab and wishlist states
  const [activeTab, setActiveTab] = useState('meals'); // 'meals' or 'wishlist'
  const [wishlist, setWishlist] = useState([]); // Array of saved recipes
  
  // Modal states
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));

  const { width, height } = Dimensions.get('window');

  // Reload wishlist when switching to wishlist tab
  useEffect(() => {
    if (activeTab === 'wishlist' && !isGuest) {
      loadWishlistFromDB();
    }
  }, [activeTab, isGuest]);

  useEffect(() => {
    const initializeData = async () => {
      if (!isInitialized) {
        await loadUserPreferences();
        if (!isGuest) {
          await loadWishlistFromDB();
        }
        
        // Try to get preloaded meals first
        const { getPreloadedInspirationMeals } = require('../lib/mealPreloadService');
        const preloadedMeals = getPreloadedInspirationMeals();
        
        if (preloadedMeals && preloadedMeals.length > 0) {
          console.log('✅ Using preloaded meals for inspiration page');
          // Transform and use preloaded meals
          const transformedRecipes = transformMealsToRecipes(preloadedMeals);
          setAllLoadedRecipes(transformedRecipes);
          setRecipes(transformedRecipes.slice(0, 20));
          setDisplayedCount(20);
          setLoading(false);
          setIsInitialized(true);
        } else {
          console.log('⚠️ No preloaded meals available, fetching new meals...');
          await loadFeaturedRecipes();
          setIsInitialized(true);
        }
      } else {
        // Just refresh user preferences if already initialized
        await loadUserPreferences();
      }
    };
    
    initializeData();
  }, [isGuest, isInitialized]);

  const loadUserPreferences = async () => {
    if (isGuest) {
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      // Since we've simplified the profile, no user preferences to load
      const preferences = {
        cuisines: [],
        dietaryRestrictions: []
      };
      
      setUserPreferences(preferences);
    } catch (error) {
      console.error('❌ Error loading user preferences:', error);
    }
  };

  const loadFeaturedRecipes = async (isLoadingMore = false) => {
    if (isLoadingMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      // Using Tasty API from RapidAPI
      let pageOffset;
      if (isLoadingMore) {
        // For loading more, use sequential pagination
        pageOffset = allLoadedRecipes.length;
      } else {
        // For initial load, use random offset to get different recipes each time
        // Generate random offset between 0-2000 to get different starting points
        pageOffset = Math.floor(Math.random() * 2000);
      }
      
      let apiUrl = `https://tasty.p.rapidapi.com/recipes/list?from=${pageOffset}&size=40`; // Increased size for better randomization
      
      // Add user preference filters for authenticated users
      if (!isGuest && userPreferences.cuisines.length > 0) {
        const cuisineMap = {
          'italian': 'italian',
          'mexican': 'mexican',
          'chinese': 'chinese',
          'japanese': 'japanese',
          'indian': 'indian',
          'thai': 'thai',
          'mediterranean': 'mediterranean',
          'american': 'american',
          'french': 'french',
          'greek': 'greek'
        };
        
        const tastyTags = userPreferences.cuisines
          .map(c => cuisineMap[c])
          .filter(Boolean)
          .join(',');
        
        if (tastyTags) {
          apiUrl += `&tags=${tastyTags}`;
        }
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': '0b5f1c0661msh2e3ca9ee26bb396p14c318jsn2df1c34cf519',
          'x-rapidapi-host': 'tasty.p.rapidapi.com'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        // Fallback to basic request if no results
        const fallbackOffset = Math.floor(Math.random() * 1000); // Random fallback too
        const fallbackUrl = `https://tasty.p.rapidapi.com/recipes/list?from=${fallbackOffset}&size=40`;
        
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'x-rapidapi-key': '0b5f1c0661msh2e3ca9ee26bb396p14c318jsn2df1c34cf519',
            'x-rapidapi-host': 'tasty.p.rapidapi.com'
          }
        });
        const fallbackData = await fallbackResponse.json();
        data.results = fallbackData.results || [];
      }

      // Universal recipe normalization - handles both new format and Tasty API format
      const normalizeRecipe = (recipe) => {
        // If recipe already has title, image, readyInMinutes etc., it's already in new format
        if (recipe.title && recipe.image && recipe.hasOwnProperty('readyInMinutes')) {
                  return {
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          readyInMinutes: recipe.readyInMinutes,
          dietary: recipe.dietary || [],
          description: recipe.description || 'A delicious recipe perfect for your next meal',
          sourceUrl: recipe.sourceUrl || `https://tasty.co/recipe/${recipe.id}`,
          tastyId: recipe.tastyId || recipe.id,
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || '',
          pricePerServing: recipe.pricePerServing || null
        };
        }

        // Otherwise, transform from old Tasty API format
        // Quick dietary extraction (only what we display)
        const dietary = [];
        if (recipe.tags) {
          for (const tag of recipe.tags) {
            const tagName = tag.name?.toLowerCase();
            if (tagName?.includes('vegetarian')) dietary.push('vegetarian');
            else if (tagName?.includes('vegan')) dietary.push('vegan');
            else if (tagName?.includes('gluten') && tagName?.includes('free')) dietary.push('gluten-free');
            else if (tagName?.includes('dairy') && tagName?.includes('free')) dietary.push('dairy-free');
            else if (tagName?.includes('keto')) dietary.push('keto');
            // Stop after finding 2 dietary tags for performance
            if (dietary.length >= 2) break;
          }
        }

        // Simple time calculation
        const totalTime = recipe.total_time_minutes || recipe.cook_time_minutes || recipe.prep_time_minutes || 30;

        // Simple image URL
        const thumbnailUrl = recipe.thumbnail_url || 
                           (recipe.renditions?.[0]?.url) ||
                           'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop';

        // Simple source URL
        const sourceUrl = recipe.original_video_url || 
                         recipe.beauty_url || 
                         recipe.video_url ||
                         `https://tasty.co/recipe/${recipe.slug || recipe.id}`;

        return {
          id: recipe.id,
          title: recipe.name || recipe.title || 'Delicious Recipe',
          image: thumbnailUrl,
          readyInMinutes: totalTime,
          dietary: dietary,
          description: recipe.description ? 
            recipe.description.substring(0, 100) + '...' : 
            'A delicious recipe perfect for your next meal',
          sourceUrl: sourceUrl,
          tastyId: recipe.id,
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || '',
          pricePerServing: recipe.pricePerServing || null
        };
      };

      // Transform API data to match our format
      const transformedRecipes = data.results.map(normalizeRecipe);

      // Shuffle the recipes for additional randomization
      const shuffledRecipes = [...transformedRecipes].sort(() => Math.random() - 0.5);

      if (isLoadingMore) {
        // Add new batch to existing loaded recipes (take first 20 from shuffled results)
        const newRecipes = shuffledRecipes.slice(0, 20);
        setAllLoadedRecipes(prev => [...prev, ...newRecipes]);
        setRecipes(prev => [...prev, ...newRecipes]);
      } else {
        // Initial load - store all recipes and show first 20 (from shuffled results)
        const initialRecipes = shuffledRecipes.slice(0, 20);
        setAllLoadedRecipes(shuffledRecipes);
        setRecipes(initialRecipes);
        setDisplayedCount(initialRecipes.length);
      }
    } catch (error) {
      console.error('❌ Error loading recipes from Tasty API:', error);
      
      // Fallback to a few basic recipes if API fails
      const fallbackRecipes = [
        {
          id: 'fallback-1',
          title: "Simple Chicken Dinner",
          image: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop",
          readyInMinutes: 30,
          difficulty: "Easy",
          cuisineType: "american",
          dietary: [],
          description: "A quick and delicious chicken dinner perfect for weeknights"
        },
        {
          id: 'fallback-2',
          title: "Pasta Night",
          image: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2c5?w=400&h=300&fit=crop",
          readyInMinutes: 25,
          difficulty: "Easy",
          cuisineType: "italian",
          dietary: ["vegetarian"],
          description: "Comforting pasta dish that's ready in no time"
        }
      ];
      
      // Shuffle fallback recipes too
      const shuffledFallback = [...fallbackRecipes].sort(() => Math.random() - 0.5);
      
      if (isLoadingMore) {
        setAllLoadedRecipes(prev => [...prev, ...shuffledFallback]);
        setRecipes(prev => [...prev, ...shuffledFallback]);
      } else {
        setAllLoadedRecipes(shuffledFallback);
        setRecipes(shuffledFallback);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const openRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setModalVisible(true);
    
    // Start animation
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeModal = () => {
    Animated.spring(modalAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setModalVisible(false);
      setSelectedRecipe(null);
    });
  };

  const openExternalLink = () => {
    const url = selectedRecipe?.sourceUrl;
    
    if (url) {
      Linking.openURL(url).catch(err => {
        console.error('❌ Failed to open recipe URL:', err);
        
        // If the constructed URL fails, try a generic Tasty search
        const searchQuery = encodeURIComponent(selectedRecipe?.title || '');
        const fallbackUrl = `https://tasty.co/search?q=${searchQuery}`;
        
        Linking.openURL(fallbackUrl).catch(fallbackErr => {
          console.error('❌ Fallback URL also failed:', fallbackErr);
          Alert.alert('Error', `Sorry, we couldn't open the recipe link. You can search for "${selectedRecipe?.title}" on tasty.co manually.`);
        });
      });
    } else {
      // Provide a fallback action - search on Tasty.co
      const searchQuery = encodeURIComponent(selectedRecipe?.title || '');
      const searchUrl = `https://tasty.co/search?q=${searchQuery}`;
      
      Alert.alert(
        'No Direct Link Available',
        `This recipe doesn't have a direct link. Would you like to search for "${selectedRecipe?.title}" on Tasty.co?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Search', 
            onPress: () => {
              Linking.openURL(searchUrl).catch(err => {
                console.error('❌ Search URL failed:', err);
                Alert.alert('Error', `Please visit tasty.co and search for "${selectedRecipe?.title}" manually.`);
              });
            }
          }
        ]
      );
    }
  };



  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  // Wishlist management functions
  const loadWishlistFromDB = async () => {
    try {
      const result = await getUserWishlist();
      if (result.success) {
        // Convert database items to recipe format
        const recipes = result.wishlist.map(item => item.recipe_data);
        setWishlist(recipes);
        console.log('✅ Loaded wishlist from database:', recipes.length, 'items');
      } else {
        console.log('⚠️ Failed to load wishlist:', result.error);
      }
    } catch (error) {
      console.error('❌ Error loading wishlist:', error);
    }
  };

  const addToWishlist = async (recipe) => {
    if (isGuest) {
      Alert.alert('Sign In Required', 'Please sign in to add recipes to your wishlist.');
      return;
    }

    if (!isRecipeInWishlist(recipe.id)) {
      // Optimistic update
      setWishlist(prev => [...prev, recipe]);
      
      const result = await addToWishlistDB(recipe);
      if (!result.success) {
        // Revert on failure
        setWishlist(prev => prev.filter(r => r.id !== recipe.id));
        Alert.alert('Error', result.error || 'Failed to add to wishlist');
      }
    }
  };

  const removeFromWishlist = async (recipeId) => {
    if (isGuest) return;

    // Optimistic update
    setWishlist(prev => prev.filter(recipe => recipe.id !== recipeId));
    
    const result = await removeFromWishlistDB(recipeId);
    if (!result.success) {
      // Revert on failure (would need to re-fetch to get the exact recipe back)
      console.error('Failed to remove from wishlist:', result.error);
      await loadWishlistFromDB(); // Reload to ensure consistency
    }
  };

  const isRecipeInWishlist = (recipeId) => {
    return wishlist.some(recipe => recipe.id === recipeId);
  };

  const toggleWishlist = async (recipe) => {
    if (isRecipeInWishlist(recipe.id)) {
      await removeFromWishlist(recipe.id);
    } else {
      await addToWishlist(recipe);
    }
  };

  const clearUserWishlist = async () => {
    if (isGuest) return;

    const result = await clearWishlistDB();
    if (result.success) {
      setWishlist([]);
    } else {
      Alert.alert('Error', result.error || 'Failed to clear wishlist');
    }
  };

  // Transform meals from API format to recipe format
  const transformMealsToRecipes = (meals) => {
    return meals.map(normalizeRecipe);
  };



  const getCurrentDate = () => {
    const today = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('en-US', options);
  };

  const refreshRecipes = async () => {
    const newDisplayCount = displayedCount + 20;
    
    if (newDisplayCount <= allLoadedRecipes.length) {
      // Show more from existing loaded recipes
      setLoadingMore(true);
      setTimeout(() => {
        setRecipes(allLoadedRecipes.slice(0, newDisplayCount));
        setDisplayedCount(newDisplayCount);
        setLoadingMore(false);
      }, 500); // Small delay for UX
    } else {
      // Need to load more from API
      await loadFeaturedRecipes(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B7355" />
          <Text style={styles.loadingText}>Discovering delicious recipes from Tasty...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Watermark */}
      <SafeDrawing 
        source={require('../assets/drawing4.png')}
        style={styles.backgroundWatermark}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'meals' && styles.activeTab]}
              onPress={() => setActiveTab('meals')}
            >
              <Text style={[styles.tabText, activeTab === 'meals' && styles.activeTabText]}>
                Meals
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'wishlist' && styles.activeTab]}
              onPress={() => setActiveTab('wishlist')}
            >
              <Text style={[styles.tabText, activeTab === 'wishlist' && styles.activeTabText]}>
                Wishlist
              </Text>
            </TouchableOpacity>
          </View>
          
          {activeTab === 'meals' && (
            <Text style={styles.dateText}>{getCurrentDate()}</Text>
          )}
          
          {activeTab === 'wishlist' && (
            <Text style={styles.dateText}>
              {wishlist.length} recipe{wishlist.length !== 1 ? 's' : ''} saved
            </Text>
          )}
        </View>

        {/* Content based on active tab */}
        {activeTab === 'meals' ? (
          <View style={styles.recipesContainer}>
            <Text style={styles.sectionTitle}>Featured Recipes</Text>

            {recipes.map((recipe) => (
              <TouchableOpacity 
                key={recipe.id} 
                style={styles.recipeCard}
                onPress={() => openRecipe(recipe)}
                activeOpacity={0.9}
              >
                <Image 
                  source={{ uri: recipe.image }} 
                  style={styles.recipeImage}
                  resizeMode="cover"
                />
                
                <View style={styles.recipeContent}>
                  <View style={styles.recipeHeader}>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <View style={styles.recipeMetrics}>
                      <TouchableOpacity 
                        style={styles.wishlistButton}
                        onPress={() => toggleWishlist(recipe)}
                      >
                        <Text style={styles.wishlistIcon}>
                          {isRecipeInWishlist(recipe.id) ? '❤️' : '🤍'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{formatTime(recipe.readyInMinutes)}</Text>
                      </View>
                      {recipe.pricePerServing && (
                        <View style={styles.priceContainer}>
                          <Text style={styles.priceText}>€{recipe.pricePerServing.toFixed(2)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <Text style={styles.recipeDescription}>{recipe.description}</Text>
                  
                  {recipe.dietary.length > 0 && (
                    <View style={styles.dietaryTags}>
                      {recipe.dietary.slice(0, 2).map((dietary, index) => (
                        <View key={index} style={styles.dietaryTag}>
                          <Text style={styles.dietaryTagText}>{dietary}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.recipesContainer}>
            <Text style={styles.sectionTitle}>Your Wishlist</Text>
            
            {wishlist.length === 0 ? (
              <View style={styles.emptyWishlist}>
                <Text style={styles.emptyWishlistIcon}>🤍</Text>
                <Text style={styles.emptyWishlistTitle}>No saved recipes yet</Text>
                <Text style={styles.emptyWishlistText}>
                  Switch to the Meals tab and tap the heart icon on recipes you'd like to save
                </Text>
              </View>
            ) : (
              wishlist.map((recipe) => (
                <TouchableOpacity 
                  key={recipe.id} 
                  style={styles.recipeCard}
                  onPress={() => openRecipe(recipe)}
                  activeOpacity={0.9}
                >
                  <Image 
                    source={{ uri: recipe.image }} 
                    style={styles.recipeImage}
                    resizeMode="cover"
                  />
                  
                  <View style={styles.recipeContent}>
                    <View style={styles.recipeHeader}>
                      <Text style={styles.recipeTitle}>{recipe.title}</Text>
                      <View style={styles.recipeMetrics}>
                        <TouchableOpacity 
                          style={styles.wishlistButton}
                          onPress={() => toggleWishlist(recipe)}
                        >
                          <Text style={styles.wishlistIcon}>❤️</Text>
                        </TouchableOpacity>
                        <View style={styles.timeContainer}>
                          <Text style={styles.timeText}>{formatTime(recipe.readyInMinutes)}</Text>
                        </View>
                        {recipe.pricePerServing && (
                          <View style={styles.priceContainer}>
                            <Text style={styles.priceText}>€{recipe.pricePerServing.toFixed(2)}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    <Text style={styles.recipeDescription}>{recipe.description}</Text>
                    
                    {recipe.dietary.length > 0 && (
                      <View style={styles.dietaryTags}>
                        {recipe.dietary.slice(0, 2).map((dietary, index) => (
                          <View key={index} style={styles.dietaryTag}>
                            <Text style={styles.dietaryTagText}>{dietary}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Bottom Action */}
        {activeTab === 'meals' && (
          <View style={styles.bottomAction}>
            <TouchableOpacity 
              style={[styles.moreRecipesButton, loadingMore && styles.buttonDisabled]}
              onPress={refreshRecipes}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color="#FEFEFE" />
              ) : (
                <Text style={styles.moreRecipesButtonText}>
                  {displayedCount >= allLoadedRecipes.length ? 
                    'Discover New Recipes' : 
                    `Show More (${Math.min(20, allLoadedRecipes.length - displayedCount)} more available)`
                  }
                </Text>
              )}
            </TouchableOpacity>
            
            {isGuest && (
              <TouchableOpacity 
                style={styles.signInPrompt}
                onPress={() => navigation.navigate('SignIn')}
              >
                <Text style={styles.signInPromptText}>
                  Sign in for personalized recommendations
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {activeTab === 'wishlist' && wishlist.length > 0 && (
          <View style={styles.bottomAction}>
            <TouchableOpacity 
              style={styles.clearWishlistButton}
              onPress={() => {
                Alert.alert(
                  'Clear Wishlist',
                  'Are you sure you want to remove all recipes from your wishlist?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Clear', 
                      style: 'destructive',
                      onPress: () => clearUserWishlist()
                    }
                  ]
                );
              }}
            >
              <Text style={styles.clearWishlistButtonText}>Clear Wishlist</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Recipe Details Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={closeModal}
          />
          
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnimation,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.backButton} onPress={closeModal}>
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {selectedRecipe ? (
                <>
                  <Image 
                    source={{ uri: selectedRecipe.image }} 
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                  
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>
                    
                    <View style={styles.modalMetrics}>
                      <View style={styles.modalMetricItem}>
                        <Text style={styles.metricLabel}>Cooking Time</Text>
                        <Text style={styles.metricValue}>{formatTime(selectedRecipe.readyInMinutes)}</Text>
                      </View>
                      {selectedRecipe.pricePerServing && (
                        <View style={styles.modalMetricItem}>
                          <Text style={styles.metricLabel}>Price per Serving</Text>
                          <Text style={styles.metricValue}>€{selectedRecipe.pricePerServing.toFixed(2)}</Text>
                        </View>
                      )}
                    </View>

                    {selectedRecipe.dietary && selectedRecipe.dietary.length > 0 && (
                      <View style={styles.modalDietary}>
                        <Text style={styles.dietaryTitle}>Dietary Information</Text>
                        <View style={styles.modalDietaryTags}>
                          {selectedRecipe.dietary.map((dietary, index) => (
                            <View key={index} style={styles.modalDietaryTag}>
                              <Text style={styles.modalDietaryText}>{dietary}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {selectedRecipe.description && (
                      <View style={styles.modalDescription}>
                        <Text style={styles.dietaryTitle}>Description</Text>
                        <Text style={styles.descriptionText}>{selectedRecipe.description}</Text>
                      </View>
                    )}

                    {/* Ingredients Section */}
                    {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
                      <View style={styles.modalSection}>
                        <Text style={styles.dietaryTitle}>Ingredients</Text>
                        {selectedRecipe.ingredients.map((ingredient, index) => (
                          <Text key={index} style={styles.ingredientText}>
                            • {ingredient}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Instructions Section */}
                    {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 && (
                      <View style={styles.modalSection}>
                        <Text style={styles.dietaryTitle}>Instructions</Text>
                        <Text style={styles.instructionsText}>{selectedRecipe.instructions}</Text>
                      </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.modalActions}>
                      <TouchableOpacity 
                        style={styles.modalWishlistButton}
                        onPress={() => toggleWishlist(selectedRecipe)}
                      >
                        <Text style={styles.modalWishlistIcon}>
                          {selectedRecipe && isRecipeInWishlist(selectedRecipe.id) ? '❤️' : '🤍'}
                        </Text>
                        <Text style={styles.modalWishlistText}>
                          {selectedRecipe && isRecipeInWishlist(selectedRecipe.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={styles.viewRecipeButton} onPress={openExternalLink}>
                        <Text style={styles.viewRecipeText}>View Full Recipe & Video</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.modalInfo}>
                  <Text style={styles.modalTitle}>Loading recipe...</Text>
                  <Text style={styles.metricValue}>Recipe data not available</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 90,
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
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: '#2D2D2D',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  personalizedText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8B7355',
    textAlign: 'center',
    letterSpacing: 0.1,
    fontStyle: 'italic',
  },
  recipesContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    marginBottom: 24,
    letterSpacing: 0.1,
  },
  recipeCard: {
    backgroundColor: '#F8F6F3',
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  recipeImage: {
    width: '100%',
    height: 200,
  },
  recipeContent: {
    padding: 20,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recipeTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    letterSpacing: 0.3,
    flex: 1,
    marginRight: 12,
  },
  recipeMetrics: {
    alignItems: 'flex-end',
    gap: 6,
  },
  timeContainer: {
    backgroundColor: '#8B7355',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#FEFEFE',
    letterSpacing: 0.1,
  },
  priceContainer: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#FEFEFE',
    letterSpacing: 0.1,
  },

  recipeDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  dietaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dietaryTag: {
    backgroundColor: '#E8E6E3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dietaryTagText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    lineHeight: 14,
    color: '#6B6B6B',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  bottomAction: {
    alignItems: 'center',
    gap: 16,
  },
  moreRecipesButton: {
    backgroundColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  moreRecipesButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  signInPrompt: {
    padding: 16,
  },
  signInPromptText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#8B7355',
    textAlign: 'center',
    letterSpacing: 0.1,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 45, 45, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 50,
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    height: '88%',
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F0',
    backgroundColor: '#FEFEFE',
  },
  backButton: {
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
  modalContent: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  modalImage: {
    width: '100%',
    height: 240,
  },
  modalInfo: {
    padding: 32,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: '#2D2D2D',
    marginBottom: 26,
    letterSpacing: 0.3,
  },
  modalMetrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
    gap: 28,
  },
  modalMetricItem: {
    flex: 1,
  },
  metricLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8B7355',
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  modalDietary: {
    marginBottom: 26,
  },
  dietaryTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  modalDietaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalDietaryTag: {
    backgroundColor: '#F5F3F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6E3',
  },
  modalDietaryText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#8B7355',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  modalActions: {
    alignItems: 'center',
    marginTop: 12,
  },
  viewRecipeButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 36,
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
  viewRecipeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
  },
  modalDescription: {
    marginBottom: 26,
  },
  descriptionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  modalSection: {
    marginBottom: 26,
  },
  ingredientText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  instructionsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  backgroundWatermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F3F0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#8B7355',
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.2,
  },
  activeTabText: {
    color: '#FEFEFE',
  },
  
  // Wishlist styles
  wishlistButton: {
    padding: 8,
    marginRight: 4,
  },
  wishlistIcon: {
    fontSize: 20,
  },
  emptyWishlist: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyWishlistIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyWishlistTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptyWishlistText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  clearWishlistButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  clearWishlistButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  
  // Modal wishlist styles
  modalWishlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3F0',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E6E3',
  },
  modalWishlistIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  modalWishlistText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 20,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
}); 