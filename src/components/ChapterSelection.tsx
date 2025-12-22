import React from 'react';
import { Chapter, Subject, ClassLevel, User } from '../types';
import { BookOpen, ChevronRight, Lock, CheckCircle, PlayCircle, Clock } from 'lucide-react';

interface Props {
  chapters: Chapter[];
  subject: Subject;
  classLevel: ClassLevel;
  loading: boolean;
  user: User | null;
  onSelect: (chapter: Chapter) => void;
  onBack: () => void;
}

export const ChapterSelection: React.FC<Props> = ({ 
  chapters, 
  subject, 
  classLevel, 
  loading, 
  user,
  onSelect, 
  onBack 
}) => {
  
  // Get current progress for this subject
  const userProgress = user?.progress?.[subject.id] || { currentChapterIndex: 0, totalMCQsSolved: 0 };
  const isAdmin = user?.role === 'admin';

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto">
       <div className="flex items-center mb-8 sticky top-0 bg-slate-50 py-4 z-10">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors mr-4 font-medium flex items-center gap-1">
           Back
        </button>
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
             <span>Class {classLevel}</span>
             <span>/</span>
             <span className="font-medium text-slate-700">{subject.name}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Syllabus & Chapters</h2>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
             <div key={i} className="h-24 bg-white rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {chapters.map((chapter, index) => {
            // Logic for Lock/Unlock
            const isCompleted = index < userProgress.currentChapterIndex;
            const isCurrent = index === userProgress.currentChapterIndex;
            // @ts-ignore
            const isExplicitlyLocked = chapter.isLocked === true;
            // REMOVED 100 MCQ LOCK LOGIC: Now only locked if explicitly locked by admin
            const isLocked = !isAdmin && isExplicitlyLocked;
            
            return (
              <button
                key={chapter.id}
                onClick={() => onSelect(chapter)}
                disabled={isLocked}
                className={`w-full p-5 rounded-xl border transition-all text-left flex items-center group relative overflow-hidden ${
                    isLocked 
                    ? 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed' 
                    : isCurrent 
                        ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' 
                        : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isLocked ? 'bg-slate-300' : isCurrent ? 'bg-blue-600' : 'bg-green-500'
                }`}></div>

                <div className="mr-5 ml-2 min-w-[3.5rem] flex flex-col items-center">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CH</span>
                   <span className={`text-2xl font-bold ${isCurrent ? 'text-blue-600' : isLocked ? 'text-slate-400' : 'text-green-600'}`}>
                       {(index + 1).toString().padStart(2, '0')}
                   </span>
                </div>
                
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-bold text-lg ${isLocked ? 'text-slate-500' : 'text-slate-800'}`}>
                          {chapter.title}
                      </h3>
                      {isCurrent && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold animate-pulse">ACTIVE</span>}
                  </div>
                  
                  {isLocked ? (
                      <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Lock size={12} />
                          <span>
                              Locked by Admin
                          </span>
                      </div>
                  ) : (
                      <div className="flex items-center gap-3 text-xs">
                          {/* Replaced Target Text with generic 'Open' or progress if needed, 
                              but since requirement is to remove lock, we just show availability. 
                              Or we can show 'Coming Soon' if no content logic is handled here?
                              Actually the user said "Coming Soon" if admin hasn't added content.
                              Since we don't know content state here easily without checking DB for every chapter,
                              we will rely on LessonView handling the Empty Content case.
                          */}
                          <span className="text-slate-500">Tap to Open</span>
                      </div>
                  )}
                </div>

                <div className="ml-2">
                  {isLocked ? (
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">
                          <Lock size={18} />
                      </div>
                  ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${isCurrent ? 'bg-blue-600 text-white' : 'bg-green-100 text-green-600'}`}>
                          <PlayCircle size={20} />
                      </div>
                  )}
                </div>
              </button>
            );
          })}
          
          {chapters.length === 0 && !loading && (
             <div className="text-center py-20 text-slate-400">
                <BookOpen size={48} className="mx-auto mb-4 opacity-50"/>
                <p>No chapters found. Please try refreshing.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};