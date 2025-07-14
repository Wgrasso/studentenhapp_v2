import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
// You can find these in your Supabase dashboard at https://supabase.com/dashboard
const supabaseUrl = 'https://rqfgphfseinepfgiwnvh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZmdwaGZzZWluZXBmZ2l3bnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NjAzMTIsImV4cCI6MjA2NDUzNjMxMn0.QCt8I1xyRTN4v1bayn75Q0OfK5sNfNi-tAfqhvviZfI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 