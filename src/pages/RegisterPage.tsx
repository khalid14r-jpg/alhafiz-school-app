import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, GraduationCap, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type { UserData } from '../context/AuthContext';

const RegisterPage = () => {
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [grandfatherName, setGrandfatherName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [schoolName, setSchoolName] = useState('مدرسة الحافظ بن عساكر بأملج');
  const [grade, setGrade] = useState('الأول الابتدائي');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const grades = [
    'الأول الابتدائي',
    'الثاني الابتدائي',
    'الثالث الابتدائي',
    'الرابع الابتدائي',
    'الخامس الابتدائي',
    'السادس الابتدائي'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
      return;
    }

    try {
      const trimmedEmail = email.trim();
      const username = trimmedEmail.split('@')[0];

      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      
        const userData = {
        uid: userCredential.user.uid,
        first_name: firstName,
        father_name: fatherName,
        grandfather_name: grandfatherName,
        family_name: familyName,
        school_name: schoolName,
        grade,
        role,
        username,
        email,
        password, // Store password in Firestore for admin management
        createdAt: serverTimestamp()
      };

      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userCredential.user.uid}`);
        // If we can't create the user document, we should probably delete the auth user
        // or at least not proceed with the local login.
        await userCredential.user.delete();
        setError('فشل في إنشاء ملف المستخدم. يرجى المحاولة مرة أخرى.');
        return;
      }
      
      login({ id: userCredential.user.uid, ...userData } as UserData);
      navigate('/');
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('هذا المستخدم موجود بالفعل');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('يجب تفعيل خيار التسجيل بالبريد الإلكتروني في إعدادات Firebase');
      } else {
        setError('حدث خطأ أثناء إنشاء الحساب: ' + err.message);
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
          <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl shadow-xl shadow-violet-200 flex items-center justify-center mb-6 transform -rotate-6">
            <GraduationCap className="text-white w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">إنشاء حساب جديد</h1>
          <p className="text-slate-500 text-sm mt-2">انضم إلينا وابدأ رحلة التعلم</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button 
              type="button"
              onClick={() => setRole('student')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'student' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
            >
              <GraduationCap className="w-6 h-6" />
              <span className="text-xs font-bold">طالب</span>
            </button>
            <button 
              type="button"
              onClick={() => setRole('teacher')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'teacher' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
            >
              <ShieldCheck className="w-6 h-6" />
              <span className="text-xs font-bold">معلم</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">الاسم</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">اسم الأب</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
                value={fatherName}
                onChange={e => setFatherName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">اسم الجد</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
                value={grandfatherName}
                onChange={e => setGrandfatherName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">العائلة</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">اسم المدرسة</label>
              <select 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                required
              >
                <option value="مدرسة الحافظ بن عساكر بأملج">مدرسة الحافظ بن عساكر بأملج</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">المرحلة الدراسية</label>
              <select 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
                value={grade}
                onChange={e => setGrade(e.target.value)}
                required
              >
                {grades.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

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
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-100"
          >
            إنشاء الحساب
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-slate-500 text-sm">
            لديك حساب بالفعل؟ 
            <Link to="/login" className="text-violet-600 font-bold hover:underline mr-1">تسجيل الدخول</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
