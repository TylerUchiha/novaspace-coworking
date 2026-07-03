
import React, { useState, useRef, useEffect } from 'react';
import { Reservation, UserProfile } from '../types';
import { User, Mail, Sparkles, Camera, Check, Lock, CreditCard, Plus, Trash2, LogOut, X, Edit2, Briefcase, ShieldCheck } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import PhoneVerificationForm from './PhoneVerificationForm';
import PhoneNumberInput from './PhoneNumberInput';
import EmailVerificationModal from './EmailVerificationModal';
import { useAuth } from './AuthProvider';
import { normalizePhoneDigits } from '../services/phoneVerification';

interface ProfilePageProps {
  user: UserProfile;
  reservations: Reservation[];
  onLogout: () => void;
  onUpdateProfile: (newProfile: UserProfile) => void;
  onClose?: () => void;
}

function VerificationStatusBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
        <ShieldCheck size={12} /> Verified
      </span>
    );
  }
  return (
    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
      Unverified
    </span>
  );
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, reservations, onLogout, onUpdateProfile, onClose }) => {
  const { user: firebaseUser } = useAuth();
  const [formData, setFormData] = useState<UserProfile>(user);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [showPhoneVerifyModal, setShowPhoneVerifyModal] = useState(false);
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [phoneSaveError, setPhoneSaveError] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paymentMethods, setPaymentMethods] = useState(user.paymentMethods || []);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ number: '', expiry: '', cvc: '', name: '' });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentName, setEditingPaymentName] = useState('');

  useEffect(() => {
    setFormData(user);
    setPaymentMethods(user.paymentMethods || []);
    setShowPhoneVerify(false);
    setPhoneSaveError(null);
  }, [user]);

  const savedPhoneDigits = normalizePhoneDigits(user.phone);
  const formPhoneDigits = normalizePhoneDigits(formData.phone);
  const authPhoneDigits = normalizePhoneDigits(firebaseUser?.phoneNumber ?? undefined);
  const phoneChanged = formPhoneDigits !== savedPhoneDigits;
  const phoneVerifiedWithAuth = !!formPhoneDigits && formPhoneDigits === authPhoneDigits;
  const needsPhoneVerify = phoneChanged && !phoneVerifiedWithAuth;
  const phoneUnverified = !phoneVerifiedWithAuth;
  const emailVerified = formData.emailVerified === true;

  const handleEmailVerified = async () => {
    await firebaseUser?.reload();
    setFormData((prev) => ({ ...prev, emailVerified: true }));
    setShowEmailVerifyModal(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handlePhoneVerified = async (_verifiedE164: string, phoneDigits: string) => {
    const updated = { ...formData, phone: phoneDigits, phoneVerified: true };
    setFormData(updated);
    setShowPhoneVerify(false);
    setShowPhoneVerifyModal(false);
    setPhoneSaveError(null);
    onUpdateProfile(updated);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, pfp: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (needsPhoneVerify) {
      setPhoneSaveError('Verify your new phone number via SMS before saving.');
      setShowPhoneVerify(true);
      return;
    }

    setPhoneSaveError(null);
    setIsSaving(true);
    setTimeout(() => {
      onUpdateProfile({
        ...formData,
        paymentMethods,
        phoneVerified: phoneVerifiedWithAuth || formData.phoneVerified,
      });
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 800);
  };

  const handleUpdatePassword = () => {
    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setPasswordSuccess(true);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    }, 800);
  };

  const handleDeletePaymentMethod = (id: string) => {
    const updated = paymentMethods.filter(pm => pm.id !== id);
    setPaymentMethods(updated);
    onUpdateProfile({ ...formData, paymentMethods: updated });
  };

  const handleSetDefaultPaymentMethod = (id: string) => {
    const updated = paymentMethods.map(pm => ({ ...pm, isDefault: pm.id === id }));
    setPaymentMethods(updated);
    onUpdateProfile({ ...formData, paymentMethods: updated });
  };

  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.number || !newPayment.expiry) return;

    const type = newPayment.number.startsWith('4') ? 'Visa' : 'Mastercard';
    const last4 = newPayment.number.slice(-4).padStart(4, '0');

    const newMethod = {
      id: Date.now().toString(),
      type,
      last4,
      expiry: newPayment.expiry,
      isDefault: paymentMethods.length === 0,
      name: newPayment.name
    };

    const updated = [...paymentMethods, newMethod];
    setPaymentMethods(updated);
    onUpdateProfile({ ...formData, paymentMethods: updated });
    setIsAddingPayment(false);
    setNewPayment({ number: '', expiry: '', cvc: '', name: '' });
  };

  const handleSavePaymentName = (id: string) => {
    const updated = paymentMethods.map(pm => pm.id === id ? { ...pm, name: editingPaymentName } : pm);
    setPaymentMethods(updated);
    onUpdateProfile({ ...formData, paymentMethods: updated });
    setEditingPaymentId(null);
  };

  return (
    <div className="flex-1 flex flex-col p-10 overflow-auto bg-slate-50/50">
      <div className="max-w-3xl mx-auto w-full space-y-8 pb-20">
        {/* Profile Section */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm relative">
          <div className="absolute top-8 right-8 flex items-center gap-2">
            <button 
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors group flex items-center gap-2"
              title="Sign Out"
            >
              <span className="text-xs font-black uppercase tracking-widest hidden sm:block group-hover:text-rose-500">Sign Out</span>
              <LogOut size={20} />
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-8 mb-10">
            <div className="relative group shrink-0">
              <UserAvatar 
                pfp={formData.pfp} 
                name={formData.name} 
                profession={formData.profession} 
                size="2xl" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30"
              >
                <Camera className="text-white" size={24} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
            </div>
            <div className="pt-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{formData.name}</h2>
              <p className="text-slate-500 font-medium mt-1">{formData.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                  {formData.role}
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={12} /> {formData.credits.toLocaleString()} EGP
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                <VerificationStatusBadge verified={emailVerified} />
              </div>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full pl-12 pr-4 py-3 border rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm ${
                    emailVerified
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-red-50/40 border-red-200'
                  }`}
                />
              </div>
              {!emailVerified && (
                <button
                  type="button"
                  onClick={() => setShowEmailVerifyModal(true)}
                  className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors"
                >
                  Verify Email Address
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                <VerificationStatusBadge verified={phoneVerifiedWithAuth} />
              </div>
              <div className={phoneUnverified ? '[&>div>div]:border-red-200 [&>div>div]:bg-red-50/40' : ''}>
                <PhoneNumberInput
                  value={formData.phone || ''}
                  onChange={({ fullDigits }) => {
                    if (fullDigits.length <= 15) {
                      setFormData(prev => ({ ...prev, phone: fullDigits, phoneVerified: false }));
                      setPhoneSaveError(null);
                      if (fullDigits !== savedPhoneDigits) {
                        setShowPhoneVerify(true);
                      } else {
                        setShowPhoneVerify(false);
                      }
                    }
                  }}
                  compact
                  showHint={false}
                />
              </div>
              {phoneSaveError && (
                <p className="text-xs font-bold text-red-600 ml-1">{phoneSaveError}</p>
              )}
              {phoneUnverified && !needsPhoneVerify && !showPhoneVerifyModal && (
                <button
                  type="button"
                  onClick={() => setShowPhoneVerifyModal(true)}
                  className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors"
                >
                  Verify Phone Number
                </button>
              )}
              {showPhoneVerify && needsPhoneVerify && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                  <p className="text-xs font-bold text-blue-800 mb-4">
                    Verify your new number with a text message to save this change.
                  </p>
                  <PhoneVerificationForm
                    initialPhone={formData.phone || ''}
                    submitLabel="Verify & Save Phone"
                    onVerified={handlePhoneVerified}
                    onCancel={() => setShowPhoneVerify(false)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profession</label>
              <div className="relative group">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <select 
                  value={['Doctor', 'Teacher', 'Engineer', 'Developer', 'Designer', 'Chef', ''].includes(formData.profession || '') ? (formData.profession || '') : 'Custom'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Custom') {
                      setFormData(prev => ({ ...prev, profession: 'Custom' }));
                    } else {
                      setFormData(prev => ({ ...prev, profession: val }));
                    }
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm appearance-none cursor-pointer"
                >
                  <option value="">None / Unspecified</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Engineer">Engineer</option>
                  <option value="Developer">Developer</option>
                  <option value="Designer">Designer</option>
                  <option value="Chef">Chef</option>
                  <option value="Custom">Custom...</option>
                </select>
              </div>
            </div>

            {(!['Doctor', 'Teacher', 'Engineer', 'Developer', 'Designer', 'Chef', ''].includes(formData.profession || '') || formData.profession === 'Custom') && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custom Profession Name</label>
                <div className="relative group">
                  <Edit2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="e.g., Lawyer, Dentist, Consultant"
                    value={formData.profession === 'Custom' ? '' : formData.profession || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end items-center gap-4 pt-6 border-t border-slate-100">
            {showSuccess && (
              <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-right-4">
                <Check size={16} /> Saved
              </div>
            )}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center gap-2"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

        {/* Payment Methods Section */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CreditCard className="text-blue-500" size={24} />
              Payment Methods
            </h3>
            <button 
              onClick={() => setIsAddingPayment(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-colors"
            >
              <Plus size={14} /> Add New
            </button>
          </div>

          <div className="space-y-4">
            {paymentMethods.map(method => (
              <div key={method.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${method.isDefault ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-slate-100 rounded flex items-center justify-center text-xs font-black text-slate-500">
                    {method.type}
                  </div>
                  <div>
                    {editingPaymentId === method.id ? (
                      <div className="flex items-center gap-2 mb-1">
                        <input 
                          type="text" 
                          value={editingPaymentName}
                          onChange={e => setEditingPaymentName(e.target.value)}
                          placeholder="e.g. Personal Card"
                          className="px-2 py-1 text-sm font-bold text-slate-900 border border-slate-200 rounded outline-none focus:border-blue-400"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSavePaymentName(method.id);
                            if (e.key === 'Escape') setEditingPaymentId(null);
                          }}
                        />
                        <button 
                          onClick={() => handleSavePaymentName(method.id)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-sm">
                          {method.name ? `•••• ${method.last4} (${method.name})` : `•••• •••• •••• ${method.last4}`}
                        </p>
                        <button 
                          onClick={() => {
                            setEditingPaymentId(method.id);
                            setEditingPaymentName(method.name || '');
                          }}
                          className="text-slate-400 hover:text-blue-500 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 font-medium">
                      {method.name ? `•••• •••• •••• ${method.last4} • ` : ''}Expires {method.expiry}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {method.isDefault ? (
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-1 rounded-md">Default</span>
                  ) : (
                    <button 
                      onClick={() => handleSetDefaultPaymentMethod(method.id)}
                      className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeletePaymentMethod(method.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {paymentMethods.length === 0 && !isAddingPayment && (
              <div className="text-center py-8 text-slate-400 font-medium text-sm">
                No payment methods saved.
              </div>
            )}

            {isAddingPayment && (
              <form onSubmit={handleAddPaymentSubmit} className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-top-4">
                <h4 className="text-sm font-black text-slate-900 mb-4">Add New Card</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Card Name (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Personal Card"
                      value={newPayment.name}
                      onChange={e => setNewPayment(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Card Number</label>
                    <input 
                      type="text" 
                      required
                      placeholder="0000 0000 0000 0000"
                      value={newPayment.number}
                      onChange={e => setNewPayment(prev => ({ ...prev, number: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry Date</label>
                    <input 
                      type="text" 
                      required
                      placeholder="MM/YY"
                      value={newPayment.expiry}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length >= 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2, 4);
                        }
                        setNewPayment(prev => ({ ...prev, expiry: val }));
                      }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CVC</label>
                    <input 
                      type="text" 
                      required
                      placeholder="123"
                      value={newPayment.cvc}
                      onChange={e => setNewPayment(prev => ({ ...prev, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsAddingPayment(false)}
                    className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={newPayment.number.length < 15 || newPayment.expiry.length < 5 || newPayment.cvc.length < 3}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Card
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8 flex items-center gap-3">
            <Lock className="text-slate-400" size={24} />
            Security
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-500 transition-colors" size={18} />
                <input 
                  type="password" 
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 transition-all font-bold text-slate-900 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-500 transition-colors" size={18} />
                <input 
                  type="password" 
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 transition-all font-bold text-slate-900 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-500 transition-colors" size={18} />
                <input 
                  type="password" 
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 transition-all font-bold text-slate-900 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end items-center gap-4 pt-6 border-t border-slate-100">
            {passwordSuccess && (
              <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-right-4">
                <Check size={16} /> Updated
              </div>
            )}
            <button 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
              className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

      </div>

      {showEmailVerifyModal && (
        <EmailVerificationModal
          user={formData}
          email={firebaseUser?.email}
          onVerified={handleEmailVerified}
          onDismiss={() => setShowEmailVerifyModal(false)}
        />
      )}

      {showPhoneVerifyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-[2rem] border border-slate-200 shadow-2xl p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <UserAvatar pfp={formData.pfp} name={formData.name} size="lg" className="mb-4 ring-4 ring-blue-100" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                Verify your phone
              </h2>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                Confirm your phone number with a text message to secure your account.
              </p>
            </div>
            <PhoneVerificationForm
              initialPhone={formData.phone || ''}
              submitLabel="Verify Phone"
              onVerified={handlePhoneVerified}
              onCancel={() => setShowPhoneVerifyModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
