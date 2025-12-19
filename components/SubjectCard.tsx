
import React from 'react';
import { Subject } from '../types';

interface SubjectCardProps {
  subject: Subject;
  onSelect: (id: string) => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(subject.id)}
      className={`p-6 rounded-2xl border transition-all duration-200 text-left hover:scale-[1.02] hover:shadow-lg active:scale-95 flex flex-col items-start gap-4 ${subject.color}`}
    >
      <span className="text-4xl">{subject.icon}</span>
      <div>
        <h3 className="text-lg font-bold">{subject.name}</h3>
        <p className="text-sm opacity-80 mt-1">Prêt pour l'examen ?</p>
      </div>
    </button>
  );
};
