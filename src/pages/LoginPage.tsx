import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type { UserData } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const trimmedEmail = email.trim();
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        // AuthContext already listens to onAuthStateChanged, but we can set it here for immediate feedback
        login({ id: userCredential.user.uid, ...userDoc.data() } as UserData);
        navigate('/');
      } else {
        setError('فشل في استرجاع بيانات المستخدم. قد يكون الحساب غير مكتمل.');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('يجب تفعيل خيار تسجيل الدخول بالبريد الإلكتروني في إعدادات Firebase');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من صحة البيانات (ملاحظة: تأكد من عدم وجود مسافات زائدة).\nإذا نسيت البريد الإلكتروني أو كلمة المرور، يرجى التواصل مع مسؤول النظام.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('تم حظر المحاولات بسبب كثرة الطلبات الفاشلة. يرجى المحاولة لاحقاً.');
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول: ' + (err.message || 'خطأ غير معروف'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-violet-600 p-4 rounded-2xl shadow-lg shadow-violet-200 mb-4">
            <GraduationCap className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center">مرحباً بك في مدرسة الحافظ بن عساكر بأملج</h1>
          <p className="text-slate-500 text-sm mt-2">سجل دخولك للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
            <input 
              type="email" 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              dir="ltr"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور</label>
            <input 
              type="password" 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold whitespace-pre-line">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-100"
          >
            تسجيل الدخول
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-slate-500 text-sm">
            ليس لديك حساب؟ 
            <Link to="/register" className="text-violet-600 font-bold hover:underline mr-1">إنشاء حساب جديد</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
