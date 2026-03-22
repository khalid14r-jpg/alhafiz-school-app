import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { compressImage, getEmbedUrl } from '../utils/image';
import { 
  X, Settings, Edit3, Play, Save, ZoomIn, Trash2, 
  Image as ImageIcon, Video, CheckCircle2, Layout, Plus, Globe,
  ChevronUp, ChevronDown, ListChecks, Type, TextCursorInput, Columns2,
  Music
} from 'lucide-react';
import type { Lesson, LessonPage } from '../types';
import LessonViewer from './LessonViewer';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot,
  writeBatch,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface LessonEditorProps {
  lessonId: string;
  pathId: string;
  onClose: () => void;
}

const getWordCount = (html: string) => {
  if (!html) return 0;
  // إزالة وسوم HTML واستبدالها بمسافات
  const text = html.replace(/<[^>]*>/g, ' ');
  // استبدال المسافات غير القابلة للكسر (التي يضيفها المحرر أحياناً) بمسافات عادية
  const normalizedText = text.replace(/&nbsp;/g, ' ');
  // تنظيف النص من المسافات الزائدة في البداية والنهاية
  const cleanText = normalizedText.trim();
  if (!cleanText) return 0;
  // التقسيم بناءً على المسافات (واحدة أو أكثر) وحساب العناصر غير الفارغة
  return cleanText.split(/\s+/).filter(word => word.trim().length > 0).length;
};

const LessonEditor = ({ lessonId, pathId, onClose }: LessonEditorProps) => {
  const [pages, setPages] = useState<LessonPage[]>([]);
  const [lessonMetadata, setLessonMetadata] = useState<Lesson | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lessonImageInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    const lessonRef = doc(db, 'paths', pathId, 'lessons', lessonId);
    const unsubscribeLesson = onSnapshot(lessonRef, (docSnap) => {
      if (docSnap.exists()) {
        setLessonMetadata({ id: docSnap.id, ...docSnap.data() } as Lesson);
      }
    });

    const pagesRef = collection(db, 'paths', pathId, 'lessons', lessonId, 'pages');
    const q = query(pagesRef, orderBy('order_index', 'asc'));
    const unsubscribePages = onSnapshot(q, (snapshot) => {
      const pagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonPage));
      setPages(pagesData);
    });

    return () => {
      unsubscribeLesson();
      unsubscribePages();
    };
  }, [lessonId, pathId]);

  const currentPage = pages[selectedPageIndex];

  const handleUpdatePage = (updates: Partial<LessonPage>) => {
    const newPages = [...pages];
    newPages[selectedPageIndex] = { ...newPages[selectedPageIndex], ...updates };
    setPages(newPages);
  };

  const handleUpdateLesson = (updates: Partial<Lesson>) => {
    setLessonMetadata({ ...lessonMetadata, ...updates });
  };

  const movePage = (index: number, direction: 'up' | 'down') => {
    const newPages = [...pages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    
    const temp = newPages[index];
    newPages[index] = newPages[targetIndex];
    newPages[targetIndex] = temp;
    
    setPages(newPages);
    if (selectedPageIndex === index) setSelectedPageIndex(targetIndex);
    else if (selectedPageIndex === targetIndex) setSelectedPageIndex(index);
  };

  const handleAddPage = (type: LessonPage['type'], direction: 'rtl' | 'ltr' = 'rtl') => {
    const newPage: LessonPage = {
      id: Date.now().toString(), // Temporary ID as string
      lesson_id: lessonMetadata?.id || lessonId,
      type,
      title: (type === 'explanation' || type === 'media' || type === 'iframe') ? (type === 'media' ? 'وسائط جديدة' : type === 'iframe' ? 'موقع إلكتروني' : (direction === 'ltr' ? 'New Title' : 'عنوان جديد')) : '',
      content: (type === 'explanation' || type === 'media' || type === 'iframe') ? (type === 'media' ? '' : type === 'iframe' ? 'https://' : (direction === 'ltr' ? 'Add text here' : 'أضف نصاً هنا')) : '',
      question: type === 'question' ? (direction === 'ltr' ? 'Add your question here' : 'أضف سؤالك هنا') : '',
      option_a: type === 'question' ? (direction === 'ltr' ? 'Option 1' : 'خيار 1') : '',
      option_b: type === 'question' ? (direction === 'ltr' ? 'Option 2' : 'خيار 2') : '',
      option_c: type === 'question' ? (direction === 'ltr' ? 'Option 3' : 'خيار 3') : '',
      option_d: type === 'question' ? (direction === 'ltr' ? 'Option 4' : 'خيار 4') : '',
      correct_option: type === 'question' ? 'a' : '',
      explanation: '',
      order_index: pages.length,
      direction,
      image_url: '',
      video_url: '',
      audio_url: ''
    };
    setPages([...pages, newPage]);
    setSelectedPageIndex(pages.length);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!lessonMetadata) return;
    setIsSaving(true);
    try {
      // Save lesson metadata
      const { id, ...lessonData } = lessonMetadata;
      await updateDoc(doc(db, 'paths', pathId, 'lessons', lessonId), lessonData);

      // Save pages using a batch
      const batch = writeBatch(db);
      
      const currentPagesSnap = await getDocs(collection(db, 'paths', pathId, 'lessons', lessonId, 'pages'));
      const currentPagesIds = currentPagesSnap.docs.map(d => d.id);
      
      const localPagesIds = pages.map(p => p.id).filter(id => typeof id === 'string');
      currentPagesIds.forEach(id => {
        if (!localPagesIds.includes(id)) {
          batch.delete(doc(db, 'paths', pathId, 'lessons', lessonId, 'pages', id));
        }
      });
      
      pages.forEach((page, index) => {
        const { id, ...pageData } = page;
        const dataToSave = { ...pageData, order_index: index };
        
        if (typeof id === 'string' && currentPagesIds.includes(id)) {
          batch.update(doc(db, 'paths', pathId, 'lessons', lessonId, 'pages', id), dataToSave);
        } else {
          const newDocRef = doc(collection(db, 'paths', pathId, 'lessons', lessonId, 'pages'));
          batch.set(newDocRef, dataToSave);
        }
      });

      await batch.commit();
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `paths/${pathId}/lessons/${lessonId}`);
      alert(err.message || "حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setIsSaving(false);
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const MAX_FILE_SIZE = 800 * 1024; // 800KB to allow for base64 overhead and other fields

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit for raw image before compression
        alert("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت.");
        return;
      }
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const compressed = await compressImage(reader.result as string);
            if (compressed.length > MAX_FILE_SIZE * 1.3) {
              alert("الصورة لا تزال كبيرة جداً حتى بعد الضغط. يرجى استخدام رابط خارجي أو صورة أصغر.");
              setIsUploading(false);
              return;
            }
            handleUpdatePage({ image_url: compressed });
          } catch (err) {
            console.error("Compression failed:", err);
            alert("فشل ضغط الصورة");
          }
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Upload error:", err);
        alert("حدث خطأ أثناء رفع الملف");
        setIsUploading(false);
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert("حجم الفيديو كبير جداً للتخزين المباشر (الحد الأقصى 700 كيلوبايت). يرجى استخدام رابط خارجي (YouTube, Drive, etc.) أو ضغط الفيديو.");
        return;
      }
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          handleUpdatePage({ video_url: reader.result as string });
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Upload error:", err);
        alert("حدث خطأ أثناء رفع الملف");
        setIsUploading(false);
      }
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        alert("يرجى اختيار ملف صوتي صحيح");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert("حجم الملف الصوتي كبير جداً للتخزين المباشر (الحد الأقصى 800 كيلوبايت). يرجى استخدام رابط خارجي (مثل Google Drive أو Dropbox) للملفات الكبيرة.");
        return;
      }
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          handleUpdatePage({ audio_url: reader.result as string });
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Upload error:", err);
        alert("حدث خطأ أثناء رفع الملف");
        setIsUploading(false);
      }
    }
  };

  const handleLessonImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت.");
        return;
      }
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const compressed = await compressImage(reader.result as string);
            if (compressed.length > MAX_FILE_SIZE * 1.3) {
              alert("الصورة لا تزال كبيرة جداً حتى بعد الضغط. يرجى استخدام رابط خارجي أو صورة أصغر.");
              setIsUploading(false);
              return;
            }
            handleUpdateLesson({ image_url: compressed });
          } catch (err) {
            console.error("Compression failed:", err);
            alert("فشل ضغط الصورة");
          }
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Upload error:", err);
        alert("حدث خطأ أثناء رفع الملف");
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#F0F2F9] z-50 flex flex-col font-sans overflow-hidden" dir="rtl">
      {/* Top Bar */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm shrink-0">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <h1 className="font-bold text-slate-800 truncate text-sm md:text-base whitespace-normal break-words">تحرير: {lessonMetadata?.title}</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 flex items-center gap-2"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden md:inline text-sm font-bold">إعدادات الدرس</span>
          </button>
          <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl">
            <button className="flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg bg-white shadow-sm text-xs md:text-sm font-bold text-violet-600">
              <Edit3 className="w-4 h-4" />
              تحرير
            </button>
            <button 
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold text-slate-500 hover:text-slate-700"
            >
              <Play className="w-4 h-4" />
              معاينة
            </button>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-violet-600 text-white px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 hover:bg-violet-700 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'جاري...' : 'حفظ'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Canvas */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 flex justify-center">
          <div className="w-full max-w-4xl space-y-6 md:space-y-8">
            {currentPage ? (
              <motion.div 
                key={currentPage?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Image Section */}
                <div className="min-h-[200px] bg-white rounded-2xl md:rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 group hover:border-violet-300 transition-colors relative overflow-hidden">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                  />
                  <input 
                    type="file" 
                    ref={videoInputRef} 
                    className="hidden" 
                    accept="video/*" 
                    onChange={handleVideoUpload} 
                  />
                  <input 
                    type="file" 
                    ref={audioInputRef} 
                    className="hidden" 
                    accept="audio/*" 
                    onChange={handleAudioUpload} 
                  />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-bold text-slate-500">جاري المعالجة...</span>
                    </div>
                  ) : (
                    <div className="w-full space-y-4 p-4">
                      {currentPage?.video_url ? (
                        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group/media">
                          {getEmbedUrl(currentPage.video_url).includes('youtube.com/embed') || getEmbedUrl(currentPage.video_url).includes('player.vimeo.com') ? (
                            <iframe 
                              src={getEmbedUrl(currentPage.video_url)} 
                              className="w-full h-full border-none"
                              title="Video Preview"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <video 
                              src={currentPage.video_url} 
                              className="w-full h-full object-contain" 
                              controls 
                            />
                          )}
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/media:opacity-100 transition-opacity">
                            <button 
                              onClick={() => videoInputRef.current?.click()}
                              className="p-2 bg-white/90 backdrop-blur rounded-lg text-violet-600 hover:bg-white shadow-sm"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleUpdatePage({ video_url: '' })}
                              className="p-2 bg-white/90 backdrop-blur rounded-lg text-red-500 hover:bg-white shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : currentPage?.image_url ? (
                        <div className="relative group/media">
                          <img src={currentPage?.image_url || null} alt="" className="w-full h-auto max-h-[500px] object-contain bg-slate-50 rounded-2xl" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-2xl">
                            <button 
                              onClick={() => setFullScreenImage(currentPage?.image_url!)}
                              className="p-3 bg-white rounded-full text-violet-600 hover:scale-110 transition-transform"
                              title="عرض بالحجم الكامل"
                            >
                              <ZoomIn className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="p-3 bg-white rounded-full text-violet-600 hover:scale-110 transition-transform"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleUpdatePage({ image_url: '' })}
                              className="p-3 bg-white rounded-full text-red-500 hover:scale-110 transition-transform"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {currentPage?.audio_url && (
                        <div className="relative w-full p-4 md:p-6 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 group/audio shadow-sm">
                          <div className="flex items-center gap-4 w-full max-w-md">
                            <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                              <Music className="w-5 h-5 text-violet-600" />
                            </div>
                            <audio 
                              src={currentPage?.audio_url} 
                              className="flex-1 h-10" 
                              controls 
                            />
                          </div>
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/audio:opacity-100 transition-opacity">
                            <button 
                              onClick={() => audioInputRef.current?.click()}
                              className="p-1.5 bg-slate-100 rounded-lg text-violet-600 hover:bg-white shadow-sm"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleUpdatePage({ audio_url: '' })}
                              className="p-1.5 bg-slate-100 rounded-lg text-red-500 hover:bg-white shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {!currentPage?.video_url && !currentPage?.image_url && !currentPage?.audio_url && (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <div className="flex gap-4">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-violet-50 transition-colors">
                                <ImageIcon className="w-6 h-6 md:w-8 md:h-8 text-slate-400 group-hover:text-violet-500" />
                              </div>
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 md:px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                              >
                                استعراض الصور
                              </button>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-violet-50 transition-colors">
                                <Video className="w-6 h-6 md:w-8 md:h-8 text-slate-400 group-hover:text-violet-500" />
                              </div>
                              <button 
                                onClick={() => videoInputRef.current?.click()}
                                className="px-4 md:px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                              >
                                استعراض الفيديو
                              </button>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-violet-50 transition-colors">
                                <Music className="w-6 h-6 md:w-8 md:h-8 text-slate-400 group-hover:text-violet-500" />
                              </div>
                              <button 
                                onClick={() => audioInputRef.current?.click()}
                                className="px-4 md:px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                              >
                                استعراض الصوت
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <input 
                      type="text" 
                      placeholder="رابط الصورة"
                      className="flex-1 p-2 bg-white/90 backdrop-blur border border-slate-200 rounded-lg text-[10px] md:text-xs"
                      value={currentPage?.image_url || ''}
                      onChange={e => handleUpdatePage({ image_url: e.target.value })}
                    />
                    <input 
                      type="text" 
                      placeholder="رابط الفيديو"
                      className="flex-1 p-2 bg-white/90 backdrop-blur border border-slate-200 rounded-lg text-[10px] md:text-xs"
                      value={currentPage?.video_url || ''}
                      onChange={e => handleUpdatePage({ video_url: e.target.value })}
                    />
                    <input 
                      type="text" 
                      placeholder="رابط الصوت"
                      className="flex-1 p-2 bg-white/90 backdrop-blur border border-slate-200 rounded-lg text-[10px] md:text-xs"
                      value={currentPage?.audio_url || ''}
                      onChange={e => handleUpdatePage({ audio_url: e.target.value })}
                    />
                  </div>
                </div>

                {/* Iframe Preview for Iframe Type */}
                {currentPage?.type === 'iframe' && currentPage?.content && currentPage?.content.startsWith('http') && (
                  <div className="w-full aspect-video bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <iframe 
                      src={getEmbedUrl(currentPage?.content)} 
                      className="w-full h-full border-none"
                      title="Preview"
                    />
                  </div>
                )}

                {/* Content Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                        onClick={() => handleUpdatePage({ direction: 'rtl' })}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${(!currentPage?.direction || currentPage?.direction === 'rtl') ? 'bg-white shadow-sm text-violet-600' : 'text-slate-400'}`}
                      >
                        العربية (RTL)
                      </button>
                      <button 
                        onClick={() => handleUpdatePage({ direction: 'ltr' })}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${currentPage?.direction === 'ltr' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-400'}`}
                      >
                        English (LTR)
                      </button>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">اتجاه النص</span>
                  </div>

                  {currentPage?.type === 'explanation' || currentPage?.type === 'media' || currentPage?.type === 'iframe' ? (
                    <>
                      <input 
                        type="text" 
                        dir={currentPage?.direction || 'rtl'}
                        className={`w-full text-2xl md:text-4xl font-bold text-slate-800 bg-transparent border-none focus:ring-0 placeholder:text-slate-300 ${currentPage?.direction === 'ltr' ? 'text-left' : 'text-right md:text-center'}`}
                        placeholder={currentPage?.type === 'media' ? "عنوان الوسائط (اختياري)" : currentPage?.type === 'iframe' ? "عنوان الموقع" : "أضف عنواناً هنا"}
                        value={currentPage?.title || ''}
                        onChange={e => handleUpdatePage({ title: e.target.value })}
                      />
                      
                      {currentPage?.type === 'iframe' ? (
                        <textarea 
                          dir={currentPage?.direction || 'rtl'}
                          className={`w-full text-lg md:text-xl text-slate-500 bg-transparent border-none focus:ring-0 placeholder:text-slate-300 resize-y min-h-[100px] ${currentPage?.direction === 'ltr' ? 'text-left' : 'text-right md:text-center'}`}
                          placeholder="أضف رابط الموقع هنا (مثلاً: https://forms.microsoft.com/...)"
                          value={currentPage?.content || ''}
                          onChange={e => handleUpdatePage({ content: e.target.value })}
                        />
                      ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" dir={currentPage?.direction || 'rtl'}>
                          <ReactQuill 
                            {...({ ref: quillRef } as any)}
                            theme="snow"
                            value={currentPage?.content || ''}
                            onChange={content => handleUpdatePage({ content })}
                            placeholder={currentPage?.type === 'media' ? "وصف الوسائط (اختياري)" : "أضف نصاً هنا"}
                            formats={[
                              'header', 'size', 'bold', 'italic', 'underline', 'strike',
                              'color', 'background', 'list', 'direction', 'align', 'link'
                            ]}
                            modules={{
                              toolbar: {
                                container: [
                                  [{ 'header': [1, 2, 3, false] }],
                                  [{ 'size': ['small', false, 'large', 'huge'] }],
                                  ['bold', 'italic', 'underline', 'strike'],
                                  [{ 'color': [] }, { 'background': [] }],
                                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                  [{ 'direction': 'rtl' }, { 'align': '' }, { 'align': 'center' }, { 'align': 'right' }, { 'align': 'justify' }],
                                  ['link'],
                                  ['audio'],
                                  ['clean']
                                ],
                                handlers: {
                                  audio: () => {
                                    audioInputRef.current?.click();
                                  },
                                  direction: (value: any) => {
                                    if (quillRef.current) {
                                      const quill = quillRef.current.getEditor();
                                      const formats = quill.getFormat();
                                      const isRtl = formats.direction === 'rtl' || (!formats.direction && formats.align !== 'left');
                                      
                                      if (isRtl) {
                                        quill.format('direction', false);
                                        quill.format('align', 'left');
                                      } else {
                                        quill.format('direction', 'rtl');
                                        quill.format('align', 'right');
                                      }
                                    }
                                  }
                                }
                              }
                            }}
                            className="ql-editor-container"
                          />
                        </div>
                      )}

                      <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                            عدد الكلمات: {getWordCount(currentPage?.content || '')}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                            عدد الحروف: {(currentPage?.content || '').replace(/<[^>]*>/g, '').length}
                          </span>
                        </div>
                      </div>

                      {currentPage?.type === 'iframe' && (
                        <p className="text-center text-[10px] text-slate-400 font-bold whitespace-normal break-words">
                          ملاحظة: تأكد من أن الرابط يبدأ بـ https:// ليعمل بشكل صحيح.
                        </p>
                      )}
                    </>
                  ) : currentPage?.type === 'question' ? (
                    <div className="space-y-6">
                      <textarea 
                        dir={currentPage?.direction || 'rtl'}
                        className={`w-full text-xl md:text-3xl font-bold text-slate-800 bg-transparent border-none focus:ring-0 placeholder:text-slate-300 resize-y min-h-[60px] ${currentPage?.direction === 'ltr' ? 'text-left' : 'text-right md:text-center'}`}
                        placeholder="أضف سؤالك هنا"
                        value={currentPage?.question || ''}
                        onChange={e => handleUpdatePage({ question: e.target.value })}
                      />
                      <div className="flex justify-start items-center gap-2 px-2 -mt-2">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                          عدد الكلمات: {getWordCount(currentPage?.question || '')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                          عدد الحروف: {(currentPage?.question || '').length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {['a', 'b', 'c', 'd'].map((opt) => (
                          <div key={opt} className="relative group">
                            <input 
                              type="text"
                              dir={currentPage?.direction || 'rtl'}
                              className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all font-bold text-sm md:text-base ${currentPage?.direction === 'ltr' ? 'text-left pl-10 md:pl-12' : 'text-right pr-10 md:pr-12'} ${currentPage?.correct_option === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white hover:border-violet-300'}`}
                              placeholder={`خيار ${opt.toUpperCase()}`}
                              value={(currentPage as any)?.[`option_${opt}`] || ''}
                              onChange={e => handleUpdatePage({ [`option_${opt}`]: e.target.value })}
                            />
                            <button 
                              onClick={() => handleUpdatePage({ correct_option: opt })}
                              className={`absolute ${currentPage?.direction === 'ltr' ? 'left-3 md:left-4' : 'right-3 md:right-4'} top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-colors ${currentPage?.correct_option === opt ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 group-hover:border-violet-400'}`}
                            >
                              {currentPage?.correct_option === opt && <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-400">
                      <p className="font-bold whitespace-normal break-words">هذا النوع من الصفحات ({currentPage?.type}) قيد التطوير حالياً.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                <Layout className="w-12 h-12 md:w-16 md:h-16 opacity-20" />
                <p className="font-bold text-center text-sm md:text-base whitespace-normal break-words">لا توجد صفحات في هذا الدرس بعد. أضف واحدة من القائمة الجانبية.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Page List */}
        <div className="w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 whitespace-normal break-words">صفحات الدرس</h2>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-2 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {pages.map((p, idx) => (
              <div 
                key={p.id}
                onClick={() => setSelectedPageIndex(idx)}
                className={`group p-3 rounded-xl border-2 transition-all cursor-pointer relative ${selectedPageIndex === idx ? 'border-violet-500 bg-violet-50' : 'border-transparent hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${selectedPageIndex === idx ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className={`text-xs font-bold truncate whitespace-normal break-words ${selectedPageIndex === idx ? 'text-violet-700' : 'text-slate-600'}`}>
                        {p.type === 'explanation' ? 'شرح: ' : p.type === 'question' ? 'سؤال: ' : p.type === 'iframe' ? 'موقع: ' : 'وسائط: '}
                        {p.title || p.question || 'بدون عنوان'}
                      </p>
                      {p.direction === 'ltr' && (
                        <span className="text-[8px] bg-slate-100 text-slate-400 px-1 rounded-sm font-bold shrink-0">EN</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 whitespace-normal break-words">
                      {p.type === 'explanation' ? 'نص تعليمي' : p.type === 'question' ? 'اختيار من متعدد' : p.type === 'iframe' ? 'محتوى خارجي' : 'صورة أو فيديو'}
                    </p>
                  </div>
                </div>
                
                {/* Reorder Controls */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); movePage(idx, 'up'); }} className="p-1 hover:text-violet-600"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); movePage(idx, 'down'); }} className="p-1 hover:text-violet-600"><ChevronDown className="w-3 h-3" /></button>
                </div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const newPages = pages.filter((_, i) => i !== idx);
                    setPages(newPages);
                    if (selectedPageIndex >= newPages.length) setSelectedPageIndex(Math.max(0, newPages.length - 1));
                  }}
                  className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Page Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 whitespace-normal break-words">إضافة صفحة جديدة</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleAddPage('explanation')}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-violet-500 hover:bg-violet-50 transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <Type className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-700 whitespace-normal break-words">صفحة شرح</span>
                </button>
                <button 
                  onClick={() => handleAddPage('explanation', 'ltr')}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-violet-500 hover:bg-violet-50 transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform relative">
                    <Type className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[8px] px-1 rounded-sm font-bold">EN</span>
                  </div>
                  <span className="font-bold text-slate-700 whitespace-normal break-words">شرح (إنجليزي)</span>
                </button>
                <button 
                  onClick={() => handleAddPage('question')}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-violet-500 hover:bg-violet-50 transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                    <ListChecks className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-700 whitespace-normal break-words">سؤال</span>
                </button>
                <button 
                  onClick={() => handleAddPage('question', 'ltr')}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-violet-500 hover:bg-violet-50 transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform relative">
                    <ListChecks className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[8px] px-1 rounded-sm font-bold">EN</span>
                  </div>
                  <span className="font-bold text-slate-700 whitespace-normal break-words">سؤال (إنجليزي)</span>
                </button>
                <button 
                  onClick={() => handleAddPage('media')}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-violet-500 hover:bg-violet-50 transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-700 whitespace-normal break-words">وسائط</span>
                </button>
                <button 
                  onClick={() => handleAddPage('iframe')}
                  className="p-6 rounded-2xl border-2 border-slate-100 hover:border-violet-500 hover:bg-violet-50 transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <Globe className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-700 whitespace-normal break-words">موقع / يوتيوب</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 whitespace-normal break-words">إعدادات الدرس</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">عنوان الدرس</label>
                  <input 
                    type="text" 
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-violet-500 font-bold"
                    value={lessonMetadata?.title || ''}
                    onChange={e => handleUpdateLesson({ title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">صورة الغلاف</label>
                  <div className="relative group aspect-video bg-slate-100 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200">
                    <input 
                      type="file" 
                      ref={lessonImageInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleLessonImageUpload} 
                    />
                    {lessonMetadata?.image_url ? (
                      <>
                        <img src={lessonMetadata.image_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button onClick={() => lessonImageInputRef.current?.click()} className="p-2 bg-white rounded-lg text-violet-600"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleUpdateLesson({ image_url: '' })} className="p-2 bg-white rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </>
                    ) : (
                      <button 
                        onClick={() => lessonImageInputRef.current?.click()}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-violet-500 transition-colors"
                      >
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs font-bold whitespace-normal break-words">رفع صورة</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">المدة المتوقعة</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-violet-500 font-bold"
                      value={lessonMetadata?.duration || ''}
                      onChange={e => handleUpdateLesson({ duration: e.target.value })}
                      placeholder="مثلاً: 15 دقيقة"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">المصدر</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-violet-500 font-bold"
                      value={lessonMetadata.source || ''}
                      onChange={e => handleUpdateLesson({ source: e.target.value })}
                      placeholder="مثلاً: منصة مدرستي"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full bg-violet-600 text-white py-4 rounded-2xl font-bold hover:bg-violet-700 transition-all"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullScreenImage(null)}
            className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
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
      {/* Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[100] bg-white overflow-hidden">
              <LessonViewer 
                lessonId={lessonId} 
                pathId={pathId}
                initialLesson={lessonMetadata} 
                initialPages={pages} 
                onClose={() => setIsPreviewOpen(false)} 
              />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LessonEditor;
