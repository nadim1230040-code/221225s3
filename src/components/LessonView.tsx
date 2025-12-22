
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { LessonContent, Subject, ClassLevel, Chapter, MCQItem, ContentType } from '../types';
import { ArrowLeft, Clock, AlertTriangle, ExternalLink, CheckCircle, XCircle, Trophy, BookOpen, Play } from 'lucide-react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Props {
  content: LessonContent | null;
  subject: Subject;
  classLevel: ClassLevel;
  chapter: Chapter;
  loading: boolean;
  onBack: () => void;
  onMCQComplete?: (count: number) => void; 
}

export const LessonView: React.FC<Props> = ({ 
  content, 
  subject, 
  classLevel, 
  chapter,
  loading, 
  onBack,
  onMCQComplete
}) => {
  const [mcqState, setMcqState] = useState<Record<number, number | null>>({});
  const [showResults, setShowResults] = useState(false);
  
  if (loading) {
      return (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <h3 className="text-xl font-bold text-slate-800 animate-pulse">Loading Content...</h3>
              <p className="text-slate-500 text-sm">Please wait while we fetch the data.</p>
          </div>
      );
  }

  // Updated condition: Check if content string is empty (meaning no link/text provided by admin)
  const isEmptyContent = !content || 
                         content.isComingSoon || 
                         (typeof content.content === 'string' && content.content.trim() === '') ||
                         (Array.isArray(content.mcqData) && content.mcqData.length === 0 && content.content === '');

  if (isEmptyContent) {
      return (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl m-4 border-2 border-dashed border-slate-200 animate-in zoom-in duration-300">
              <div className="bg-orange-100 p-6 rounded-full mb-6 shadow-sm">
                  <Clock size={48} className="text-orange-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Coming Soon</h2>
              <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium leading-relaxed">
                  Admin hasn't added this content yet.<br/>Please check back later!
              </p>
              <button onClick={onBack} className="bg-white border border-slate-300 text-slate-700 font-bold py-3 px-8 rounded-xl shadow-sm hover:bg-slate-50 transition-all">
                  Go Back
              </button>
          </div>
      );
  }

  // --- MCQ RENDERER ---
  if ((content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_SIMPLE') && content.mcqData) {
      const score = Object.keys(mcqState).reduce((acc, key) => {
          const qIdx = parseInt(key);
          return acc + (mcqState[qIdx] === content.mcqData![qIdx].correctAnswer ? 1 : 0);
      }, 0);

      const handleFinish = () => {
          setShowResults(true);
          if (onMCQComplete) onMCQComplete(score);
      };

      return (
          <div className="flex flex-col h-full bg-slate-50 animate-in fade-in">
               <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                   <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold text-sm bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                       <ArrowLeft size={16} /> Exit
                   </button>
                   <div className="text-right">
                       <h3 className="font-bold text-slate-800 text-sm">MCQ Test</h3>
                       {showResults ? (
                           <span className="text-xs font-bold text-green-600">Final Score: {score}/{content.mcqData.length}</span>
                       ) : (
                           <span className="text-xs text-slate-400">{Object.keys(mcqState).length}/{content.mcqData.length} Answered</span>
                       )}
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full pb-20">
                   {content.mcqData.map((q, idx) => {
                       const userAnswer = mcqState[idx];
                       const isAnswered = userAnswer !== undefined && userAnswer !== null;
                       const isCorrect = userAnswer === q.correctAnswer;
                       
                       return (
                           <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                               <h4 className="font-bold text-slate-800 mb-4 flex gap-3 leading-relaxed">
                                   <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5">{idx + 1}</span>
                                   {q.question}
                               </h4>
                               <div className="space-y-2">
                                   {q.options.map((opt, oIdx) => {
                                       let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium relative overflow-hidden ";
                                       
                                       // IMMEDIATE FEEDBACK LOGIC
                                       // If answered, show Red/Green immediately for this question
                                       if (isAnswered) {
                                           if (oIdx === q.correctAnswer) {
                                               // Always show correct answer as Green
                                               btnClass += "bg-green-100 border-green-300 text-green-800";
                                           } else if (userAnswer === oIdx) {
                                               // Selected Wrong Option -> Red
                                               btnClass += "bg-red-100 border-red-300 text-red-800";
                                           } else {
                                               // Other Options -> Dimmed
                                               btnClass += "bg-slate-50 border-slate-100 opacity-60";
                                           }
                                       } else {
                                           // Not Answered Yet -> Standard State
                                           btnClass += "bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-200";
                                       }

                                       return (
                                           <button 
                                               key={oIdx}
                                               disabled={isAnswered || showResults} // Lock after answering
                                               onClick={() => setMcqState(prev => ({ ...prev, [idx]: oIdx }))}
                                               className={btnClass}
                                           >
                                               <span className="relative z-10 flex justify-between items-center">
                                                   {opt}
                                                   {isAnswered && oIdx === q.correctAnswer && <CheckCircle size={16} className="text-green-600" />}
                                                   {isAnswered && userAnswer === oIdx && userAnswer !== q.correctAnswer && <XCircle size={16} className="text-red-500" />}
                                               </span>
                                           </button>
                                       );
                                   })}
                               </div>
                               
                               {/* Show Explanation Immediately if Answered */}
                               {(isAnswered || showResults) && (
                                   <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                       <div className={`flex items-center gap-2 text-sm font-bold mb-1 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                           {isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                           {isCorrect ? 'Correct Answer' : 'Incorrect'}
                                       </div>
                                       {q.explanation && q.explanation !== "Answer Key Provided" && (
                                            <p className="text-slate-600 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                                                <span className="font-bold text-slate-800 block text-xs uppercase mb-1">Explanation:</span>
                                                {q.explanation}
                                            </p>
                                       )}
                                   </div>
                               )}
                           </div>
                       );
                   })}
               </div>

               {!showResults && (
                   <div className="p-4 bg-white border-t border-slate-200 sticky bottom-0 z-10 flex justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                       <button 
                           onClick={handleFinish}
                           disabled={Object.keys(mcqState).length === 0}
                           className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-10 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
                       >
                           <Trophy size={18} /> Submit Final Score
                       </button>
                   </div>
               )}
          </div>
      );
  }

  // --- VIDEO RENDERER ---
  if (content.type === 'PDF_VIEWER' && (content.content.includes('youtube.com') || content.content.includes('youtu.be') || content.content.includes('drive.google.com/file') || content.content.includes('.mp4'))) {
      let embedUrl = content.content;
      
      // YouTube URL conversion
      if (content.content.includes('youtube.com/watch')) {
          const videoId = new URL(content.content).searchParams.get('v');
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (content.content.includes('youtu.be/')) {
          const videoId = content.content.split('youtu.be/')[1];
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (content.content.includes('drive.google.com/file')) {
          const fileId = content.content.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
      
      return (
          <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-900">
              <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700 shadow-sm">
                   <button onClick={onBack} className="flex items-center gap-2 text-slate-300 font-bold text-sm hover:text-white">
                       <ArrowLeft size={18} /> Back
                   </button>
                   <h3 className="font-bold text-white text-sm truncate max-w-[200px]">{chapter.title}</h3>
                   <div className="w-10"></div>
              </div>
              
              <div className="flex-1 w-full bg-black relative">
                  <iframe 
                       src={embedUrl}
                       className="w-full h-full border-0" 
                       allow="autoplay; fullscreen; picture-in-picture"
                       allowFullScreen
                       title={chapter.title}
                   />
              </div>
          </div>
      );
  }
  
  // --- PDF / EXTERNAL LINK RENDERER ---
  if (content.type === 'PDF_VIEWER' || content.type === 'PDF_FREE' || content.type === 'PDF_PREMIUM') {
      const isPdf = content.content.toLowerCase().endsWith('.pdf') || content.content.includes('drive.google.com') || content.content.includes('docs.google.com');
      
      return (
          <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-100">
              <div className="flex items-center justify-between p-3 bg-white border-b border-slate-200 shadow-sm">
                   <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold text-sm hover:text-slate-900">
                       <ArrowLeft size={18} /> Back
                   </button>
                   <h3 className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{chapter.title}</h3>
                   <div className="w-10"></div> {/* Spacer for alignment */}
              </div>
              
              <div className="flex-1 w-full bg-white relative overflow-hidden">
                  {isPdf ? (
                     <div className="relative w-full h-full">
                        <iframe 
                             src={content.content.replace('/view', '/preview').replace('/edit', '/preview')} 
                             className="w-full h-full border-0" 
                             allowFullScreen
                             title="PDF Viewer"
                         />
                         {/* TRANSPARENT BLOCKER for Top-Right 'Pop-out' Button */}
                         <div className="absolute top-0 right-0 w-20 h-20 z-10 bg-transparent"></div>
                     </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                          <ExternalLink size={48} className="text-slate-400 mb-4" />
                          <h3 className="text-xl font-bold text-slate-700 mb-2">External Content</h3>
                          <p className="text-slate-500 mb-6 max-w-md">
                              This content is hosted externally and cannot be embedded.
                          </p>
                          {/* Removed 'Open Content' button to prevent link sharing */}
                          <p className="text-xs text-slate-400 font-medium">Please contact admin if this content is not loading.</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- NOTES (MARKDOWN) RENDERER ---
  return (
    <div className="bg-white min-h-screen pb-20 animate-in fade-in">
       {/* Notes Header */}
       <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm">
           <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors">
               <ArrowLeft size={20} />
           </button>
           <div className="text-center">
               <h3 className="font-bold text-slate-800 text-sm leading-tight">{chapter.title}</h3>
               <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{content.subtitle}</p>
           </div>
           <div className="w-8"></div> {/* Spacer to balance Back button */}
       </div>

       {/* Notes Body */}
       <div className="max-w-3xl mx-auto p-6 md:p-10">
           <div className="prose prose-slate prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-900 prose-a:text-blue-600 max-w-none">
               <ReactMarkdown 
                   remarkPlugins={[remarkMath]} 
                   rehypePlugins={[rehypeKatex]}
                   components={{
                       h1: ({node, ...props}) => <h1 className="text-2xl font-black mb-4 pb-2 border-b border-slate-100" {...props} />,
                       h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-8 mb-4 text-blue-800 flex items-center gap-2" {...props} />,
                       ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 my-4" {...props} />,
                       li: ({node, ...props}) => <li className="pl-1" {...props} />,
                       blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-6 bg-blue-50 rounded-r-lg italic text-blue-800" {...props} />,
                       code: ({node, ...props}) => <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono font-bold" {...props} />,
                   }}
               >
                   {content.content}
               </ReactMarkdown>
           </div>
           
           <div className="mt-12 pt-8 border-t border-slate-100 text-center">
               <p className="text-xs text-slate-400 font-medium mb-4">End of Chapter</p>
               <button onClick={onBack} className="bg-slate-900 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                   Complete & Close
               </button>
           </div>
       </div>
    </div>
  );
};
