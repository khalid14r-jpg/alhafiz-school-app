export interface Path {
  id: string;
  title: string;
  description: string;
  icon: string;
  category?: string;
  image_url?: string;
  lesson_count?: number;
  completed_count?: number;
  order_index?: number;
}

export interface Lesson {
  id: string;
  path_id: string;
  title: string;
  path_title?: string;
  category?: string;
  image_url?: string;
  source?: string;
  duration?: string;
  page_count?: number;
  order_index?: number;
}

export interface Question {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
}

export interface LessonPage {
  id: string;
  lesson_id: string;
  type: 'explanation' | 'question' | 'media' | 'matching' | 'blanks' | 'iframe';
  title?: string;
  content?: string;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  question?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
  explanation?: string;
  questions?: Question[];
  order_index: number;
  direction?: 'rtl' | 'ltr';
}

export interface UserProgress {
  lesson_id: string;
  lesson_title: string;
  path_title?: string;
  category?: string;
  completed: boolean;
  correct_answers: number;
  total_questions: number;
  page_count?: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'general' | 'personal' | 'category';
  target_user_id?: string;
  target_category?: string;
  path_id?: string;
  lesson_id?: string;
  sender_id: string;
  sender_name?: string;
  created_at: any;
  read_by?: string[]; // For general/category
  read?: boolean; // For personal
}
