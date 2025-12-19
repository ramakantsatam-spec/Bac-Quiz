
export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of options
  explanation: string;
}

export interface ReviewQuestion {
  question: string;
  answer: string;
}

export interface QuizAttempt {
  id: string;
  subject: string;
  date: string;
  score: number;
  total: number;
  answers: number[]; // User's choices
  questions: Question[];
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const SUBJECTS: Subject[] = [
  { id: 'philosophie', name: 'Philosophie', icon: '🧠', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'mathematiques', name: 'Mathématiques', icon: '📐', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'physique-chimie', name: 'Physique-Chimie', icon: '⚗️', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'histoire-geographie', name: 'Histoire-Géo', icon: '🌍', color: 'bg-amber-100 text-amber-700 border-amber-200' }
];
