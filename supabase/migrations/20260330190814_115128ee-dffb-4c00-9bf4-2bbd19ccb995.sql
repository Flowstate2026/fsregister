
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'teacher');

-- Create schools table
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  UNIQUE (user_id, role, school_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  parent_email TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_of_day TIME NOT NULL,
  teacher_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Create class_enrollments junction table
CREATE TABLE public.class_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id)
);
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id, date)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create student_notes table
CREATE TABLE public.student_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user school_id
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: Schools
CREATE POLICY "Users can view own school"
  ON public.schools FOR SELECT TO authenticated
  USING (id = public.get_user_school_id(auth.uid()));

-- RLS: Profiles
CREATE POLICY "Users can view school profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: User roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS: Students
CREATE POLICY "Users can view school students"
  ON public.students FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Users can insert school students"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Users can update school students"
  ON public.students FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

-- RLS: Classes
CREATE POLICY "Users can view school classes"
  ON public.classes FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Users can insert school classes"
  ON public.classes FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

-- RLS: Enrollments
CREATE POLICY "Users can view enrollments"
  ON public.class_enrollments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
  ));

CREATE POLICY "Users can insert enrollments"
  ON public.class_enrollments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
  ));

-- RLS: Attendance
CREATE POLICY "Users can view attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
  ));

CREATE POLICY "Users can insert attendance"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
  ));

CREATE POLICY "Users can update attendance"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
  ));

-- RLS: Notes
CREATE POLICY "Users can view notes"
  ON public.student_notes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
  ));

CREATE POLICY "Users can insert notes"
  ON public.student_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.school_id = public.get_user_school_id(auth.uid())
    )
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    (NEW.raw_user_meta_data->>'school_id')::UUID
  );
  INSERT INTO public.user_roles (user_id, role, school_id)
  VALUES (
    NEW.id,
    (COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'))::app_role,
    (NEW.raw_user_meta_data->>'school_id')::UUID
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_students_school ON public.students(school_id) WHERE NOT archived;
CREATE INDEX idx_classes_school_day ON public.classes(school_id, day_of_week);
CREATE INDEX idx_attendance_student_date ON public.attendance_records(student_id, date);
CREATE INDEX idx_notes_student_date ON public.student_notes(student_id, created_at);
CREATE INDEX idx_enrollments_class ON public.class_enrollments(class_id);
CREATE INDEX idx_profiles_school ON public.profiles(school_id);
