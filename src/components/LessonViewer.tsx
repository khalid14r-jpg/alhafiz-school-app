import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import 'react-quill-new/dist/quill.snow.css';
import { useAuth } from '../context/AuthContext';
import { 
  X, ZoomIn, Trophy, ChevronRight, ChevronLeft, 
  ChevronsRight, ChevronsLeft, Image as ImageIcon,
  Video, Play, Save, Settings, Edit3, Trash2, Layout,
  Plus, ArrowUp, ArrowDown, Type, ListChecks, Columns2,
  TextCursorInput, ThumbsUp, CheckCircle2, Globe, Music
} from 'lucide-react';
import type { Lesson, LessonPage } from '../types';
import { getEmbedUrl } from '../utils/image';
import { 
  doc, 
  getDoc,
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface LessonViewerProps {
  lessonId?: string;
  pathId?: string;
  initialLesson?: Lesson | null;
  initialPages?: LessonPage[];
  onClose?: () => void;
}

const LessonViewer = ({ lessonId: propLessonId, pathId: propPathId, initialLesson, initialPages, onClose }: LessonViewerProps = {}) => {
  const { id: routeLessonId, pathId: routePathId } = useParams<{ id: string; pathId: string }>();
  const lessonId = propLessonId || routeLessonId;
  const pathId = propPathId || routePathId;

  const [lesson, setLesson] = useState<Lesson | null>(initialLesson || null);
  const [pages, setPages] = useState<LessonPage[]>(initialPages || []);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (initialLesson && initialPages) {
      setLesson(initialLesson);
      setPages(initialPages);
      setIsLoading(false);
      return;
    }

    let unsubscribeLesson: (() => void) | undefined;
    let unsubscribePages: (() => void) | undefined;

    const loadLessonData = async () => {
      if (!lessonId) {
        setError('معرف الدرس غير موجود.');
        setIsLoading(false);
        return;
      }

      let effectivePathId = pathId;

      // If pathId is missing or "undefined", try to find it
      if (!effectivePathId || effectivePathId === 'undefined') {
        try {
          const { collectionGroup, getDocs, query } = await import('firebase/firestore');
          // For now, let's try to find it by querying all lessons and matching the ID
          const allLessonsSnap = await getDocs(collectionGroup(db, 'lessons'));
          const targetLessonDoc = allLessonsSnap.docs.find(d => d.id === lessonId);
          
          if (targetLessonDoc) {
            effectivePathId = targetLessonDoc.ref.parent.parent?.id;
          } else {
            setError('لم يتم العثور على الدرس.');
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.error("Error finding pathId:", err);
          setError('حدث خطأ أثناء البحث عن المسار.');
          setIsLoading(false);
          return;
        }
      }

      if (!effectivePathId) {
        setError('معرف المسار غير موجود.');
        setIsLoading(false);
        return;
      }

      const lessonRef = doc(db, 'paths', effectivePathId, 'lessons', lessonId);
      const pagesRef = collection(db, 'paths', effectivePathId, 'lessons', lessonId, 'pages');
      const q = query(pagesRef, orderBy('order_index', 'asc'));

      unsubscribeLesson = onSnapshot(lessonRef, (docSnap) => {
        if (docSnap.exists()) {
          setLesson({ id: docSnap.id, ...docSnap.data() } as Lesson);
        }
      });

      unsubscribePages = onSnapshot(q, (snapshot) => {
        const pagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonPage));
        setPages(pagesData);
        setIsLoading(false);
      });
    };

    loadLessonData();

    return () => {
      if (unsubscribeLesson) unsubscribeLesson();
      if (unsubscribePages) unsubscribePages();
    };
  }, [lessonId, pathId, initialLesson, initialPages]);

  useEffect(() => {
    // Automatically register lesson progress
    const registerProgress = async () => {
      if (user && lessonId && pathId && lesson) {
        try {
          const progressRef = doc(db, 'users', user.id, 'progress', lessonId);
          const progressSnap = await getDoc(progressRef);
          
          // Try to get path title and category if not in lesson
          let pathTitle = lesson.path_title || '';
          let category = lesson.category || '';
          if (!pathTitle || !category) {
            const pathSnap = await getDoc(doc(db, 'paths', pathId));
            if (pathSnap.exists()) {
              pathTitle = pathSnap.data().title;
              category = pathSnap.data().category;
            }
          }

          const isValidPathId = pathId && pathId !== 'undefined';

          if (!progressSnap.exists()) {
            await setDoc(progressRef, {
              lesson_id: lessonId,
              path_id: isValidPathId ? pathId : null,
              lesson_title: lesson.title,
              path_title: pathTitle || 'الأعداد والعمليات',
              category: category || 'رياضيات',
              image_url: lesson.image_url || '',
              page_count: pages.length || 0,
              completed: false,
              registered_at: serverTimestamp(),
              last_accessed_at: serverTimestamp()
            });
          } else {
            // Update last accessed
            const updateData: any = {
              last_accessed_at: serverTimestamp(),
              lesson_title: lesson.title,
              path_title: pathTitle || 'الأعداد والعمليات',
              category: category || 'رياضيات',
              image_url: lesson.image_url || '',
              page_count: pages.length || 0,
            };
            
            // Only update path_id if it was missing or invalid in the doc, and we have a valid one now
            if (isValidPathId && (!progressSnap.data().path_id || progressSnap.data().path_id === 'undefined')) {
              updateData.path_id = pathId;
            }

            await setDoc(progressRef, updateData, { merge: true });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.id}/progress/${lessonId}`);
        }
      }
    };

    registerProgress();
  }, [lessonId, pathId, user, lesson, pages.length]);

  const page = pages[currentPage];
  const hasMedia = !!(page?.image_url || page?.video_url || (page?.type === 'iframe' && page?.content && page?.content.startsWith('http')));

  const handleNext = async () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    } else {
      // Save progress
      if (user && lessonId) {
        const totalQuestions = pages.filter(p => p.type === 'question').length;
        const progressRef = doc(db, 'users', user.id, 'progress', lessonId);
        try {
          await setDoc(progressRef, {
            lesson_id: lessonId,
            completed: true,
            correct_answers: correctAnswersCount,
            total_questions: totalQuestions,
            completed_at: serverTimestamp()
          }, { merge: true });
          setIsCompleted(true);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.id}/progress/${lessonId}`);
        }
      } else {
        setIsCompleted(true);
      }
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedOption(null);
      setShowExplanation(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center">جاري التحميل...</div>;
  if (error) return (
    <div className="p-12 text-center">
      <h2 className="text-xl font-bold text-slate-800 mb-4">{error}</h2>
      <button 
        onClick={() => navigate('/')}
        className="text-violet-600 font-bold hover:underline"
      >
        العودة للرئيسية
      </button>
    </div>
  );
  if (pages.length === 0) return (
    <div className="p-12 text-center">
      <h2 className="text-xl font-bold text-slate-800 mb-4">هذا الدرس لا يحتوي على محتوى بعد.</h2>
      <button 
        onClick={() => navigate('/')}
        className="text-violet-600 font-bold hover:underline"
      >
        العودة للرئيسية
      </button>
    </div>
  );

  if (!page) return <div className="p-12 text-center">حدث خطأ في عرض الصفحة.</div>;

  if (isCompleted) {
    const totalQuestions = pages.filter(p => p.type === 'question').length;
    return (
      <div className="fixed inset-0 bg-slate-50 z-[60] flex items-center justify-center p-4 md:mr-24" dir="rtl">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl border border-slate-100 max-w-lg w-full text-center"
        >
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-8">
            <Trophy className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">أحسنت! لقد أكملت الدرس</h2>
          <p className="text-slate-500 mb-8">لقد انتهيت من جميع صفحات الدرس بنجاح.</p>
          
          {totalQuestions > 0 && (
            <div className="bg-slate-50 rounded-2xl p-6 mb-8 grid grid-cols-2 gap-4">
              <div className="text-center">
                <span className="block text-2xl font-bold text-slate-800">{correctAnswersCount}</span>
                <span className="text-xs text-slate-400 font-bold">إجابات صحيحة</span>
              </div>
              <div className="text-center">
                <span className="block text-2xl font-bold text-slate-800">{totalQuestions}</span>
                <span className="text-xs text-slate-400 font-bold">إجمالي الأسئلة</span>
              </div>
            </div>
          )}

          <button 
            onClick={() => onClose ? onClose() : navigate('/')}
            className="w-full bg-violet-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-violet-700 transition-all shadow-lg shadow-violet-100"
          >
            {onClose ? 'إغلاق المعاينة' : 'العودة للرئيسية'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col md:mr-24" dir="ltr">
      {/* Header */}
      <header className="h-16 md:h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0">
        <button 
          onClick={() => onClose ? onClose() : navigate('/')}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        
        <div className="flex flex-col items-center flex-1 px-4">
          <h1 className="text-sm md:text-xl font-bold text-slate-800 truncate max-w-[200px] md:max-w-none">{lesson?.title || 'عنوان الدرس'}</h1>
          <div className="w-full max-w-2xl mt-2 md:mt-4 h-1 md:h-1.5 bg-slate-100 rounded-full overflow-hidden">
             <div 
               className="bg-violet-600 h-full transition-all duration-500" 
               style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
             />
          </div>
        </div>
        
        <div className="w-8 md:w-10" /> {/* Spacer for balance */}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto flex flex-col p-4 md:p-12 pb-32 lg:pb-12">
        <div className={`flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8 lg:gap-16 items-center ${!hasMedia ? 'justify-center' : ''}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`w-full flex flex-col lg:flex-row gap-8 lg:gap-16 items-center ${!hasMedia ? 'justify-center' : ''}`}
            >
              {/* Left Column: Image & Button */}
              {hasMedia && (
                <div className="w-full lg:flex-1 flex flex-col gap-6 md:gap-8">
                  <div 
                    onClick={() => page?.image_url && setFullScreenImage(page.image_url)}
                    className={`bg-white rounded-2xl md:rounded-[32px] shadow-xl md:shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 relative group flex items-center justify-center min-h-[200px] ${page?.image_url ? 'cursor-zoom-in' : ''}`}
                  >
                    {page?.type === 'iframe' && page?.content && page?.content.startsWith('http') ? (
                      <div className="w-full aspect-video bg-white rounded-2xl md:rounded-[32px] overflow-hidden">
                        <iframe 
                          src={getEmbedUrl(page.content)} 
                          className="w-full h-full border-none"
                          title={page.title || "Embedded Content"}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : page?.video_url ? (
                      getEmbedUrl(page.video_url).includes('youtube.com/embed') || getEmbedUrl(page.video_url).includes('player.vimeo.com') ? (
                        <div className="w-full aspect-video bg-white rounded-2xl md:rounded-[32px] overflow-hidden">
                          <iframe 
                            src={getEmbedUrl(page.video_url)} 
                            className="w-full h-full border-none"
                            title={page.title || "Embedded Video"}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <video 
                          src={page.video_url} 
                          className="w-full h-auto max-h-[70vh] bg-black" 
                          controls 
                        />
                      )
                    ) : page?.image_url ? (
                      <>
                        <img src={page.image_url || null} alt="" className="w-full h-auto max-h-[70vh] object-contain bg-slate-50" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="p-4 bg-white/80 backdrop-blur-sm rounded-full shadow-lg">
                            <ZoomIn className="w-6 h-6 text-violet-600" />
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                  
                  <div className="hidden lg:flex justify-center lg:justify-start">
                    <button
                      onClick={handleNext}
                      className="w-full lg:w-auto bg-violet-600/80 backdrop-blur-sm text-white px-12 py-3 rounded-xl font-bold text-lg hover:bg-violet-600 transition-all active:scale-95 shadow-lg shadow-violet-100"
                    >
                      {currentPage === pages.length - 1 ? "إنهاء الدرس" : "متابعة"}
                    </button>
                  </div>
                </div>
              )}

              {/* Right Column: Content */}
              <div className={`w-full ${hasMedia ? 'lg:flex-1' : 'max-w-4xl mx-auto px-4 md:px-8'} space-y-6 md:space-y-10 ${page?.direction === 'ltr' ? 'text-left' : 'text-right'}`} dir={page?.direction || 'rtl'}>
                {page?.type === 'explanation' || page?.type === 'media' || page?.type === 'iframe' ? (
                  <div className={`space-y-6 md:space-y-10 ${(!hasMedia && (!page?.direction || page?.direction === 'rtl')) ? 'text-center' : ''}`}>
                    {page?.title && (
                      <h2 className={`text-3xl md:text-5xl font-bold text-slate-800 leading-[1.2] md:leading-[1.3] ${(!hasMedia && (!page?.direction || page?.direction === 'rtl')) ? 'text-center' : ''}`}>
                        {page.title}
                      </h2>
                    )}
                    {page?.type !== 'iframe' && page?.content && (
                      <div 
                        className={`text-lg md:text-2xl text-slate-600 leading-[1.8] md:leading-[2] font-medium rich-text-content ${(!hasMedia && (!page?.direction || page?.direction === 'rtl')) ? 'text-center' : ''}`}
                        dangerouslySetInnerHTML={{ __html: page.content }}
                      />
                    )}
                    {page?.audio_url && (
                      <div className={`bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4 ${!hasMedia ? 'max-w-md mx-auto' : ''}`}>
                        <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 shrink-0">
                          <Music className="w-5 h-5" />
                        </div>
                        <audio 
                          src={page.audio_url} 
                          className="flex-1 h-10" 
                          controls 
                        />
                      </div>
                    )}
                    
                    {!hasMedia && (
                      <div className="pt-8 hidden lg:block">
                        <button
                          onClick={handleNext}
                          className="bg-violet-600 text-white px-16 py-4 rounded-2xl font-bold text-xl hover:bg-violet-700 transition-all active:scale-95 shadow-xl shadow-violet-100"
                        >
                          {currentPage === pages.length - 1 ? "إنهاء الدرس" : "متابعة"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : page?.type === 'question' ? (
                  <div className={`space-y-4 md:space-y-6 ${(!hasMedia && (!page?.direction || page?.direction === 'rtl')) ? 'max-w-2xl mx-auto' : ''}`}>
                    <h2 className={`text-xl md:text-3xl font-bold text-slate-800 leading-tight whitespace-pre-wrap ${(!hasMedia && (!page?.direction || page?.direction === 'rtl')) ? 'text-center' : ''}`}>
                      {page?.question}
                    </h2>
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                       {['a', 'b', 'c', 'd'].map((opt) => {
                         const optionText = (page as any)?.[`option_${opt}`];
                         if (!optionText) return null;
                         const isCorrect = opt === page?.correct_option;
                         const isSelected = selectedOption === opt;
                         
                         let bgColor = "bg-white border-slate-100 hover:border-violet-200";
                         if (isSelected) {
                           bgColor = isCorrect ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-red-50 border-red-500 text-red-700";
                         } else if (showExplanation && isCorrect) {
                           bgColor = "bg-emerald-50 border-emerald-500 text-emerald-700";
                         }

                         return (
                           <button
                             key={opt}
                             onClick={() => {
                               if (selectedOption) return;
                               setSelectedOption(opt);
                               if (opt === page?.correct_option) {
                                 setCorrectAnswersCount(prev => prev + 1);
                               } else {
                                 setShowExplanation(true);
                               }
                             }}
                             className={`p-4 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all flex items-center gap-3 md:gap-4 shadow-sm ${page?.direction === 'ltr' ? 'text-left' : 'text-right'} ${bgColor}`}
                           >
                             <span className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold uppercase shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-50 text-slate-400'}`}>
                               {opt}
                             </span>
                             <span className="text-sm md:text-lg font-bold">{optionText}</span>
                           </button>
                         );
                       })}
                    </div>
                    
                    {!hasMedia && (
                      <div className="pt-8 hidden lg:block text-center">
                        <button
                          onClick={handleNext}
                          className="bg-violet-600 text-white px-16 py-4 rounded-2xl font-bold text-xl hover:bg-violet-700 transition-all active:scale-95 shadow-xl shadow-violet-100"
                        >
                          {currentPage === pages.length - 1 ? "إنهاء الدرس" : "متابعة"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Sticky Continue Button */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4 z-50">
        <button
          onClick={handleNext}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-violet-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {currentPage === pages.length - 1 ? "إنهاء الدرس" : "متابعة"}
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Footer Navigation */}
      <footer className="h-16 bg-white border-t border-slate-100 flex items-center justify-center px-8 shrink-0 gap-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentPage(pages.length - 1)}
            disabled={currentPage === pages.length - 1}
            className="p-2 text-slate-300 hover:text-violet-600 disabled:opacity-30 transition-colors"
          >
            <ChevronsLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={handleNext}
            disabled={currentPage === pages.length - 1}
            className="p-2 text-slate-300 hover:text-violet-600 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="text-slate-400 font-bold text-lg flex items-center gap-2">
          <span>{pages.length}</span>
          <span>/</span>
          <span>{currentPage + 1}</span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrev}
            disabled={currentPage === 0}
            className="p-2 text-slate-300 hover:text-violet-600 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
            className="p-2 text-slate-300 hover:text-violet-600 disabled:opacity-30 transition-colors"
          >
            <ChevronsRight className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullScreenImage(null)}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
          >
            <button 
              onClick={() => setFullScreenImage(null)}
              className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={fullScreenImage || null} 
              alt="" 
              className="max-w-full max-h-full object-contain shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LessonViewer;
