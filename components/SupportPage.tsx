
import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, LifeBuoy, Mail, MessageSquare, Send, X, Bot, User as UserIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { detectLanguageDialectResponse } from '../services/geminiService';
import { submitSupportInquiryRemote, supportChatRemote } from '../services/cloudFunctions';
import { SUPPORT_EMAIL } from '../constants/contact';

interface SupportPageProps {
  onBack: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const SupportPage: React.FC<SupportPageProps> = ({ onBack }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailFormData, setEmailFormData] = useState({
    name: '',
    number: '',
    email: '',
    inquiry: ''
  });
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your NovaSpace AI assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const [emailFormError, setEmailFormError] = useState<string | null>(null);

  const mapSupportInquiryError = (error: unknown): string => {
    if (error instanceof FirebaseError) {
      if (error.code === 'functions/invalid-argument' || error.code === 'functions/failed-precondition') {
        return error.message || 'Please check your form and try again.';
      }
      return error.message || 'Could not send your message. Please email us directly.';
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Could not send your message. Please email us directly.';
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailFormData.number.length !== 11) {
      setEmailFormError('Please enter exactly 11 digits.');
      return;
    }
    if (emailFormData.inquiry.trim().length < 10) {
      setEmailFormError('Please describe your inquiry in at least 10 characters.');
      return;
    }
    setEmailFormError(null);
    setIsEmailSending(true);
    try {
      await submitSupportInquiryRemote({
        name: emailFormData.name,
        number: emailFormData.number,
        email: emailFormData.email,
        inquiry: emailFormData.inquiry,
      });
      setEmailSent(true);
      setTimeout(() => {
        setIsEmailModalOpen(false);
        setEmailSent(false);
        setEmailFormData({ name: '', number: '', email: '', inquiry: '' });
      }, 2000);
    } catch (error) {
      console.error('Support inquiry error:', error);
      setEmailFormError(mapSupportInquiryError(error));
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    if (detectLanguageDialectResponse(userMessage)) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setMessages(prev => [...prev, { role: 'model', text: userMessage }]);
      setIsLoading(false);
      return;
    }

    try {
      const { reply } = await supportChatRemote(userMessage);
      const aiText = reply || "I'm sorry, I couldn't process that request.";
      
      // Artificial delay for "typing" effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessages(prev => [...prev, { role: 'model', text: `Sorry, I'm having trouble connecting right now. Please try again later or email ${SUPPORT_EMAIL}.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 lg:p-16 overflow-y-auto font-['Inter'] relative">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 hover:text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mb-12 transition-colors group text-slate-400"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-rose-600 p-2 rounded-xl text-white">
              <LifeBuoy size={24} />
            </div>
            <h1 className="text-sm font-black text-rose-600 uppercase tracking-[0.3em]">Support</h1>
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            Help & <span className="text-rose-600 italic">Support</span>
          </h2>
          <p className="text-lg text-slate-500 font-medium mt-4">
            We're here to help you get the most out of NovaSpace.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col items-center text-center group hover:border-blue-200 transition-all">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Mail size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Email Support</h3>
            <p className="text-slate-500 font-medium mb-4">Get in touch with our team via email for any inquiries.</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-blue-600 font-black text-sm tracking-wide hover:underline mb-6"
            >
              {SUPPORT_EMAIL}
            </a>
            <button 
              onClick={() => setIsEmailModalOpen(true)}
              className="mt-auto text-blue-600 font-black uppercase text-xs tracking-widest hover:underline"
            >
              Open Form
            </button>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col items-center text-center group hover:border-emerald-200 transition-all">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MessageSquare size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">AI Live Chat</h3>
            <p className="text-slate-500 font-medium mb-6">Chat with our AI assistant in real-time for instant help.</p>
            <button 
              onClick={() => setIsChatOpen(true)}
              className="mt-auto text-emerald-600 font-black uppercase text-xs tracking-widest hover:underline"
            >
              Start Chat
            </button>
          </div>
        </div>

        <section className="mt-16">
          <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Frequently Asked Questions</h3>
          <div className="space-y-4">
            {[
              { q: "How do I book a workspace?", a: "Simply browse our locations, select your preferred branch, and use the interactive blueprint to pick your space and time slot." },
              { q: "Can I cancel my reservation?", a: "Yes, you can cancel your reservation through your profile dashboard. Please check the specific location's cancellation policy for refund details." },
              { q: "What amenities are included?", a: "Most locations include high-speed Wi-Fi, premium coffee, printing services, and access to common lounge areas." }
            ].map((faq, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h4 className="font-black text-slate-900 mb-2">{faq.q}</h4>
                <p className="text-slate-500 font-medium text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-20 pt-10 border-t border-slate-200 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">© 2025 NOVASPACE WORLDWIDE ECOSYSTEM</p>
        </footer>
      </div>

      {/* Email Support Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-900 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-2 rounded-lg text-white">
                  <Mail size={20} />
                </div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest">Email Support</h3>
              </div>
              <button 
                onClick={() => setIsEmailModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              {emailSent ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Message Sent!</h3>
                  <p className="text-slate-500 font-medium">We'll get back to you as soon as possible.</p>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                      <input 
                        required
                        type="text" 
                        value={emailFormData.name}
                        onChange={(e) => setEmailFormData({...emailFormData, name: e.target.value})}
                        placeholder="Your Name"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                      <input 
                        required
                        type="tel" 
                        maxLength={11}
                        pattern="\d{11}"
                        title="Please enter exactly 11 digits"
                        value={emailFormData.number}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                          setEmailFormData({...emailFormData, number: val});
                        }}
                        placeholder="your number"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input 
                      required
                      type="email" 
                      value={emailFormData.email}
                      onChange={(e) => setEmailFormData({...emailFormData, email: e.target.value})}
                      placeholder="you@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inquiry</label>
                    <textarea 
                      required
                      minLength={10}
                      rows={4}
                      value={emailFormData.inquiry}
                      onChange={(e) => setEmailFormData({...emailFormData, inquiry: e.target.value})}
                      placeholder="How can we help you? (at least 10 characters)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                    />
                  </div>
                  {emailFormError && (
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-black uppercase tracking-widest text-center">
                      {emailFormError}
                    </div>
                  )}
                  <button 
                    type="submit"
                    disabled={isEmailSending}
                    className="w-full bg-blue-600 text-white font-black uppercase text-xs tracking-[0.2em] py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isEmailSending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send Inquiry
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-[80vh] sm:h-[600px]">
            <div className="bg-slate-900 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 p-2 rounded-lg text-white">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest">NovaSpace AI</h3>
                  <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Online • Instant Help</p>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50"
            >
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border-2 ${msg.role === 'user' ? 'border-blue-100 bg-blue-50' : 'border-emerald-100 bg-emerald-50'}`}>
                    {msg.role === 'user' ? (
                      <UserIcon size={16} className="text-blue-600" />
                    ) : (
                      <img 
                        src="https://api.dicebear.com/7.x/bottts/svg?seed=NovaBot&backgroundColor=b6e3f4" 
                        alt="AI Avatar" 
                        className="w-full h-full"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className={`max-w-[75%] p-4 rounded-2xl text-sm font-medium shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-emerald-100 bg-emerald-50">
                    <img 
                      src="https://api.dicebear.com/7.x/bottts/svg?seed=NovaBot&backgroundColor=b6e3f4" 
                      alt="AI Avatar" 
                      className="w-full h-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex gap-1 items-center h-10">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-t border-slate-100">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex gap-2"
              >
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button 
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportPage;
