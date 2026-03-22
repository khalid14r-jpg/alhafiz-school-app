import React, { useState, useEffect, Fragment, useCallback } from 'react';
import { 
  Layout, BookOpen, Settings, 
  Plus, Trash2, 
  Users, Cpu, 
  X, Edit3, Play, Image as ImageIcon, ListChecks, Bell,
  CheckCircle2, ArrowUp, ArrowDown, ChevronDown, Circle, Compass, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Path, Lesson, LessonPage } from '../types';
import LessonEditor from '../components/LessonEditor';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/image';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  collectionGroup,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const AdminDashboard = () => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingPath, setEditingPath] = useState<Path | null>(null);
  const [pages, setPages] = useState<LessonPage[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'path' | 'lesson' | 'user', title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'users' | 'database'>('content');
  const { user: currentUser } = useAuth();

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  
  // Database Explorer State
  const [selectedCollection, setSelectedCollection] = useState('users');
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [addingUser, setAddingUser] = useState<any | null>(null);
  
  // User Filtering State
  const [filterName, setFilterName] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterGrade, setFilterGrade] = useState('');

  const [newUser, setNewUser] = useState({ 
    first_name: '', 
    father_name: '', 
    grandfather_name: '', 
    family_name: '', 
    username: '', 
    password: '', 
    role: 'student', 
    grade: '',
    school_name: 'مدرسة الحافظ بن عساكر بأملج',
    category: 'الرياضيات'
  });

  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [showExistingLessons, setShowExistingLessons] = useState(false);

  const [newPath, setNewPath] = useState({ title: '', description: '', icon: 'Book', category: 'الرياضيات', image_url: '' });
  const [newLesson, setNewLesson] = useState({ title: '', image_url: '', source: 'منصة الرياضيات', duration: '10 دقائق' });

  // Notification State
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'general' as 'general' | 'personal' | 'category',
    target_user_id: '',
    target_category: 'الرياضيات',
    path_id: '',
    lesson_id: ''
  });
  const [notifFilterSchool, setNotifFilterSchool] = useState('');
  const [notifFilterGrade, setNotifFilterGrade] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher')) return;
    
    const q = query(collection(db, 'notifications'), orderBy('created_at', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSentNotifications(notifs);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(collection(db, 'paths'), (snapshot) => {
      const pathsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Path));
      const sortedPaths = pathsData.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setPaths(sortedPaths);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'paths');
    });

    const unsubscribeLessons = onSnapshot(collectionGroup(db, 'lessons'), (snapshot) => {
      const lessonsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          path_id: doc.ref.parent.parent?.id
        } as Lesson;
      });
      setAllLessons(lessonsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'lessons_group');
    });

    let unsubscribeUsers: (() => void) | null = null;
    if (currentUser?.role === 'admin' || currentUser?.role === 'teacher') {
      unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      });
    }

    return () => {
      unsubscribe();
      unsubscribeLessons();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [currentUser]);

  useEffect(() => {
    if (selectedPath) {
      const q = query(collection(db, 'paths', selectedPath, 'lessons'), orderBy('order_index', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const lessonsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
        setLessons(lessonsData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `paths/${selectedPath}/lessons`);
      });
      setSelectedLesson(null);
      return () => unsubscribe();
    }
  }, [selectedPath]);

  useEffect(() => {
    if (selectedLesson && selectedPath) {
      const q = query(collection(db, 'paths', selectedPath, 'lessons', selectedLesson, 'pages'), orderBy('order_index', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const pagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonPage));
        setPages(pagesData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `paths/${selectedPath}/lessons/${selectedLesson}/pages`);
      });
      return () => unsubscribe();
    }
  }, [selectedLesson, selectedPath]);

  const handleRunQuery = async () => {
    setIsQuerying(true);
    setError(null);
    try {
      const q = query(collection(db, selectedCollection), limit(50));
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQueryResult(results);
    } catch (err) {
      console.error("Query failed:", err);
      setError("فشل استعلام قاعدة البيانات. تأكد من صحة اسم المجموعة.");
    } finally {
      setIsQuerying(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    setError(null);
    try {
      // Use the server-side API to create the user in Auth and Firestore
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUser.username,
          password: newUser.password,
          userData: {
            ...newUser,
            created_at: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "فشل إضافة المستخدم");
      }

      setSuccessMessage("تم إضافة المستخدم بنجاح");
      setAddingUser(false);
      setNewUser({ 
        first_name: '', 
        father_name: '', 
        grandfather_name: '', 
        family_name: '', 
        username: '', 
        password: '', 
        role: 'student', 
        grade: '',
        school_name: 'مدرسة الحافظ بن عساكر بأملج',
        category: 'الرياضيات'
      });
    } catch (err: any) {
      console.error("Add user failed:", err);
      setError(err.message || "فشل إضافة المستخدم");
    }
  };

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setError(null);
    try {
      const { id, password, ...userData } = editingUser;
      
      if (password && password.trim().length > 0 && password.length < 6) {
        setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        return;
      }

      // Use the server-side API to update the user in Auth and Firestore
      const response = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: id,
          password: password, // This will update Auth password if provided
          userData: userData
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "فشل تحديث بيانات المستخدم");
      }

      setSuccessMessage("تم تحديث بيانات المستخدم بنجاح");
      setEditingUser(null);
    } catch (err: any) {
      console.error("Update user failed:", err);
      setError(err.message || "فشل تحديث بيانات المستخدم");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "فشل حذف المستخدم");
      }

      setDeleteConfirm(null);
    } catch (err: any) {
      console.error("Delete user failed:", err);
      setError(err.message || "فشل حذف المستخدم");
    }
  };

  const handleAddPath = async () => {
    if (!newPath.title) {
      setError("يرجى إدخال عنوان المسار");
      return;
    }
    setError(null);
    try {
      await addDoc(collection(db, 'paths'), { ...newPath, order_index: paths.length });
      setNewPath({ title: '', description: '', icon: 'Book', category: 'الرياضيات', image_url: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'paths');
      setError("فشل إضافة المسار");
    }
  };

  const handleUpdatePath = async () => {
    if (!editingPath) return;
    setError(null);
    try {
      const { id, ...data } = editingPath;
      await updateDoc(doc(db, 'paths', id), data);
      setEditingPath(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `paths/${editingPath.id}`);
      setError("فشل تحديث المسار");
    }
  };

  const handlePathImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          const MAX_FILE_SIZE = 700 * 1024;
          if (compressed.length > MAX_FILE_SIZE * 1.3) {
            setError("الصورة لا تزال كبيرة جداً حتى بعد الضغط. يرجى استخدام رابط خارجي أو صورة أصغر.");
            return;
          }
          if (isEditing && editingPath) {
            setEditingPath({ ...editingPath, image_url: compressed });
          } else {
            setNewPath({ ...newPath, image_url: compressed });
          }
        } catch (err) {
          console.error("Compression failed:", err);
          setError("فشل ضغط الصورة");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLessonImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          const MAX_FILE_SIZE = 700 * 1024;
          if (compressed.length > MAX_FILE_SIZE * 1.3) {
            setError("الصورة لا تزال كبيرة جداً حتى بعد الضغط. يرجى استخدام رابط خارجي أو صورة أصغر.");
            return;
          }
          setNewLesson({ ...newLesson, image_url: compressed });
        } catch (err) {
          console.error("Compression failed:", err);
          setError("فشل ضغط الصورة");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeletePath = (id: string) => {
    const pathToDelete = paths.find(p => p.id === id);
    if (!pathToDelete) return;
    setDeleteConfirm({ id, type: 'path', title: pathToDelete.title });
  };

  const handleDeleteLesson = () => {
    if (!selectedLesson) return;
    const lessonToDelete = lessons.find(l => l.id === selectedLesson);
    if (!lessonToDelete) return;
    setDeleteConfirm({ id: selectedLesson, type: 'lesson', title: lessonToDelete.title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    setError(null);

    try {
      if (type === 'path') {
        await deleteDoc(doc(db, 'paths', id));
        if (selectedPath === id) {
          setSelectedPath(null);
          setLessons([]);
        }
      } else if (type === 'lesson') {
        if (!selectedPath) return;
        await deleteDoc(doc(db, 'paths', selectedPath, 'lessons', id));
        setSelectedLesson(null);
        setPages([]);
      } else if (type === 'user') {
        await deleteDoc(doc(db, 'users', id));
      }
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setError("حدث خطأ أثناء الاتصال بالخادم");
    }
  };

  const handleAddLesson = async () => {
    if (!selectedPath || !newLesson.title) return;
    setError(null);
    try {
      await addDoc(collection(db, 'paths', selectedPath, 'lessons'), { 
        ...newLesson, 
        path_id: selectedPath, 
        order_index: lessons.length 
      });
      setNewLesson({ title: '', image_url: '', source: 'منصة الرياضيات', duration: '10 دقائق' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `paths/${selectedPath}/lessons`);
      setError("فشل إضافة الدرس");
    }
  };

  const handleCopyLesson = async (lessonId: string) => {
    if (!selectedPath) return;
    setError(null);
    try {
      // Find the source lesson in local state
      const sourceLesson = allLessons.find(l => l.id === lessonId);
      
      if (!sourceLesson) {
        setError("الدرس غير موجود");
        return;
      }
      
      const sourcePathId = sourceLesson.path_id;
      
      if (!sourcePathId) {
        setError("فشل تحديد مسار الدرس المصدر");
        return;
      }

      // Add the lesson to the new path
      const { id: _, ...lessonData } = sourceLesson;
      const newLessonRef = await addDoc(collection(db, 'paths', selectedPath, 'lessons'), {
        ...lessonData,
        path_id: selectedPath,
        order_index: lessons.length
      });

      // Copy pages
      let pagesSnapshot;
      try {
        pagesSnapshot = await getDocs(collection(db, 'paths', sourcePathId, 'lessons', lessonId, 'pages'));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `paths/${sourcePathId}/lessons/${lessonId}/pages`);
        throw err;
      }
      
      const batch = writeBatch(db);
      pagesSnapshot.docs.forEach(pageDoc => {
        const newPageRef = doc(collection(db, 'paths', selectedPath, 'lessons', newLessonRef.id, 'pages'));
        batch.set(newPageRef, pageDoc.data());
      });
      await batch.commit();
      
      setShowExistingLessons(false);
    } catch (err) {
      console.error("Copy lesson failed:", err);
      setError("حدث خطأ أثناء نسخ الدرس");
    }
  };

  const handleReorderPaths = async (direction: 'up' | 'down', index: number) => {
    const newPaths = [...paths];
    if (direction === 'up' && index > 0) {
      [newPaths[index], newPaths[index - 1]] = [newPaths[index - 1], newPaths[index]];
    } else if (direction === 'down' && index < newPaths.length - 1) {
      [newPaths[index], newPaths[index + 1]] = [newPaths[index + 1], newPaths[index]];
    } else {
      return;
    }

    const batch = writeBatch(db);
    newPaths.forEach((p, i) => {
      batch.update(doc(db, 'paths', p.id), { order_index: i });
    });
    try {
      await batch.commit();
      setPaths(newPaths);
    } catch (err) {
      console.error("Reorder paths failed:", err);
    }
  };

  const handleReorderLessons = async (direction: 'up' | 'down', index: number) => {
    if (!selectedPath) return;
    const newLessons = [...lessons];
    if (direction === 'up' && index > 0) {
      [newLessons[index], newLessons[index - 1]] = [newLessons[index - 1], newLessons[index]];
    } else if (direction === 'down' && index < newLessons.length - 1) {
      [newLessons[index], newLessons[index + 1]] = [newLessons[index + 1], newLessons[index]];
    } else {
      return;
    }

    const batch = writeBatch(db);
    newLessons.forEach((l, i) => {
      batch.update(doc(db, 'paths', selectedPath, 'lessons', l.id), { order_index: i });
    });
    try {
      await batch.commit();
      setLessons(newLessons);
    } catch (err) {
      console.error("Reorder lessons failed:", err);
    }
  };

  const handleSendNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      setError("يرجى إدخال عنوان ورسالة الإشعار");
      return;
    }
    if (newNotification.type === 'personal' && !newNotification.target_user_id) {
      setError("يرجى اختيار الطالب");
      return;
    }
    setIsSendingNotification(true);
    setError(null);
    try {
      await addDoc(collection(db, 'notifications'), {
        ...newNotification,
        sender_id: currentUser?.id,
        sender_name: `${currentUser?.first_name} ${currentUser?.family_name}`,
        created_at: serverTimestamp(),
        read_by: [],
        read: false
      });
      setSuccessMessage("تم إرسال الإشعار بنجاح");
      setNewNotification({
        title: '',
        message: '',
        type: 'general',
        target_user_id: '',
        target_category: 'الرياضيات',
        path_id: '',
        lesson_id: ''
      });
      setNotifFilterSchool('');
      setNotifFilterGrade('');
    } catch (err) {
      console.error("Send notification failed:", err);
      setError("فشل إرسال الإشعار");
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error("Delete notification failed:", err);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">لوحة تحكم {currentUser?.role === 'admin' ? 'المدير' : 'المعلم'}</h1>
        
        <div className="flex items-center gap-4">
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => setAddingUser(true)}
              className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة مستخدم جديد
            </button>
          )}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('content')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'content' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500'}`}
            >
              إدارة المحتوى
            </button>
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500'}`}
              >
                إدارة المستخدمين
              </button>
            )}
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'notifications' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500'}`}
            >
              الإشعارات
            </button>
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('database')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'database' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500'}`}
              >
                قاعدة البيانات
              </button>
            )}
          </div>
        </div>
    </div>

      {successMessage && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-between">
          <span className="font-bold">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-emerald-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && !deleteConfirm && !editingPath && !editingUser && (
        <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center justify-between">
          <span className="font-bold">{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
          {/* Paths Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Layout className="w-5 h-5 text-emerald-500" />
              المسارات التعليمية
            </h2>
            <div className="space-y-3 mb-6 flex-1 overflow-y-auto max-h-[600px]">
              {paths.map((p, index) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="flex flex-col gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <button 
                      onClick={() => handleReorderPaths('up', index)}
                      disabled={index === 0}
                      className="p-1.5 hover:bg-white hover:shadow-sm rounded-md disabled:opacity-20 transition-all text-slate-600"
                      title="تحريك للأعلى"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleReorderPaths('down', index)}
                      disabled={index === paths.length - 1}
                      className="p-1.5 hover:bg-white hover:shadow-sm rounded-md disabled:opacity-20 transition-all text-slate-600"
                      title="تحريك للأسفل"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedPath(p.id)}
                    className={`flex-1 text-right p-3 rounded-lg border transition-colors ${selectedPath === p.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{p.title}</span>
                      <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-400">{p.category}</span>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => setEditingPath(p)}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeletePath(p.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-2">إضافة مسار جديد</h3>
              <input 
                type="text" placeholder="عنوان المسار" 
                className="w-full p-2 border rounded-lg text-sm"
                value={newPath.title} onChange={e => setNewPath({...newPath, title: e.target.value})}
              />
              <input 
                type="text" placeholder="وصف المسار" 
                className="w-full p-2 border rounded-lg text-sm"
                value={newPath.description} onChange={e => setNewPath({...newPath, description: e.target.value})}
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">الفئة</label>
                <select 
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                  value={newPath.category} onChange={e => setNewPath({...newPath, category: e.target.value})}
                >
                  <option value="الرياضيات">الرياضيات</option>
                  <option value="العلوم">العلوم</option>
                  <option value="اللغة الانجليزية">اللغة الانجليزية</option>
                  <option value="المهارات الرقمية">المهارات الرقمية</option>
                  <option value="الدراسات الاجتماعية">الدراسات الاجتماعية</option>
                  <option value="مهارات الحياة">مهارات الحياة</option>
                  <option value="الفن والتصميم">الفن والتصميم</option>
                  <option value="اختبار نافس">اختبار نافس</option>
                  <option value="الموهوبين">الموهوبين</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">صورة المسار</label>
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="رابط الصورة" 
                    className="flex-1 p-2 border rounded-lg text-sm"
                    value={newPath.image_url} onChange={e => setNewPath({...newPath, image_url: e.target.value})}
                  />
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-slate-600" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePathImageUpload(e)} />
                  </label>
                </div>
              </div>
              <button onClick={handleAddPath} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold hover:bg-emerald-600 transition-colors">إضافة مسار</button>
            </div>
          </div>

          {/* Lessons Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              الدروس
            </h2>
            {selectedPath ? (
              <>
                <div className="space-y-3 mb-6 flex-1 overflow-y-auto max-h-[600px]">
                  {lessons.map((l, index) => (
                    <div key={l.id} className="flex items-center gap-2">
                    <div className="flex flex-col gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                      <button 
                        onClick={() => handleReorderLessons('up', index)}
                        disabled={index === 0}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-md disabled:opacity-20 transition-all text-slate-600"
                        title="تحريك للأعلى"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleReorderLessons('down', index)}
                        disabled={index === lessons.length - 1}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-md disabled:opacity-20 transition-all text-slate-600"
                        title="تحريك للأسفل"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                      <button
                        onClick={() => setSelectedLesson(l.id)}
                        className={`flex-1 text-right p-3 rounded-lg border transition-colors ${selectedLesson === l.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200'}`}
                      >
                        {l.title}
                      </button>
                    </div>
                  ))}
                  {lessons.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">لا توجد دروس في هذا المسار</p>}
                </div>
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">إضافة درس جديد</h3>
                  <input 
                    type="text" placeholder="عنوان الدرس" 
                    className="w-full p-2 border rounded-lg text-sm"
                    value={newLesson.title} onChange={e => setNewLesson({...newLesson, title: e.target.value})}
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">صورة الدرس</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" placeholder="رابط الصورة" 
                        className="flex-1 p-2 border rounded-lg text-sm"
                        value={newLesson.image_url} onChange={e => setNewLesson({...newLesson, image_url: e.target.value})}
                      />
                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4 text-slate-600" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleLessonImageUpload} />
                      </label>
                    </div>
                  </div>
                  <button onClick={handleAddLesson} className="w-full bg-blue-500 text-white py-2 rounded-lg font-bold hover:bg-blue-600 mb-2 transition-colors">إضافة درس جديد</button>
                  <button 
                    onClick={() => setShowExistingLessons(true)} 
                    className="w-full bg-slate-100 text-slate-600 py-2 rounded-lg font-bold hover:bg-slate-200 mb-2 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    اختيار درس موجود
                  </button>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button 
                      disabled={!selectedLesson}
                      onClick={() => {
                        const lesson = lessons.find(l => l.id === selectedLesson);
                        if (lesson && selectedPath) setEditingLesson({ ...lesson, path_id: selectedPath });
                      }}
                      className="bg-violet-50 text-violet-600 py-2 rounded-lg font-bold hover:bg-violet-100 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Edit3 className="w-4 h-4" />
                      تحرير المحتوى
                    </button>
                    <button 
                      disabled={!selectedLesson}
                      onClick={handleDeleteLesson}
                      className="bg-red-50 text-red-600 py-2 rounded-lg font-bold hover:bg-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف الدرس
                    </button>
                  </div>
                </div>
              </>
            ) : <p className="text-slate-400 text-center py-12">اختر مساراً أولاً</p>}
          </div>

          {/* Pages Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-violet-500" />
              نظرة سريعة
            </h2>
            {selectedLesson ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">يحتوي هذا الدرس على {pages.length} صفحات.</p>
                <button 
                  onClick={() => {
                    const lesson = lessons.find(l => l.id === selectedLesson);
                    if (lesson && selectedPath) setEditingLesson({ ...lesson, path_id: selectedPath });
                  }}
                  className="w-full bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 shadow-lg shadow-violet-100 flex items-center justify-center gap-2 transition-all"
                >
                  <Edit3 className="w-5 h-5" />
                  فتح محرر الدروس المتقدم
                </button>
                <div className="space-y-2 mt-6">
                  {pages.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs flex items-center gap-3">
                      <span className="font-bold text-slate-300">{i + 1}</span>
                      <span className="truncate flex-1">{p.type === 'explanation' ? p.title : p.question}</span>
                    </div>
                  ))}
                  {pages.length > 5 && <p className="text-center text-[10px] text-slate-400">+{pages.length - 5} صفحات أخرى</p>}
                </div>
              </div>
            ) : <p className="text-slate-400 text-center py-12">اختر درساً أولاً</p>}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-500" />
              إدارة المستخدمين
            </h2>
            
            {/* Filters UI */}
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="بحث بالاسم..." 
                  className="p-2 pr-8 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 w-40"
                  value={filterName}
                  onChange={e => setFilterName(e.target.value)}
                />
                <Users className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="بحث بالمدرسة..." 
                  className="p-2 pr-8 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 w-40"
                  value={filterSchool}
                  onChange={e => setFilterSchool(e.target.value)}
                />
                <Layout className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="بحث بالصف..." 
                  className="p-2 pr-8 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 w-40"
                  value={filterGrade}
                  onChange={e => setFilterGrade(e.target.value)}
                />
                <ListChecks className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
              </div>
              {(filterName || filterSchool || filterGrade) && (
                <button 
                  onClick={() => { setFilterName(''); setFilterSchool(''); setFilterGrade(''); }}
                  className="text-xs text-red-500 font-bold hover:underline"
                >
                  مسح الفلاتر
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-4 text-slate-500 font-bold text-sm">الاسم الرباعي</th>
                  <th className="py-3 px-4 text-slate-500 font-bold text-sm">البريد الإلكتروني</th>
                  <th className="py-3 px-4 text-slate-500 font-bold text-sm">كلمة المرور</th>
                  <th className="py-3 px-4 text-slate-500 font-bold text-sm">الدور</th>
                  <th className="py-3 px-4 text-slate-500 font-bold text-sm">المدرسة</th>
                  <th className="py-3 px-4 text-slate-500 font-bold text-sm">الصف</th>
                  <th className="py-3 px-4 text-slate-500 font-bold text-sm">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => {
                  const fullName = `${u.first_name || ''} ${u.father_name || ''} ${u.grandfather_name || ''} ${u.family_name || ''}`.toLowerCase();
                  const matchesName = fullName.includes(filterName.toLowerCase());
                  const matchesSchool = (u.school_name || '').toLowerCase().includes(filterSchool.toLowerCase());
                  const matchesGrade = (u.grade || '').toLowerCase().includes(filterGrade.toLowerCase());
                  return matchesName && matchesSchool && matchesGrade;
                }).map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium">
                      {u.first_name} {u.father_name} {u.grandfather_name} {u.family_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-sm break-all max-w-[200px]">{u.username}</td>
                    <td className="py-3 px-4 text-slate-500 text-sm font-mono">{u.password || '********'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-600' : u.role === 'teacher' ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {u.role === 'admin' ? 'مدير' : u.role === 'teacher' ? 'معلم' : 'طالب'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-sm">{u.school_name || '-'}</td>
                    <td className="py-3 px-4 text-slate-500 text-sm">{u.grade || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: u.id, type: 'user', title: u.username })}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          disabled={u.id === currentUser?.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-violet-500" />
              مستكشف قاعدة البيانات (Firestore)
            </h2>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">اختر المجموعة (Collection)</label>
                <select 
                  value={selectedCollection}
                  onChange={e => setSelectedCollection(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-bold"
                >
                  <option value="users">المستخدمين (users)</option>
                  <option value="paths">المسارات (paths)</option>
                  <option value="lessons_group">الدروس (lessons_group - Collection Group)</option>
                  <option value="notifications">الإشعارات (notifications)</option>
                  <option value="settings">الإعدادات (settings)</option>
                </select>
              </div>
              <button 
                onClick={handleRunQuery}
                disabled={isQuerying}
                className="self-end bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50 h-[50px]"
              >
                {isQuerying ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                استعراض البيانات
              </button>
            </div>
            <p className="text-xs text-slate-400">يتم عرض أول 50 مستنداً من المجموعة المختارة.</p>
          </div>

          {queryResult.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 overflow-x-auto">
              <h3 className="font-bold mb-4 text-slate-800">نتائج الاستعلام ({queryResult.length})</h3>
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {Array.from(new Set(queryResult.flatMap(row => Object.keys(row)))).map((key: string) => (
                      <th key={key} className="py-2 px-3 text-slate-500 font-bold">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.map((row, i) => {
                    const allKeys = Array.from(new Set(queryResult.flatMap(r => Object.keys(r))));
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        {allKeys.map((key: string, j) => (
                          <td key={j} className="py-2 px-3 text-slate-600 truncate max-w-[200px]">
                            {row[key] !== undefined ? (
                              typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])
                            ) : '-'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-violet-500" />
              إرسال إشعار جديد
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">نوع الإشعار</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                  value={newNotification.type}
                  onChange={e => setNewNotification({...newNotification, type: e.target.value as any})}
                >
                  <option value="general">عام (للجميع)</option>
                  <option value="personal">شخصي (لطالب محدد)</option>
                  <option value="category">حسب المرحلة الدراسية</option>
                </select>
              </div>

              {newNotification.type === 'personal' && (
                <div className="space-y-4 border-l-4 border-violet-200 pl-4 py-2 bg-violet-50/30 rounded-r-xl">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">1. اختر المدرسة</label>
                    <select 
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={notifFilterSchool}
                      onChange={e => {
                        setNotifFilterSchool(e.target.value);
                        setNewNotification({...newNotification, target_user_id: ''});
                      }}
                    >
                      <option value="">جميع المدارس...</option>
                      <option value="مدرسة الحافظ بن عساكر بأملج">مدرسة الحافظ بن عساكر بأملج</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">2. اختر المرحلة الدراسية</label>
                    <select 
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={notifFilterGrade}
                      onChange={e => {
                        setNotifFilterGrade(e.target.value);
                        setNewNotification({...newNotification, target_user_id: ''});
                      }}
                    >
                      <option value="">جميع المراحل...</option>
                      <option value="الأول الابتدائي">الأول الابتدائي</option>
                      <option value="الثاني الابتدائي">الثاني الابتدائي</option>
                      <option value="الثالث الابتدائي">الثالث الابتدائي</option>
                      <option value="الرابع الابتدائي">الرابع الابتدائي</option>
                      <option value="الخامس الابتدائي">الخامس الابتدائي</option>
                      <option value="السادس الابتدائي">السادس الابتدائي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">3. اختر الطالب</label>
                    <select 
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={newNotification.target_user_id}
                      onChange={e => setNewNotification({...newNotification, target_user_id: e.target.value})}
                    >
                      <option value="">اختر طالباً...</option>
                      {users
                        .filter(u => u.role === 'student')
                        .filter(u => !notifFilterSchool || u.school_name === notifFilterSchool)
                        .filter(u => !notifFilterGrade || u.grade === notifFilterGrade)
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.first_name} {u.family_name} ({u.username})</option>
                        ))}
                    </select>
                    {notifFilterSchool && notifFilterGrade && users.filter(u => u.role === 'student' && u.school_name === notifFilterSchool && u.grade === notifFilterGrade).length === 0 && (
                      <p className="text-[10px] text-red-500 mt-1 font-bold">لا يوجد طلاب في هذه المدرسة وهذا الصف</p>
                    )}
                  </div>
                </div>
              )}

              {newNotification.type === 'category' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">اختر المرحلة الدراسية</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={newNotification.target_category}
                    onChange={e => setNewNotification({...newNotification, target_category: e.target.value})}
                  >
                    <option value="">اختر المرحلة...</option>
                    <option value="الأول الابتدائي">الأول الابتدائي</option>
                    <option value="الثاني الابتدائي">الثاني الابتدائي</option>
                    <option value="الثالث الابتدائي">الثالث الابتدائي</option>
                    <option value="الرابع الابتدائي">الرابع الابتدائي</option>
                    <option value="الخامس الابتدائي">الخامس الابتدائي</option>
                    <option value="السادس الابتدائي">السادس الابتدائي</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">عنوان الإشعار</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="مثلاً: تنبيه بإضافة درس جديد"
                  value={newNotification.title}
                  onChange={e => setNewNotification({...newNotification, title: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">نص الرسالة</label>
                <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 min-h-[100px]"
                  placeholder="اكتب تفاصيل الإشعار هنا..."
                  value={newNotification.message}
                  onChange={e => setNewNotification({...newNotification, message: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ربط بمسار (اختياري)</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={newNotification.path_id}
                    onChange={e => setNewNotification({...newNotification, path_id: e.target.value})}
                  >
                    <option value="">لا يوجد</option>
                    {paths.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ربط بدرس (اختياري)</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={newNotification.lesson_id}
                    onChange={e => {
                      const lessonId = e.target.value;
                      const lesson = allLessons.find(l => l.id === lessonId);
                      setNewNotification({
                        ...newNotification, 
                        lesson_id: lessonId,
                        path_id: lesson?.path_id || newNotification.path_id
                      });
                    }}
                  >
                    <option value="">لا يوجد</option>
                    {allLessons.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleSendNotification}
                disabled={isSendingNotification}
                className="w-full bg-violet-600 text-white py-4 rounded-xl font-bold hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-100"
              >
                {isSendingNotification ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                إرسال الإشعار الآن
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-500" />
              الإشعارات المرسلة مؤخراً
            </h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {sentNotifications.map(notif => (
                <div key={notif.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                  <button 
                    onClick={() => handleDeleteNotification(notif.id)}
                    className="absolute top-4 left-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold ${
                      notif.type === 'general' ? 'bg-blue-100 text-blue-600' :
                      notif.type === 'personal' ? 'bg-amber-100 text-amber-600' :
                      'bg-violet-100 text-violet-600'
                    }`}>
                      {notif.type === 'general' ? 'عام' : notif.type === 'personal' ? 'شخصي' : 'فئة'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {notif.created_at?.toDate?.()?.toLocaleString('ar-SA') || 'جاري الإرسال...'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm mb-1">{notif.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                </div>
              ))}
              {sentNotifications.length === 0 && (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">لا توجد إشعارات مرسلة بعد</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">تأكيد الحذف</h2>
              <p className="text-slate-500 mb-6">
                هل أنت متأكد من حذف {deleteConfirm.type === 'path' ? 'مسار' : 'درس'} "{deleteConfirm.title}"؟ 
                <br />
                <span className="text-red-500 text-sm font-bold">هذا الإجراء لا يمكن التراجع عنه وسيتم حذف كافة البيانات المرتبطة.</span>
              </p>
              
              {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  نعم، احذف
                </button>
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {addingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setAddingUser(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8"
            >
              <h2 className="text-2xl font-bold text-slate-800 mb-6">إضافة مستخدم جديد</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الأول</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم الأب</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={newUser.father_name} onChange={e => setNewUser({...newUser, father_name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم الجد</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={newUser.grandfather_name} onChange={e => setNewUser({...newUser, grandfather_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم العائلة</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={newUser.family_name} onChange={e => setNewUser({...newUser, family_name: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">البريد الإلكتروني (اسم المستخدم)</label>
                  <input 
                    type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور</label>
                  <input 
                    type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">الدور</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                    >
                      <option value="student">طالب</option>
                      <option value="teacher">معلم</option>
                      <option value="admin">مدير</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">الصف (المرحلة الدراسية)</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={newUser.grade} onChange={e => setNewUser({...newUser, grade: e.target.value})}
                    >
                      <option value="">اختر الصف...</option>
                      <option value="الأول الابتدائي">الأول الابتدائي</option>
                      <option value="الثاني الابتدائي">الثاني الابتدائي</option>
                      <option value="الثالث الابتدائي">الثالث الابتدائي</option>
                      <option value="الرابع الابتدائي">الرابع الابتدائي</option>
                      <option value="الخامس الابتدائي">الخامس الابتدائي</option>
                      <option value="السادس الابتدائي">السادس الابتدائي</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">المدرسة</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={newUser.school_name} onChange={e => setNewUser({...newUser, school_name: e.target.value})}
                  >
                    <option value="مدرسة الحافظ بن عساكر بأملج">مدرسة الحافظ بن عساكر بأملج</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleAddUser}
                    className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                  >
                    إضافة المستخدم
                  </button>
                  <button 
                    onClick={() => setAddingUser(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setEditingUser(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8"
            >
              <h2 className="text-2xl font-bold text-slate-800 mb-6">تعديل بيانات المستخدم</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الأول</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={editingUser.first_name || ''} onChange={e => setEditingUser({...editingUser, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم الأب</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={editingUser.father_name || ''} onChange={e => setEditingUser({...editingUser, father_name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم الجد</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={editingUser.grandfather_name || ''} onChange={e => setEditingUser({...editingUser, grandfather_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم العائلة</label>
                    <input 
                      type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={editingUser.family_name || ''} onChange={e => setEditingUser({...editingUser, family_name: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الدور</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}
                  >
                    <option value="student">طالب</option>
                    <option value="teacher">معلم</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور</label>
                  <input 
                    type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                    placeholder="اتركها فارغة إذا كنت لا تريد تغييرها"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">المدرسة</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={editingUser.school_name || ''} onChange={e => setEditingUser({...editingUser, school_name: e.target.value})}
                  >
                    <option value="مدرسة الحافظ بن عساكر بأملج">مدرسة الحافظ بن عساكر بأملج</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الصف (المرحلة الدراسية)</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={editingUser.grade || ''} onChange={e => setEditingUser({...editingUser, grade: e.target.value})}
                  >
                    <option value="">اختر الصف...</option>
                    <option value="الأول الابتدائي">الأول الابتدائي</option>
                    <option value="الثاني الابتدائي">الثاني الابتدائي</option>
                    <option value="الثالث الابتدائي">الثالث الابتدائي</option>
                    <option value="الرابع الابتدائي">الرابع الابتدائي</option>
                    <option value="الخامس الابتدائي">الخامس الابتدائي</option>
                    <option value="السادس الابتدائي">السادس الابتدائي</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleUpdateUser}
                    className="flex-1 bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 transition-colors"
                  >
                    حفظ التغييرات
                  </button>
                  <button 
                    onClick={() => setEditingUser(null)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingPath && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setEditingPath(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8"
            >
              <h2 className="text-2xl font-bold text-slate-800 mb-6">تحرير المسار</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">عنوان المسار</label>
                  <input 
                    type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={editingPath.title} onChange={e => setEditingPath({...editingPath, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">وصف المسار</label>
                  <textarea 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 min-h-[100px]"
                    value={editingPath.description} onChange={e => setEditingPath({...editingPath, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الفئة</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    value={editingPath.category} onChange={e => setEditingPath({...editingPath, category: e.target.value})}
                  >
                    <option value="الرياضيات">الرياضيات</option>
                    <option value="العلوم">العلوم</option>
                    <option value="اللغة الانجليزية">اللغة الانجليزية</option>
                    <option value="المهارات الرقمية">المهارات الرقمية</option>
                    <option value="الدراسات الاجتماعية">الدراسات الاجتماعية</option>
                    <option value="مهارات الحياة">مهارات الحياة</option>
                    <option value="الفن والتصميم">الفن والتصميم</option>
                    <option value="اختبار نافس">اختبار نافس</option>
                    <option value="الموهوبين">الموهوبين</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">صورة المسار</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      value={editingPath.image_url || ''} onChange={e => setEditingPath({...editingPath, image_url: e.target.value})}
                    />
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 rounded-xl transition-colors flex items-center justify-center shrink-0 border border-slate-200">
                      <ImageIcon className="w-5 h-5 text-slate-600" />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePathImageUpload(e, true)} />
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleUpdatePath}
                    className="flex-1 bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 transition-colors"
                  >
                    حفظ التغييرات
                  </button>
                  <button 
                    onClick={() => setEditingPath(null)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Choose Existing Lesson Modal */}
      <AnimatePresence>
        {showExistingLessons && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowExistingLessons(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">اختيار درس موجود</h2>
                <button onClick={() => setShowExistingLessons(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allLessons.map(lesson => {
                    const path = paths.find(p => p.id === lesson.path_id);
                    return (
                      <div key={lesson.id} className="p-4 border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-800 mb-1">{lesson.title}</h3>
                            <div className="flex flex-col gap-0.5">
                              <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                <Compass className="w-3 h-3" />
                                {path?.title || 'مسار غير معروف'}
                              </p>
                              {path?.category && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 pr-4">
                                  <Tag className="w-3 h-3" />
                                  {path.category}
                                </p>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleCopyLesson(lesson.id)}
                            className="bg-blue-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600"
                            title="إضافة هذا الدرس"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {allLessons.length === 0 && (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400">لا توجد دروس متاحة حالياً</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen Lesson Editor Overlay */}
      {editingLesson && (
        <LessonEditor 
          lessonId={editingLesson.id} 
          pathId={editingLesson.path_id}
          onClose={() => setEditingLesson(null)} 
        />
      )}
    </div>
  );
};

export default AdminDashboard;
