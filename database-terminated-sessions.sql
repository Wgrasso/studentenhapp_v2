-- Create terminated_sessions table to store terminated voting session results
CREATE TABLE IF NOT EXISTS public.terminated_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  top_results JSONB NOT NULL,
  member_responses JSONB NOT NULL,
  terminated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique index to ensure one terminated session per group
CREATE UNIQUE INDEX IF NOT EXISTS idx_terminated_sessions_group_id ON public.terminated_sessions(group_id);

-- Enable RLS on terminated_sessions table
ALTER TABLE public.terminated_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for terminated_sessions table
-- Allow users to read terminated sessions for groups they're members of
CREATE POLICY "Users can view terminated sessions for their groups"
  ON public.terminated_sessions
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id 
      FROM public.group_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Allow users to insert terminated sessions for groups they're members of
CREATE POLICY "Users can create terminated sessions for their groups"
  ON public.terminated_sessions
  FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id 
      FROM public.group_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Allow users to update terminated sessions for groups they're members of
CREATE POLICY "Users can update terminated sessions for their groups"
  ON public.terminated_sessions
  FOR UPDATE
  USING (
    group_id IN (
      SELECT group_id 
      FROM public.group_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Allow users to delete terminated sessions for groups they're members of
CREATE POLICY "Users can delete terminated sessions for their groups"
  ON public.terminated_sessions
  FOR DELETE
  USING (
    group_id IN (
      SELECT group_id 
      FROM public.group_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_terminated_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER trigger_terminated_sessions_updated_at
  BEFORE UPDATE ON public.terminated_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_terminated_sessions_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminated_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminated_sessions TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated; 