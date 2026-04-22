import type { Question } from '../schemas/scenarios.js'
import type { VaultTopic } from './vault-topics.js'

export const QUESTIONNAIRES: Record<VaultTopic, Question[]> = {
  food_and_restaurants: [
    {
      id: 'food_diet',
      prompt: 'Do you follow any diet or have food restrictions?',
      chips: ['Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Kosher', 'None'],
      allowFreeText: true,
    },
    {
      id: 'food_cuisine',
      prompt: 'Which cuisines do you enjoy most?',
      chips: ['Italian', 'Japanese', 'Indian', 'Mexican', 'French', 'Thai', 'Middle Eastern'],
      allowFreeText: true,
    },
    {
      id: 'food_vibe',
      prompt: 'What kind of dining experience do you prefer?',
      chips: ['Casual', 'Fine dining', 'Street food', 'Fast food', 'Home-cooked', 'Takeaway'],
      allowFreeText: false,
    },
    {
      id: 'food_budget',
      prompt: 'What is your typical budget per meal?',
      chips: ['Under €15', '€15–30', '€30–60', 'Over €60'],
      allowFreeText: false,
    },
    {
      id: 'food_dislikes',
      prompt: 'Anything you actively dislike or avoid?',
      chips: ['Spicy food', 'Seafood', 'Red meat', 'Dairy', 'Onions', 'Nothing specific'],
      allowFreeText: true,
    },
  ],

  fashion: [
    {
      id: 'fashion_style',
      prompt: 'How would you describe your style?',
      chips: ['Minimal', 'Casual', 'Classic', 'Streetwear', 'Bold / statement', 'Business'],
      allowFreeText: true,
    },
    {
      id: 'fashion_fit',
      prompt: 'What kind of fit do you prefer?',
      chips: ['Slim', 'Regular', 'Oversized', 'Tailored'],
      allowFreeText: false,
    },
    {
      id: 'fashion_colours',
      prompt: 'Which colour palette do you gravitate towards?',
      chips: ['Neutrals', 'Earth tones', 'Bold colours', 'Monochrome', 'Pastels'],
      allowFreeText: true,
    },
    {
      id: 'fashion_budget',
      prompt: 'What is your typical clothing budget per item?',
      chips: ['Under €50', '€50–150', '€150–300', 'Over €300'],
      allowFreeText: false,
    },
    {
      id: 'fashion_avoid',
      prompt: 'Anything you would never wear?',
      chips: ['Logos / branding', 'Synthetic fabrics', 'Bright patterns', 'Tight fits', 'Nothing specific'],
      allowFreeText: true,
    },
  ],

  lifestyle_and_travel: [
    {
      id: 'lifestyle_activities',
      prompt: 'What activities do you enjoy in your free time?',
      chips: ['Hiking', 'Running', 'Cycling', 'Reading', 'Music', 'Cooking', 'Gaming', 'Art'],
      allowFreeText: true,
    },
    {
      id: 'lifestyle_travel_style',
      prompt: 'How do you prefer to travel?',
      chips: ['Solo', 'With partner', 'With friends', 'With family'],
      allowFreeText: false,
    },
    {
      id: 'lifestyle_accommodation',
      prompt: 'What type of accommodation do you prefer?',
      chips: ['Hotel', 'Boutique hotel', 'Airbnb / apartment', 'Hostel', 'Camping'],
      allowFreeText: false,
    },
    {
      id: 'lifestyle_travel_pace',
      prompt: 'What is your preferred travel pace?',
      chips: ['Slow and exploratory', 'Packed itinerary', 'Mix of both'],
      allowFreeText: false,
    },
    {
      id: 'lifestyle_interests',
      prompt: 'What draws you most when exploring a new place?',
      chips: ['Food & coffee', 'History & culture', 'Nature', 'Nightlife', 'Shopping', 'Architecture'],
      allowFreeText: true,
    },
  ],
}
