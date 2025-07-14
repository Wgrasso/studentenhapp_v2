-- Additional policies to allow termination cleanup
-- This file should be run after the main terminated sessions table is created

-- Create a more permissive policy for deleting dinner request responses during termination
-- This allows group members to delete ALL responses for their group's dinner requests
CREATE POLICY "Group members can delete responses for group termination" 
ON public.dinner_request_responses
FOR DELETE
USING (
  request_id IN (
    SELECT dr.id 
    FROM public.dinner_requests dr
    WHERE dr.group_id IN (
      SELECT group_id 
      FROM public.group_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);

-- Create a more permissive policy for deleting meal requests during termination
-- This allows group members to delete meal requests for their groups
CREATE POLICY "Group members can delete meal requests for group termination"
ON public.meal_requests
FOR DELETE
USING (
  group_id IN (
    SELECT group_id 
    FROM public.group_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Create a more permissive policy for deleting dinner requests during termination
-- This allows group members to delete dinner requests for their groups
CREATE POLICY "Group members can delete dinner requests for group termination"
ON public.dinner_requests
FOR DELETE
USING (
  group_id IN (
    SELECT group_id 
    FROM public.group_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
); 