# Custom Drawings Integration Plan

## 🎨 Separate Your components.png into 4 individual files:

1. **drawing1.png** - Top-left drawing → Use in SignIn screen background
2. **drawing2.png** - Top-right drawing → Use in SignUp screen background  
3. **drawing3.png** - Bottom-left drawing → Use in Profile screen decorative element
4. **drawing4.png** - Bottom-right drawing → Use in Ideas/Recipe screen background

## 📱 Planned Placements:

### SignIn Screen (drawing1.png)
- Subtle background element, blurred and transparent
- Positioned behind the form content

### SignUp Screen (drawing2.png)  
- Decorative header element, bright and prominent
- Above the form, welcoming new users

### Profile Screen (drawing3.png)
- Floating decorative element when editing profile
- Semi-transparent, positioned in corners

### Ideas/Recipe Screen (drawing4.png)
- Background watermark behind recipe cards
- Very subtle, low opacity

## 🛠️ How to separate the images:

1. Open components.png in any image editor
2. Crop each quadrant and save as:
   - `assets/drawing1.png`
   - `assets/drawing2.png` 
   - `assets/drawing3.png`
   - `assets/drawing4.png`
3. The code will automatically use them once placed! 