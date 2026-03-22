import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Bell, ChevronRight, User, LogOut, Check, Trash2, ExternalLink
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Notification } from '../types';

const Topbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribes: (() => void)[] = [];

    // 1. General Notifications
    const qGeneral = query(
      collection(db, 'notifications'),
      where('type', '==', 'general'),
      orderBy('created_at', 'desc'),
      limit(10)
    );
    unsubscribes.push(onSnapshot(qGeneral, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(prev => {
        const other = prev.filter(n => n.type !== 'general');
        return [...other, ...notifs].sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications/general')));

    // 2. Personal Notifications
    const qPersonal = query(
      collection(db, 'notifications'),
      where('type', '==', 'personal'),
      where('target_user_id', '==', user.id),
      orderBy('created_at', 'desc'),
      limit(10)
    );
    unsubscribes.push(onSnapshot(qPersonal, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(prev => {
        const other = prev.filter(n => n.type !== 'personal');
        return [...other, ...notifs].sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, `notifications/personal/${user.id}`)));

    // 3. Grade-based Notifications (Category type)
    if (user.grade) {
      const qCategory = query(
        collection(db, 'notifications'),
        where('type', '==', 'category'),
        where('target_category', '==', user.grade),
        orderBy('created_at', 'desc'),
        limit(10)
      );
      unsubscribes.push(onSnapshot(qCategory, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        setNotifications(prev => {
          const other = prev.filter(n => n.type !== 'category');
          return [...other, ...notifs].sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        });
      }, (err) => handleFirestoreError(err, OperationType.LIST, `notifications/grade/${user.grade}`)));
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => {
    if (n.type === 'personal') return !n.read;
    return !n.read_by?.includes(user?.id || '');
  }).length;

  const handleMarkAsRead = async (notif: Notification) => {
    if (!user) return;
    try {
      const notifRef = doc(db, 'notifications', notif.id);
      if (notif.type === 'personal') {
        await updateDoc(notifRef, { read: true });
      } else {
        await updateDoc(notifRef, {
          read_by: arrayUnion(user.id)
        });
      }
    } catch (err) {
      console.error("Mark as read failed:", err);
    }
  };

  const handleNotifClick = (notif: Notification) => {
    handleMarkAsRead(notif);
    setIsNotifOpen(false);
    if (notif.lesson_id && notif.path_id) {
      navigate(`/path/${notif.path_id}/lesson/${notif.lesson_id}`);
    } else if (notif.path_id) {
      navigate(`/path/${notif.path_id}`);
    } else if (notif.lesson_id) {
      // Fallback for old notifications without path_id
      navigate(`/lesson/${notif.lesson_id}`);
    }
  };

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-3 md:px-8 sticky top-0 z-30 transition-colors duration-300">
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        <div className="relative w-full max-w-96 hidden sm:block">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="ابحث..." 
            className="w-full bg-slate-50 border-none rounded-full py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-violet-500 transition-all"
          />
        </div>
        <span className="text-[10px] xs:text-xs md:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 whitespace-nowrap">مدرسة الحافظ بن عساكر</span>
      </div>
      <div className="flex items-center gap-1 md:gap-4 shrink-0">
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-1.5 md:p-2 text-slate-400 hover:text-violet-500 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 overflow-hidden"
              >
                <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between">
                  <span className="font-bold text-slate-800">الإشعارات</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} جديدة
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map(notif => {
                      const isRead = notif.type === 'personal' ? notif.read : notif.read_by?.includes(user?.id || '');
                      return (
                        <div 
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer transition-colors hover:bg-slate-50 relative ${!isRead ? 'bg-violet-50/30' : ''}`}
                        >
                          {!isRead && (
                            <div className="absolute right-2 top-4 w-1.5 h-1.5 bg-violet-500 rounded-full" />
                          )}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">
                                {notif.created_at?.toDate?.()?.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                notif.type === 'general' ? 'bg-blue-100 text-blue-600' :
                                notif.type === 'personal' ? 'bg-amber-100 text-amber-600' :
                                'bg-violet-100 text-violet-600'
                              }`}>
                                {notif.type === 'general' ? 'عام' : notif.type === 'personal' ? 'شخصي' : 'فئة'}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">{notif.title}</h4>
                            <p className="text-[11px] text-slate-500 line-clamp-2">{notif.message}</p>
                            {(notif.path_id || notif.lesson_id) && (
                              <div className="mt-1 flex items-center gap-1 text-[9px] text-violet-600 font-bold">
                                <ExternalLink className="w-3 h-3" />
                                عرض المحتوى
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center">
                      <Bell className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">لا توجد إشعارات</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 bg-slate-50 px-2 md:px-3 py-1.5 rounded-full border border-slate-100 hover:bg-slate-100 transition-all"
          >
            <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-bold text-[10px] shrink-0">
              {user?.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col items-start ml-1">
              <span className={`text-[7px] px-1.5 py-0.5 rounded-md font-bold uppercase ${user?.role === 'admin' ? 'bg-red-100 text-red-700' : user?.role === 'teacher' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                {user?.role === 'admin' ? 'مدير' : user?.role === 'teacher' ? 'معلم' : 'طالب'}
              </span>
            </div>
            <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 overflow-hidden"
              >
                <Link 
                  to="/profile" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="font-bold">الملف الشخصي</span>
                </Link>
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-bold">تسجيل الخروج</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
