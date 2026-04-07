-- ============================================================================
-- SEED DATA: Built-in Message Templates
-- Run after 001_schema.sql and 002_rls_policies.sql
-- ============================================================================

insert into public.message_templates (name, subject, body, ai_prompt_hint, trigger_event, is_system) values

('Welcome',
 'Welcome to Sygnalist, {clientName}',
 E'Hey {clientName},\n\nWelcome to Sygnalist. Here''s how this works:\n\n1. I''ve set up your profile based on what we discussed\n2. Your inbox will fill with jobs matched to your skills and preferences\n3. When you see something worth pursuing, add it to your tracker\n4. Move jobs through your pipeline as you apply and interview\n\nYour assigned lanes: {assignedLanes}\n\nI''ll be watching your pipeline and jumping in when I see signal.\n\nLet''s get to work.\n\nJosh',
 'Write a brief, warm but direct welcome message. Mention 1-2 of the client''s top skills and what kind of roles they''ll see. No corporate language.',
 null,
 true),

('Interview Prep',
 'Interview prep — {companyName} / {jobTitle}',
 E'Hey {clientName},\n\nYou moved {jobTitle} at {companyName} to interview. That''s a real sygnal.\n\nHere''s what they''ll probably poke at:\n{whyFit}\n\nNext step — let''s cook.\n\nReply with times that work this week and we''ll run a mock. We''ll run it like the real thing — no softballs.\n\nThat wasn''t luck friend, you did this. Major win.\n\nJosh',
 'Generate 2-3 leverage bullets from the client''s whyFit/goodFit, 2 risk areas, and 3 mock interview questions. Use coaching tone — direct, tactical, no HR sludge.',
 'interview_reached',
 true),

('Weekly Digest',
 'Your week in signal — {clientName}',
 E'Hey {clientName},\n\nHere''s your week:\n\n• Pipeline: {pipelineCount} total ({appliedCount} applied, {interviewCount} interviewing)\n• Days since last scan: {daysSinceLastFetch}\n\nKeep the momentum. Even one good application per week compounds.\n\nJosh',
 'Summarize the client''s weekly activity. If they''ve been inactive, add a direct but encouraging nudge. If they''re active, acknowledge the effort.',
 'weekly_digest',
 true),

('Inactive Check-in',
 'Checking in — {clientName}',
 E'Hey {clientName},\n\nNoticed it''s been {daysSinceLastFetch} days since your last scan. No judgement — life happens.\n\nBut the market doesn''t pause. Even 10 minutes scanning your inbox keeps you in the game.\n\nIf something changed or you need to adjust your search criteria, let me know. I can retune your lanes.\n\nJosh',
 'Write a check-in for an inactive client. Be direct but not guilt-trippy. Mention their specific lanes or skills to show you''re paying attention.',
 null,
 true),

('Offer Celebration',
 'You did it — {companyName}',
 E'Hey {clientName},\n\n{companyName} made an offer. Let that sink in.\n\nThis wasn''t luck. You put in the work, you showed up prepared, and you earned this.\n\nBefore you accept — let''s talk through:\n1. Is the comp where it needs to be?\n2. Any red flags from the interview process?\n3. Do you want to negotiate?\n\nReply when you''re ready to talk next steps.\n\nProud of you.\n\nJosh',
 'Write a celebratory message acknowledging the offer. Include 2-3 practical next-step questions about compensation, negotiation, and fit. Coaching tone — celebratory but grounded.',
 'offer_reached',
 true),

('Send Link',
 'Your Sygnalist link, {clientName}',
 E'Hey {clientName},\n\nHere''s your link to open Sygnalist. Tap the button below to jump in.\n\n{portalLink}\n\nAdd it to your home screen for one-tap access — it works just like a native app.\n\nJosh',
 'Keep it very short. Just direct the client to their portal link.',
 null,
 true),

('Password Reset',
 'Reset your password, {clientName}',
 E'Hey {clientName},\n\nTap the button below to reset your Sygnalist password.\n\n{resetLink}\n\nThis link expires in 1 hour. If you didn''t request this, just ignore it.\n\nJosh',
 'Keep it very short. Direct the client to reset their password.',
 null,
 true);
