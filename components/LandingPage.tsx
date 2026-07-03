
import React, { useState, useRef } from 'react';
import { Building2, ArrowRight, User, ShieldCheck, Mail, Lock, UserPlus, Phone, Map, Layout, Calendar, CheckCircle2, Play, MousePointer2, Sparkles, ArrowDown, Globe, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { useAuth } from './AuthProvider';
import PhoneNumberInput from './PhoneNumberInput';
import { useRemoteConfig } from './RemoteConfigProvider';

interface LandingPageProps {
  onCodeLogin: (code: string) => boolean | Promise<boolean>;
  onShowPrivacy: () => void;
  onShowTerms: () => void;
  onShowSupport: () => void;
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
  </svg>
);

interface StepCardProps {
  step: string;
  title: string;
  description: string;
  icon: any;
  videoUrl: string;
  index: number;
}

const StepCard: React.FC<StepCardProps> = ({ step, title, description, icon: Icon, videoUrl, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, delay: index * 0.2 }}
      className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 items-center py-20 border-b border-slate-100 last:border-0`}
    >
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Icon size={24} />
          </div>
          <span className="text-sm font-black text-blue-600 uppercase tracking-[0.3em]">{step}</span>
        </div>
        <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">{title}</h3>
        <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-xl">{description}</p>
        
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 w-fit">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
            <MousePointer2 size={16} />
          </div>
          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Interactive Experience</span>
        </div>
      </div>

      <div className="flex-1 w-full">
        <div className="relative group">
          {/* Video Mockup Frame */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/20 to-emerald-600/20 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-slate-900 aspect-video">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
            
            {/* Overlay UI Mockup */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                    <Play size={16} fill="white" />
                  </div>
                  <div className="h-1 w-32 bg-white/30 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={isInView ? { width: '100%' } : { width: 0 }}
                      transition={{ duration: 5, repeat: Infinity }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                </div>
                <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 text-[10px] font-black text-white uppercase tracking-widest">
                  Live Preview
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onCodeLogin, onShowPrivacy, onShowTerms, onShowSupport }) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInWithOwnerPasscode, authError, clearAuthError } = useAuth();
  const { featurePhoneAuthEnabled } = useRemoteConfig();
  const [activeTab, setActiveTab] = useState<'customer' | 'employee'>('customer');
  const [isSignUp, setIsSignUp] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [ownerCode, setOwnerCode] = useState('');
  const [ownerCodeError, setOwnerCodeError] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const success = await signInWithOwnerPasscode(ownerCode);
      if (success) {
        setIsOwnerModalOpen(false);
        setOwnerCode('');
      } else {
        setOwnerCodeError(true);
        setTimeout(() => setOwnerCodeError(false), 2000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGlobalAccessClick = () => {
    clearAuthError();
    setOwnerCode('');
    setOwnerCodeError(false);
    setIsOwnerModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();

    if (activeTab === 'employee') {
      setIsSubmitting(true);
      try {
        const success = await onCodeLogin(accessCode);
        if (!success) {
          setCodeError(true);
          setTimeout(() => setCodeError(false), 2000);
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, { name: fullName, phone });
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
      // authError set in provider
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearAuthError();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // authError set in provider
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    {
      step: "Step 01",
      title: "Discover Your Next Hub",
      description: "Browse our global network of premium workspaces. From the heart of San Francisco to the financial districts of London, find the perfect location that matches your ambition.",
      icon: Map,
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-working-at-a-desk-in-a-modern-office-4434-large.mp4"
    },
    {
      step: "Step 02",
      title: "Select Your Ideal Space",
      description: "Use our interactive blueprint to pick the exact room or lounge area you need. Whether it's a high-tech meeting suite or a quiet focus pod, you're in control of your environment.",
      icon: Layout,
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-woman-working-on-a-laptop-in-a-modern-office-4435-large.mp4"
    },
    {
      step: "Step 03",
      title: "Book in Seconds",
      description: "Our real-time availability engine ensures seamless scheduling. Pick your time slot, confirm your reservation, and get instant access to our world-class amenities.",
      icon: Calendar,
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-man-working-on-a-laptop-in-a-modern-office-4436-large.mp4"
    },
    {
      step: "Step 04",
      title: "Arrive & Thrive",
      description: "Show up and start being productive immediately. Your space is ready, the coffee is hot, and the community is waiting. Work has never felt this effortless.",
      icon: CheckCircle2,
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-people-working-together-in-a-modern-office-4440-large.mp4"
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-y-auto scroll-smooth">
      {/* Hero Section */}
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-[120px]" />
        
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          
          {/* Left Side: Branding & Value Prop */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-4 rounded-[2rem] text-white shadow-2xl shadow-blue-200 ring-8 ring-blue-50">
                <Building2 size={40} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">NovaSpace</h1>
                <p className="text-sm font-black text-blue-600 uppercase tracking-[0.3em] mt-2">Coworking Ecosystem</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-7xl font-black text-slate-900 leading-[1] tracking-tight">
                Work from the <span className="text-blue-600 italic">Future.</span>
              </h2>
              <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-md">
                Access modern workspaces, meeting rooms, and collaborative lounges in the world's most iconic locations.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <img key={i} src={`https://picsum.photos/100/100?random=${i}`} className="w-12 h-12 rounded-full border-4 border-white shadow-sm" alt="User" />
                ))}
              </div>
              <div className="text-sm font-bold text-slate-400">
                <p className="text-slate-900 font-black">2,400+ Active Members</p>
                <p>Across 12 Global Cities</p>
              </div>
            </div>

            <motion.button 
              onClick={() => {
                document.getElementById('journey-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mt-12 group flex items-center gap-4 text-blue-600 font-black text-sm uppercase tracking-[0.2em] hover:text-blue-700 transition-colors bg-blue-50/50 hover:bg-blue-50 px-6 py-4 rounded-full border border-blue-100 w-fit cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <ArrowDown size={16} strokeWidth={3} />
              </div>
              Scroll to explore the journey
            </motion.button>
          </motion.div>

          {/* Right Side: Authentication Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col gap-6 w-full max-w-md mx-auto lg:mx-0"
          >
            {/* Role Switcher */}
            <div className="flex p-2 bg-white rounded-full border border-slate-200 shadow-sm">
              <button 
                onClick={() => { setActiveTab('customer'); setIsSignUp(false); }}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-full font-black text-sm transition-all ${
                  activeTab === 'customer' 
                    ? 'bg-blue-50 text-blue-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User size={18} />
                CUSTOMER
              </button>
              <button 
                onClick={() => { setActiveTab('employee'); setIsSignUp(false); }}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-full font-black text-sm transition-all ${
                  activeTab === 'employee' 
                    ? 'bg-emerald-50 text-emerald-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck size={18} />
                EMPLOYEE
              </button>
            </div>

            <div className="bg-white rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden flex flex-col min-h-[560px]">
              <div className="p-10 lg:p-14 flex-1 flex flex-col overflow-y-auto">
              <div className="mb-8">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  {activeTab === 'employee' ? 'Internal Portal' : (isSignUp ? 'Create Account' : 'Welcome Back')}
                </h3>
                <p className="text-slate-400 font-bold mt-2">
                  {activeTab === 'employee' 
                    ? 'Access staff tools and property management' 
                    : (isSignUp ? 'Join the NovaSpace network' : 'Login to manage your bookings')}
                </p>
              </div>

              {authError && (
                <div className="mb-6 flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-bold leading-snug">{authError}</p>
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                {activeTab === 'employee' ? (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Access Code</label>
                      <div className="relative group">
                        <ShieldCheck className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${codeError ? 'text-rose-500' : 'text-slate-300 group-focus-within:text-emerald-500'}`} size={20} />
                        <input 
                          type="text" 
                          placeholder="NS-SF-88"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                          className={`w-full pl-14 pr-6 py-4.5 bg-slate-50 border rounded-2xl outline-none focus:bg-white focus:ring-4 transition-all font-bold tracking-widest ${
                            codeError 
                              ? 'border-rose-400 focus:border-rose-400 ring-rose-50 text-rose-600' 
                              : 'border-slate-100 focus:border-emerald-400 ring-emerald-50 text-slate-900 shadow-sm'
                          }`}
                        />
                      </div>
                      {codeError && (
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Invalid branch access code</p>
                      )}
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-5 rounded-2xl font-black text-lg text-white bg-emerald-600 shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <Loader2 size={22} className="animate-spin" /> : <>Enter Branch Dashboard <ArrowRight size={22} /></>}
                    </button>

                    <button 
                      type="button"
                      onClick={handleGlobalAccessClick}
                      className="w-full py-4 rounded-2xl font-black text-sm text-emerald-600 bg-white border-2 border-emerald-100 hover:bg-emerald-50 transition-all active:scale-[0.98] mt-3 flex items-center justify-center gap-3 shadow-sm"
                    >
                      Global Access
                      <Globe size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    {isSignUp && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative group">
                          <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                          <input 
                            type="text" 
                            placeholder="Alex Rivera"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required={isSignUp}
                            className="w-full pl-14 pr-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all font-bold text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input 
                          type="email" 
                          placeholder="alex@novaspace.ai"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          className="w-full pl-14 pr-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    {isSignUp && featurePhoneAuthEnabled && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                        <PhoneNumberInput
                          value={phone}
                          onChange={({ fullDigits }) => setPhone(fullDigits)}
                          compact
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                        {!isSignUp && (
                          <button type="button" className="text-[10px] font-black text-blue-600 hover:text-blue-700">FORGOT?</button>
                        )}
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input 
                          type="password" 
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          autoComplete={isSignUp ? 'new-password' : 'current-password'}
                          className="w-full pl-14 pr-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-5 rounded-2xl font-black text-lg text-white bg-blue-600 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <Loader2 size={22} className="animate-spin" />
                      ) : (
                        <>
                          {isSignUp ? 'Create My Account' : 'Sign In'}
                          <ArrowRight size={22} />
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>

              {/* Social Login Section - Only for Customers */}
              {activeTab === 'customer' && (
                <div className="mt-8 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-[1px] flex-1 bg-slate-100" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">OR</span>
                    <div className="h-[1px] flex-1 bg-slate-100" />
                  </div>

                  <button 
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                    className="w-full py-5 px-6 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm flex items-center justify-center gap-4 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </button>
                </div>
              )}

              <div className="mt-auto pt-10 border-t border-slate-50 flex flex-col items-center gap-4">
                {activeTab === 'customer' ? (
                  <p className="text-sm font-bold text-slate-400">
                    {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}
                    <button 
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="ml-2 text-blue-600 font-black hover:underline underline-offset-4 flex items-center gap-1 inline-flex"
                    >
                      {isSignUp ? 'Login instead' : 'Join NovaSpace'}
                      {!isSignUp && <UserPlus size={14} />}
                    </button>
                  </p>
                ) : (
                  <p className="text-sm font-bold text-slate-400">
                    Staff issues? Contact <span className="text-slate-900 font-black">IT Support</span>
                  </p>
                )}
              </div>
            </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Customer Journey Section */}
      <div id="journey-section" className="bg-white py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-24">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100 text-blue-600 text-xs font-black uppercase tracking-[0.3em]">
              <Sparkles size={14} />
              The Customer Experience
            </div>
            <h2 className="text-6xl font-black text-slate-900 tracking-tight">How NovaSpace Works</h2>
            <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">
              We've redesigned the coworking experience from the ground up. Here's how you can start working from the future today.
            </p>
          </div>

          <div className="space-y-0">
            {steps.map((step, index) => (
              <StepCard 
                key={index}
                index={index}
                step={step.step}
                title={step.title}
                description={step.description}
                icon={step.icon}
                videoUrl={step.videoUrl}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="bg-slate-900 py-32 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none blueprint-grid" />
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-10">
          <h2 className="text-6xl font-black text-white tracking-tight leading-tight">
            Ready to elevate your <br /> <span className="text-blue-500">workday?</span>
          </h2>
          <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto">
            Join thousands of professionals who have already made the switch to a more dynamic, flexible, and inspiring way of working.
          </p>
          <button 
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setActiveTab('customer');
              setIsSignUp(true);
            }}
            className="px-12 py-6 bg-blue-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-900/50 hover:bg-blue-700 transition-all active:scale-95 inline-flex items-center gap-4"
          >
            Join the Network Now
            <ArrowRight size={24} />
          </button>
        </div>
      </div>
      
      <footer className="bg-slate-950 py-12 px-10 flex flex-col lg:flex-row justify-between items-center gap-8 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white">
            <Building2 size={20} />
          </div>
          <span className="text-lg font-black text-white tracking-tighter">NovaSpace</span>
        </div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
          © 2025 NOVASPACE WORLDWIDE • DESIGNED FOR MODERN PROFESSIONALS
        </div>
        <div className="flex gap-8">
          <button onClick={onShowPrivacy} className="text-[10px] font-black text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Privacy</button>
          <button onClick={onShowTerms} className="text-[10px] font-black text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Terms</button>
          <button onClick={onShowSupport} className="text-[10px] font-black text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Support</button>
        </div>
      </footer>

      {/* Owner Global Access Modal */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsOwnerModalOpen(false)}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl p-10 overflow-hidden"
          >
            <button 
              onClick={() => setIsOwnerModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            >
              <X size={20} />
            </button>

            <div className="text-center space-y-4 mb-8">
              <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mx-auto">
                <Globe size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Global Access</h3>
                <p className="text-sm font-bold text-slate-400 mt-1">Enter master authorization code</p>
              </div>
            </div>

            <form onSubmit={handleOwnerSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="relative group">
                  <ShieldCheck className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${ownerCodeError ? 'text-rose-500' : 'text-slate-300 group-focus-within:text-emerald-500'}`} size={20} />
                  <input 
                    type="password" 
                    placeholder="Enter Master Code"
                    value={ownerCode}
                    onChange={(e) => setOwnerCode(e.target.value)}
                    autoFocus
                    className={`w-full pl-14 pr-6 py-4.5 bg-slate-50 border rounded-2xl outline-none focus:bg-white focus:ring-4 transition-all font-bold tracking-widest ${
                      ownerCodeError 
                        ? 'border-rose-400 focus:border-rose-400 ring-rose-50 text-rose-600' 
                        : 'border-slate-100 focus:border-emerald-400 ring-emerald-50 text-slate-900 shadow-sm'
                    }`}
                  />
                </div>
                {ownerCodeError && (
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">
                    Invalid passcode — check your master authorization code
                  </p>
                )}
              </div>

              <button 
                type="submit"
                disabled={isSubmitting || !ownerCode.trim()}
                className="w-full py-5 rounded-2xl font-black text-lg text-white bg-slate-900 shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={22} className="animate-spin" /> : <>Authenticate <ArrowRight size={22} /></>}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
