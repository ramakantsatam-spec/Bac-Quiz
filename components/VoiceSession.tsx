
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { encode, decode, decodeAudioData } from '../services/audioUtils';
import { generateReviewQuestions } from '../services/geminiService';
import { ReviewQuestion } from '../types';

interface VoiceSessionProps {
  subject: string;
  chapters?: string;
  onClose: () => void;
}

export const VoiceSession: React.FC<VoiceSessionProps> = ({ subject, chapters, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'generating_review' | 'review'>('connecting');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [visibleAnswers, setVisibleAnswers] = useState<Set<number>>(new Set());
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<any>(null);

  // Timer effect
  useEffect(() => {
    let interval: number | undefined;
    if (status === 'active') {
      interval = window.setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [status]);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const startSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: `Tu es un examinateur du Baccalauréat français expérimenté pour la matière : ${subject}. 
            ${chapters ? `L'entretien doit se concentrer sur les chapitres suivants : ${chapters}.` : "Interroge l'élève sur l'ensemble du programme de Terminale."}
            
            CONSIGNES IMPORTANTES :
            1. Adopte un ton formel, académique et bienveillant, typique d'un oral de Baccalauréat.
            2. N'utilise JAMAIS de syntaxe informatique ou de symboles comme le dollar ($) dans tes réponses ou transcriptions. 
            3. Si tu dois citer des formules, dis-les oralement de manière naturelle (ex: "E égale m c carré" au lieu de notation brute).
            4. Structure l'entretien : salutations, mise en situation, questionnement progressif, et bilan constructif.`,
            outputAudioTranscription: {},
            inputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              setStatus('active');
              const source = audioContextInRef.current!.createMediaStreamSource(stream);
              const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  int16[i] = inputData[i] * 32768;
                }
                const pcmBlob = {
                  data: encode(new Uint8Array(int16.buffer)),
                  mimeType: 'audio/pcm;rate=16000',
                };
                
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(audioContextInRef.current!.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                setTranscription(prev => prev + " " + text);
                setFullTranscript(prev => prev + "\nExaminateur: " + text);
              }

              if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                setFullTranscript(prev => prev + "\nÉlève: " + text);
              }

              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio && audioContextOutRef.current) {
                setIsSpeaking(true);
                const ctx = audioContextOutRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setIsSpeaking(false);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
              }
            },
            onerror: (e) => {
              console.error("Live API error:", e);
              setError("Une erreur est survenue lors de la connexion vocale.");
            },
            onclose: () => {
              console.log("Live API closed");
            }
          }
        });

        sessionPromiseRef.current = sessionPromise;
      } catch (err) {
        console.error("Failed to start voice session:", err);
        setError("Impossible d'accéder au microphone ou de démarrer la session.");
      }
    };

    startSession();

    return () => {
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then((s: any) => s.close());
      }
      audioContextInRef.current?.close();
      audioContextOutRef.current?.close();
    };
  }, [subject, chapters]);

  const handleFinishOral = async () => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then((s: any) => s.close());
    }
    setStatus('generating_review');
    const questions = await generateReviewQuestions(subject, fullTranscript);
    setReviewQuestions(questions);
    setStatus('review');
  };

  const toggleAnswer = (idx: number) => {
    const next = new Set(visibleAnswers);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setVisibleAnswers(next);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 relative max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6 text-center">
          <div className="flex flex-col items-center gap-2 mb-2">
            <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
              Oral Blanc : {subject}
            </span>
            {status === 'active' && (
              <div className="flex items-center gap-2 text-slate-500 font-mono text-sm bg-slate-100 px-3 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                {formatTime(secondsElapsed)}
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {status === 'review' ? 'Questions de Révision Post-Oral' : 'Session de Révision Vocale'}
          </h2>
        </div>

        {status === 'active' || status === 'connecting' ? (
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center w-40 h-40 mb-8">
              <div className={`absolute inset-0 bg-indigo-500 rounded-full opacity-20 animate-ping ${isSpeaking ? 'scale-125' : 'scale-100'}`}></div>
              <div className={`absolute inset-4 bg-indigo-600 rounded-full transition-transform duration-300 flex items-center justify-center shadow-lg shadow-indigo-200 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
                {status === 'connecting' ? (
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                  </svg>
                )}
              </div>
            </div>

            {error ? (
              <p className="text-red-500 font-medium mb-4">{error}</p>
            ) : (
              <div className="space-y-4 w-full">
                <p className="text-slate-500 italic text-center">
                  {status === 'connecting' ? "Connexion à l'examinateur..." : isSpeaking ? "L'examinateur parle..." : "Parlez maintenant, l'IA vous écoute..."}
                </p>
                <div className="bg-slate-50 rounded-2xl p-4 h-48 overflow-y-auto text-left text-sm text-slate-600 border border-slate-100 scroll-smooth shadow-inner">
                  {transcription || "La transcription en direct apparaîtra ici..."}
                </div>
              </div>
            )}

            <button 
              onClick={handleFinishOral}
              className="mt-8 px-10 py-3 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-colors w-full shadow-lg"
            >
              Terminer l'oral & générer le bilan
            </button>
          </div>
        ) : status === 'generating_review' ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-800">Analyse de l'entretien...</h3>
              <p className="text-slate-500">L'IA prépare vos questions de révision personnalisées.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-amber-900 text-sm">
              <p className="font-bold mb-1">💡 Bilan de connaissances</p>
              Basé sur votre échange (Durée: {formatTime(secondsElapsed)}), voici des points clés à vérifier pour consolider vos acquis.
            </div>

            <div className="space-y-4">
              {reviewQuestions.map((rq, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex gap-4 items-start">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div className="space-y-3 flex-1">
                      <p className="font-bold text-slate-800 leading-tight">{rq.question}</p>
                      
                      {visibleAnswers.has(idx) ? (
                        <div className="bg-green-50 text-green-800 p-3 rounded-xl text-sm border border-green-100 animate-in fade-in slide-in-from-top-2">
                          <p className="font-bold mb-1">Réponse attendue :</p>
                          {rq.answer}
                        </div>
                      ) : (
                        <button 
                          onClick={() => toggleAnswer(idx)}
                          className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Révéler la réponse
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {reviewQuestions.length === 0 && (
                <p className="text-center text-slate-500 py-10">L'IA n'a pas pu générer de questions. L'entretien était peut-être trop court.</p>
              )}
            </div>

            <button 
              onClick={onClose}
              className="mt-6 px-10 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors w-full shadow-lg shadow-indigo-100"
            >
              Fermer et retourner à l'accueil
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
