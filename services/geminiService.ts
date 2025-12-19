
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ReviewQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function generateQuiz(subject: string, chapters?: string): Promise<Question[]> {
  const model = "gemini-3-pro-preview";
  
  const prompt = `Génère un questionnaire de 10 questions à choix multiples (QCM) pour un élève de Terminale en France pour la matière : ${subject}.
  ${chapters ? `Thèmes spécifiques à traiter : ${chapters}.` : "Sujet : Ensemble du programme officiel de Terminale."}

  CONSIGNES DE STYLE ET FORMATAGE :
  1. STYLE BAC : Utilise rigoureusement le ton et la terminologie des épreuves officielles du Baccalauréat français (BO). Les questions doivent être précises et académiques.
  2. PAS DE LATEX : N'utilise JAMAIS de symboles de dollar ($) ou de balises LaTeX. 
  3. NOTATION : Pour les mathématiques et la physique, utilise des caractères Unicode simples (ex: ², ³, √, π, →, Δ, indices) ou écris les formules de manière lisible en texte brut (ex: "x au carré" ou "exp(x)").
  4. QUALITÉ : Les distracteurs (mauvaises réponses) doivent être plausibles et basés sur des erreurs classiques d'élèves.
  5. EXPLICATION : Fournis une explication pédagogique claire pour chaque réponse, comme un corrigé officiel.

  Génère les questions au format JSON selon le schéma défini.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw error;
  }
}

export async function generateReviewQuestions(subject: string, transcript: string): Promise<ReviewQuestion[]> {
  const model = "gemini-3-pro-preview";
  
  const prompt = `Analyse la transcription suivante d'un oral de Baccalauréat (${subject}) et génère 5 questions de révision courtes et précises pour vérifier les connaissances de l'élève sur les points abordés ou les lacunes identifiées.
  
  Transcription :
  ${transcript}
  
  CONSIGNES :
  - Questions directes (pas de QCM).
  - Réponse courte et factuelle attendue.
  - Utilise un ton pédagogique.
  - Ne pas utiliser de LaTeX ou de symboles de dollar ($).`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            },
            required: ["question", "answer"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating review questions:", error);
    return [];
  }
}
