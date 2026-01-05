import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nuhmftqdvrpxzrixswvj.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51aG1mdHFkdnJweHpyaXhzd3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDI2MzMsImV4cCI6MjA4MzExODYzM30.NiCISDbI28bhTi9m9bphdvkEVI-2HtyOPpLEZlu2IyE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
