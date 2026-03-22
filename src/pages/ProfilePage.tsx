import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '../firebase';

const ProfilePage = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [fatherName, setFatherName] = useState(user?.father_name || '');
  const [grandfatherName, setGrandfatherName] = useState(user?.grandfather_name || '');
  const [familyName, setFamilyName] = useState(user?.family_name || '');
  const [schoolName, setSchoolName] = useState(user?.school_name || 'مدرسة الحافظ بن عساكر بأملج');
  const [grade, setGrade] = useState(user?.grade || 'الأول الابتدائي');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const grades = [
    'الأول الابتدائي',
    'الثاني الابتدائي',
    'الثالث الابتدائي',
    'الرابع الابتدائي',
    'الخامس الابتدائي',
    'السادس الابتدائي'
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setMessage(null);

    try {
      // Validate password if provided
      if (password) {
        if (password.length < 6) {
          setMessage({ type: 'error', text: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' });
          setIsSaving(false);
          return;
        }
      }

      // Update Firestore document
      const userDocRef = doc(db, 'users', user.id);
      const updateData: any = {
        first_name: firstName,
        father_name: fatherName,
        grandfather_name: grandfatherName,
        family_name: familyName,
        school_name: schoolName,
        grade
      };
      
      if (password) {
        updateData.password = password;
      }

      await updateDoc(userDocRef, updateData);

      // Update password if provided
      if (password && auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, password);
        } catch (authErr: any) {
          if (authErr.code === 'auth/requires-recent-login') {
            setMessage({ type: 'error', text: 'لتغيير كلمة المرور، يجب عليك تسجيل الخروج ثم الدخول مرة أخرى لإثبات هويتك.' });
            setIsSaving(false);
            return;
          }
          throw authErr;
        }
      }

      setMessage({ type: 'success', text: 'تم تحديث الملف الشخصي بنجاح' });
      setPassword('');
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setMessage({ type: 'error', text: err.message || 'فشل تحديث الملف الشخصي' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">الملف الشخصي</h1>
          <p className="text-slate-500">يمكنك تعديل بياناتك الشخصية وكلمة المرور من هنا.</p>
        </div>
        <div className={`px-4 py-2 rounded-2xl font-bold text-sm ${user?.role === 'admin' ? 'bg-red-100 text-red-700 border border-red-200' : user?.role === 'teacher' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
          حساب {user?.role === 'admin' ? 'مدير' : user?.role === 'teacher' ? 'معلم' : 'طالب'}
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">الاسم الأول</label>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور الجديدة (اتركها فارغة إذا لم ترد التغيير)</label>
            <input 
              type="password" 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-right"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit"
            disabled={isSaving}
            className="w-full bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-100 disabled:opacity-50"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
