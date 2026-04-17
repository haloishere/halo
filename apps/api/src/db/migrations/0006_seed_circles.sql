INSERT INTO "circles" ("slug", "name", "description", "sort_order")
VALUES
  ('emotional-support', 'Emotional Support', 'Share feelings, vent, and find understanding from fellow caregivers.', 1),
  ('daily-care-tips', 'Daily Care Tips', 'Practical advice for day-to-day caregiving tasks and routines.', 2),
  ('caregiver-stories', 'Caregiver Stories', 'Personal experiences and journeys from the caregiving community.', 3),
  ('medical-questions', 'Medical Questions', 'Discuss symptoms, treatments, and medical concerns with peers.', 4),
  ('activities-engagement', 'Activities & Engagement', 'Ideas for activities, games, and meaningful engagement.', 5),
  ('legal-financial', 'Legal & Financial', 'Navigate legal documents, insurance, and financial planning.', 6),
  ('resources-recommendations', 'Resources & Recommendations', 'Share helpful tools, services, books, and products.', 7),
  ('humor-light-moments', 'Humor & Light Moments', 'Lighten the load with humor and uplifting moments.', 8)
ON CONFLICT ("slug") DO NOTHING;
