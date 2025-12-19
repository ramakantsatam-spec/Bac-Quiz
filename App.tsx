
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SubjectCard } from './components/SubjectCard';
import { HistoryTable } from './components/HistoryTable';
import { VoiceSession } from './components/VoiceSession';
import { SUBJECTS, Question, QuizAttempt } from './types';
import { generateQuiz } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'chapters' | 'quiz' | 'result' | 'voice'>('home');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [chaptersInput, setChaptersInput] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'quiz' | 'voice'>('quiz');

  const selectedSubject = SUBJECTS.find(s => s.id === selectedSubjectId);

  // Load history from local storage
  useEffect(() => {
    const saved = localStorage.getItem('bac_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to local storage
  useEffect(() => {
    localStorage.setItem('bac_history', JSON.stringify(history));
  }, [history]);

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setView('chapters');
  };

  const handleStartSession = async () => {
    if (!selectedSubjectId) return;

    if (mode === 'voice') {
      setView('voice');
    } else {
      setLoading(true);
      setError(null);
      try {
        const subjectName = selectedSubject?.name || selectedSubjectId;
        const data = await generateQuiz(subjectName, chaptersInput);
        setQuestions(data);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setView('quiz');
      } catch (err) {
        setError("Impossible de générer le quiz. Vérifiez votre connexion.");
        setView('home');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleViewAttempt = (attempt: QuizAttempt) => {
    setSelectedSubjectId(attempt.subject);
    setQuestions(attempt.questions);
    setUserAnswers(attempt.answers);
    setView('result');
  };

  const handleSelectAnswer = (answerIndex: number) => {
    const newAnswers = [...userAnswers, answerIndex];
    setUserAnswers(newAnswers);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Calculate final results
      const score = newAnswers.reduce((acc, ans, idx) => {
        return ans === questions[idx].correctAnswer ? acc + 1 : acc;
      }, 0);

      const attempt: QuizAttempt = {
        id: crypto.randomUUID(),
        subject: selectedSubjectId!,
        date: new Date().toISOString(),
        score,
        total: questions.length,
        answers: newAnswers,
        questions: questions
      };

      setHistory(prev => [...prev, attempt]);
      setView('result');
    }
  };

  const reset = () => {
    setView('home');
    setSelectedSubjectId(null);
    setChaptersInput("");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-bold text-slate-800">Génération du quiz par l'IA...</h2>
          <p className="text-slate-500 mt-2">Nous préparons des questions de niveau Terminale basées sur vos thèmes.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      {view === 'home' && (
        <div className="space-y-12">
          <section className="text-center py-10 relative">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Objectif Bac 2025 🎯</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Testez vos connaissances et préparez vos épreuves finales avec des quiz intelligents ou des oraux blancs.
            </p>
          </section>

          <section className="bg-white p-2 rounded-2xl border border-slate-200 flex justify-center w-fit mx-auto mb-8 shadow-sm">
            <button 
              onClick={() => setMode('quiz')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${mode === 'quiz' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Mode QCM
            </button>
            <button 
              onClick={() => setMode('voice')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${mode === 'voice' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Oral Blanc (Voix)
            </button>
          </section>

          <section>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              📚 Choisissez votre matière
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {SUBJECTS.map((subject) => (
                <SubjectCard 
                  key={subject.id} 
                  subject={subject} 
                  onSelect={handleSelectSubject} 
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              📈 Votre Historique
            </h3>
            <HistoryTable attempts={history} onViewAttempt={handleViewAttempt} />
          </section>
        </div>
      )}

      {view === 'chapters' && selectedSubject && (
        <div className="max-w-xl mx-auto py-10 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl">{selectedSubject.icon}</span>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedSubject.name}</h2>
                <p className="text-slate-500">Précisez vos thèmes de révision</p>
              </div>
            </div>

            <div className="space-y-4">
              <label htmlFor="chapters" className="block text-sm font-bold text-slate-700">
                Sur quels chapitres ou thèmes voulez-vous travailler ?
              </label>
              <textarea
                id="chapters"
                rows={4}
                value={chaptersInput}
                onChange={(e) => setChaptersInput(e.target.value)}
                placeholder="Ex: La conscience, La vérité, Les fonctions exponentielles, La Guerre Froide..."
                className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-slate-700"
              />
              <p className="text-xs text-slate-400 italic">
                Laissez vide pour une révision sur l'ensemble du programme.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleStartSession}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                {mode === 'quiz' ? 'Lancer le Quiz' : 'Démarrer l\'Oral'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              <button
                onClick={reset}
                className="w-full py-3 text-slate-500 font-medium hover:text-slate-700 transition-colors"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'quiz' && questions.length > 0 && (
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-indigo-600">Question {currentQuestionIndex + 1} de {questions.length}</span>
              <span className="text-sm text-slate-500">{Math.round(((currentQuestionIndex) / questions.length) * 100)}% complété</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300" 
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-slate-800 mb-8 leading-snug">
              {questions[currentQuestionIndex].question}
            </h3>
            <div className="space-y-4">
              {questions[currentQuestionIndex].options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(idx)}
                  className="w-full p-5 text-left rounded-2xl border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all group flex items-start gap-4"
                >
                  <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-lg font-medium text-slate-700 group-hover:text-indigo-900">
                    {option}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-8 flex justify-center">
            <button 
              onClick={reset}
              className="text-slate-400 hover:text-slate-600 font-medium transition-colors"
            >
              Quitter le quiz
            </button>
          </div>
        </div>
      )}

      {view === 'voice' && selectedSubject && (
        <VoiceSession 
          subject={selectedSubject.name} 
          chapters={chaptersInput}
          onClose={reset} 
        />
      )}

      {view === 'result' && (
        <div className="max-w-3xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-xl text-center">
            <div className="mb-6 inline-flex items-center justify-center w-24 h-24 rounded-full bg-indigo-100 text-indigo-600 text-4xl font-black">
              {userAnswers.reduce((acc, ans, idx) => (ans === questions[idx].correctAnswer ? acc + 1 : acc), 0)}
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Quiz Terminé !</h2>
            <p className="text-slate-500 text-lg mb-8">
              Sujet : <span className="font-bold">{selectedSubject?.name}</span> • Note : <span className="font-bold text-indigo-600">{(userAnswers.reduce((acc, ans, idx) => (ans === questions[idx].correctAnswer ? acc + 1 : acc), 0) / questions.length * 20).toFixed(1)}/20</span>
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={handleStartSession}
                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Nouvelle Tentative
              </button>
              <button 
                onClick={reset}
                className="px-8 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              🔍 Revue des questions
            </h3>
            {questions.map((q, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <h4 className="font-bold text-lg text-slate-800">{idx + 1}. {q.question}</h4>
                  {userAnswers[idx] === q.correctAnswer ? (
                    <span className="shrink-0 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Correct</span>
                  ) : (
                    <span className="shrink-0 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Incorrect</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {q.options.map((opt, oIdx) => (
                    <div 
                      key={oIdx}
                      className={`p-3 rounded-xl border text-sm ${
                        oIdx === q.correctAnswer 
                          ? 'border-green-500 bg-green-50 text-green-800 font-bold' 
                          : oIdx === userAnswers[idx] 
                            ? 'border-red-500 bg-red-50 text-red-800'
                            : 'border-slate-100 bg-slate-50 opacity-60'
                      }`}
                    >
                      {String.fromCharCode(65 + oIdx)}. {opt}
                    </div>
                  ))}
                </div>
                <div className="bg-indigo-50 p-4 rounded-xl text-sm border border-indigo-100">
                  <p className="font-bold text-indigo-800 mb-1">Explication :</p>
                  <p className="text-slate-700">{q.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
