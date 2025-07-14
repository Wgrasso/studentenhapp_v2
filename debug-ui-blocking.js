// UI Blocking Debug Utility
// Copy and paste this in your browser console to check for UI blocking issues

console.log('🔧 UI Blocking Debug Tool');

// Function to check current app state
function checkUIState() {
  console.log('\n🔍 === UI STATE CHECK ===');
  
  // Check for visible modals
  const modals = document.querySelectorAll('[data-testid*="modal"], [class*="modal"], [class*="Modal"]');
  console.log('📱 Visible modals:', modals.length);
  
  modals.forEach((modal, index) => {
    const style = window.getComputedStyle(modal);
    console.log(`Modal ${index + 1}:`, {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex,
      position: style.position
    });
  });
  
  // Check for overlays
  const overlays = document.querySelectorAll('[class*="overlay"], [class*="Overlay"]');
  console.log('🎭 Overlays found:', overlays.length);
  
  overlays.forEach((overlay, index) => {
    const style = window.getComputedStyle(overlay);
    if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0) {
      console.log(`Active overlay ${index + 1}:`, {
        className: overlay.className,
        display: style.display,
        opacity: style.opacity,
        zIndex: style.zIndex,
        backgroundColor: style.backgroundColor
      });
    }
  });
  
  // Check for loading states
  const loadingElements = document.querySelectorAll('[class*="loading"], [class*="Loading"]');
  console.log('⏳ Loading elements:', loadingElements.length);
  
  // Check for buttons that might be disabled
  const buttons = document.querySelectorAll('button, [role="button"]');
  const disabledButtons = Array.from(buttons).filter(btn => 
    btn.disabled || 
    btn.style.pointerEvents === 'none' ||
    window.getComputedStyle(btn).pointerEvents === 'none'
  );
  console.log('🚫 Disabled/blocked buttons:', disabledButtons.length);
  
  // Check for high z-index elements that might block interaction
  const allElements = document.querySelectorAll('*');
  const highZElements = Array.from(allElements).filter(el => {
    const zIndex = parseInt(window.getComputedStyle(el).zIndex);
    return zIndex > 1000;
  });
  
  console.log('🏔️ High z-index elements (>1000):', highZElements.length);
  highZElements.forEach((el, index) => {
    const style = window.getComputedStyle(el);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      console.log(`High z-index ${index + 1}:`, {
        tagName: el.tagName,
        className: el.className,
        zIndex: style.zIndex,
        position: style.position,
        opacity: style.opacity
      });
    }
  });
}

// Function to force clear all potential blocking elements
function emergencyUIUnblock() {
  console.log('\n🚨 EMERGENCY UI UNBLOCK');
  
  try {
    // Remove high z-index overlays
    const highZElements = document.querySelectorAll('*');
    Array.from(highZElements).forEach(el => {
      const zIndex = parseInt(window.getComputedStyle(el).zIndex);
      if (zIndex > 1000) {
        const style = window.getComputedStyle(el);
        if (style.position === 'absolute' || style.position === 'fixed') {
          console.log('🗑️ Removing blocking element:', el.className);
          el.style.display = 'none';
        }
      }
    });
    
    // Force close any React modals by setting their visibility
    const modalOverlays = document.querySelectorAll('[class*="modalOverlay"], [class*="alertOverlay"]');
    modalOverlays.forEach(overlay => {
      console.log('🗑️ Hiding modal overlay');
      overlay.style.display = 'none';
    });
    
    // Re-enable pointer events on body
    document.body.style.pointerEvents = 'auto';
    
    console.log('✅ Emergency unblock completed');
    
  } catch (error) {
    console.error('❌ Emergency unblock failed:', error);
  }
}

// Function to monitor for UI blocking
function startUIMonitor() {
  console.log('\n👁️ Starting UI blocking monitor...');
  
  let lastInteraction = Date.now();
  
  // Monitor for lack of user interactions
  const events = ['click', 'touch', 'keydown'];
  events.forEach(event => {
    document.addEventListener(event, () => {
      lastInteraction = Date.now();
    });
  });
  
  // Check every 3 seconds for potential blocking
  const monitor = setInterval(() => {
    const timeSinceInteraction = Date.now() - lastInteraction;
    
    if (timeSinceInteraction > 10000) { // No interaction for 10 seconds
      console.warn('⚠️ POTENTIAL UI BLOCKING: No interaction for', timeSinceInteraction + 'ms');
      checkUIState();
    }
  }, 3000);
  
  return () => {
    clearInterval(monitor);
    console.log('🛑 UI monitor stopped');
  };
}

// Make functions globally available
window.checkUIState = checkUIState;
window.emergencyUIUnblock = emergencyUIUnblock;
window.startUIMonitor = startUIMonitor;

console.log('✅ UI Debug Tool loaded!');
console.log('\n🔧 Available commands:');
console.log('• checkUIState() - Check current UI state');
console.log('• emergencyUIUnblock() - Force remove blocking elements');
console.log('• startUIMonitor() - Monitor for UI blocking');
console.log('\n💡 If buttons are unresponsive after joining a group, run:');
console.log('checkUIState() followed by emergencyUIUnblock()'); 