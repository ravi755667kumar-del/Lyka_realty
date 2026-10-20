-- =========================================================================
-- SUPABASE SCHEMA FOR AI STUDY MENTOR: LEVEL-WISE PROGRESS TRACKER
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Students / Users Profile
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  primary_goal TEXT DEFAULT 'AI / Machine Learning Engineer',
  study_streak INTEGER DEFAULT 1,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Roadmaps
CREATE TABLE IF NOT EXISTS roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  overall_progress INTEGER DEFAULT 0 CHECK (overall_progress >= 0 AND overall_progress <= 100),
  current_level_id TEXT,
  current_topic_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Levels
CREATE TABLE IF NOT EXISTS levels (
  id TEXT PRIMARY KEY,
  roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level_order INTEGER NOT NULL,
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  status TEXT DEFAULT 'Locked' CHECK (status IN ('Locked', 'Not Started', 'In Progress', 'Completed')),
  is_locked BOOLEAN DEFAULT true,
  prerequisites TEXT,
  completion_criteria TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Topics
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  short_explanation TEXT,
  learning_objectives JSONB DEFAULT '[]'::jsonb,
  prerequisites TEXT,
  exercise_prompt TEXT,
  requires_exercise BOOLEAN DEFAULT true,
  exercise_submitted BOOLEAN DEFAULT false,
  exercise_submission_text TEXT,
  exercise_status TEXT DEFAULT 'pending' CHECK (exercise_status IN ('pending', 'submitted', 'reviewed')),
  lesson_completed BOOLEAN DEFAULT false,
  assessment_score INTEGER CHECK (assessment_score IS NULL OR (assessment_score >= 0 AND assessment_score <= 100)),
  required_passing_score INTEGER DEFAULT 70,
  diagnostic_passed BOOLEAN DEFAULT false,
  diagnostic_score INTEGER,
  weight NUMERIC(3, 2) DEFAULT 1.0,
  estimated_hours NUMERIC(4, 1) DEFAULT 2.5,
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
  last_studied_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Assessments Logs
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  level_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL,
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. External Analyzed Resources
CREATE TABLE IF NOT EXISTS analyzed_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  matched_level_id TEXT,
  matched_topic_id TEXT,
  relevance_score INTEGER,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyzed_resources ENABLE ROW LEVEL SECURITY;

-- Students can read & modify only their own data
CREATE POLICY "Students can access their own profile"
  ON students FOR ALL
  USING (auth.uid() = id);

CREATE POLICY "Students can access their own roadmaps"
  ON roadmaps FOR ALL
  USING (auth.uid() = student_id);

CREATE POLICY "Students can view roadmap levels"
  ON levels FOR ALL
  USING (EXISTS (
    SELECT 1 FROM roadmaps WHERE roadmaps.id = levels.roadmap_id AND roadmaps.student_id = auth.uid()
  ));

CREATE POLICY "Students can view roadmap topics"
  ON topics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM roadmaps WHERE roadmaps.id = topics.roadmap_id AND roadmaps.student_id = auth.uid()
  ));

CREATE POLICY "Students can access their assessment history"
  ON assessments FOR ALL
  USING (auth.uid() = student_id);

CREATE POLICY "Students can access their analyzed resources"
  ON analyzed_resources FOR ALL
  USING (auth.uid() = student_id);
