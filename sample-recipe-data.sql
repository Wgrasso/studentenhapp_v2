-- Sample recipe data for testing the recipes table (PUBLIC RECIPES)
-- Run this in your Supabase SQL editor to add sample recipes

-- Sample Recipe 1: Zalm met geroosterde groenten (your example)
INSERT INTO public.recipes (recipe_id, recipe_data) VALUES (
  '3207',
  '{
    "id": 3207,
    "image": "https://img.spoonacular.com/recipes/659135-636x393.jpg",
    "title": "Zalm met geroosterde groenten",
    "dietary": [],
    "tastyId": 3207,
    "sourceUrl": "https://www.foodista.com/recipe/7TTSVX56/salmon-with-roasted-vegetables",
    "description": "Een voedzame ovenschotel met zalmfilet, aardappel en kleurrijke groenten. Gekruid met citroen en verse kruiden. Klaar in slechts 45 minuten!",
    "readyInMinutes": 45,
    "ingredients": [
      "1 aardappel",
      "1 pastinaak", 
      "1 wortel",
      "1 ui",
      "150 g cherrytomaten",
      "2 zalmfilets",
      "1 el olijfolie",
      "1 tl citroensap",
      "snufje zout, peper en paprikapoeder",
      "2 tl tijm en rozemarijn (vers, fijngehakt)"
    ],
    "instructions": "1. Kruid de zalmfilets met zout, peper en een snufje paprikapoeder en zet opzij.\\n2. Verwarm de oven voor op 200 °C. Snijd de aardappel, pastinaak en wortel in grove stukken en leg ze in een ovenschaal.\\n3. Besprenkel met olijfolie, kruid met zout en peper, en rooster 15 minuten.\\n4. Voeg de ui toe en rooster nog eens 10-15 minuten.\\n5. Leg vervolgens de zalmfilets en cherrytomaten tussen de groenten.\\n6. Besprenkel met citroensap, strooi de rozemarijn en tijm erover en kruid nog wat bij.\\n7. Rooster nog eens 10-15 minuten tot de zalm gaar is.\\n8. Serveer met een frisse groene salade.",
    "pricePerServing": 4.2
  }'::jsonb
);

-- Sample Recipe 2: Simple Pasta
INSERT INTO public.recipes (recipe_id, recipe_data) VALUES (
  '1001',
  '{
    "id": 1001,
    "image": "https://images.unsplash.com/photo-1621996346565-e3dbc353d2c5?w=400&h=300&fit=crop",
    "title": "Simple Creamy Pasta",
    "dietary": ["vegetarian"],
    "tastyId": 1001,
    "sourceUrl": "#recipe-1001",
    "description": "A quick and delicious creamy pasta that is ready in just 20 minutes. Perfect for weeknight dinners!",
    "readyInMinutes": 20,
    "ingredients": [
      "400g pasta",
      "200ml heavy cream",
      "100g parmesan cheese",
      "2 cloves garlic",
      "2 tbsp olive oil",
      "Salt and pepper to taste",
      "Fresh parsley for garnish"
    ],
    "instructions": "1. Cook pasta according to package instructions.\\n2. Heat olive oil in a large pan and sauté minced garlic.\\n3. Add cream and bring to a gentle simmer.\\n4. Add cooked pasta and toss with cream.\\n5. Add parmesan cheese and season with salt and pepper.\\n6. Garnish with fresh parsley and serve immediately.",
    "pricePerServing": 2.8
  }'::jsonb
);

-- Sample Recipe 3: Vegetarian Buddha Bowl
INSERT INTO public.recipes (recipe_id, recipe_data) VALUES (
  '1002',
  '{
    "id": 1002,
    "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
    "title": "Rainbow Buddha Bowl",
    "dietary": ["vegetarian", "vegan", "gluten-free"],
    "tastyId": 1002,
    "sourceUrl": "#recipe-1002",
    "description": "A colorful and nutritious bowl packed with fresh vegetables, quinoa, and a delicious tahini dressing.",
    "readyInMinutes": 35,
    "ingredients": [
      "1 cup quinoa",
      "1 sweet potato, cubed",
      "1 cup broccoli florets",
      "1 cup chickpeas",
      "1 avocado, sliced",
      "2 tbsp tahini",
      "1 lemon, juiced",
      "2 tbsp olive oil",
      "Mixed greens"
    ],
    "instructions": "1. Cook quinoa according to package instructions.\\n2. Roast sweet potato and broccoli with olive oil at 400°F for 25 minutes.\\n3. Warm chickpeas in a pan with spices.\\n4. Make tahini dressing by mixing tahini, lemon juice, and water.\\n5. Assemble bowls with quinoa, roasted vegetables, chickpeas, and avocado.\\n6. Drizzle with tahini dressing and serve.",
    "pricePerServing": 3.5
  }'::jsonb
);

-- To check your recipes after inserting:
-- SELECT recipe_data->>'title' as title, recipe_data->>'description' as description FROM public.recipes; 