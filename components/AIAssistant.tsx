import React, { useState } from 'react';
import { Sparkles, Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { getSmartRecommendation } from '../services/geminiService';
import { Room } from '../types';

interface AIAssistantProps {
  rooms: Room[];
  onSelectRoom: (roomId: string) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ rooms, onSelectRoom }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<{ roomId: string; reasoning: string } | null>(null);

  // Helper function to call the Gemini service and handle the response
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setRecommendation(null);
    try {
      const result = await getSmartRecommendation(prompt, rooms);
      if (result && result.recommendedRoomId) {
        setRecommendation({
          roomId: result.recommendedRoomId,
          reasoning: result.reasoning
        });
      }
    } catch (error) {
      console.error("AI Assistant Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (recommendation) {
      onSelectRoom(recommendation.roomId);
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      {isOpen ? (
        <div className="bg-white w-96 rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
          <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles size={20} />
              <h3 className="font-black tracking-tight">NovaAI Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">How can I help you find a space?</p>
            <form onSubmit={handleAskAI} className="space-y-4">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="e.g. Need a room for 4 with a TV..."
                  className="w-full pl-6 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium text-sm"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 transition-all"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </form>

            {recommendation && (
              <div className="mt-6 p-5 bg-blue-50 border border-blue-100 rounded-2xl animate-in fade-in zoom-in-95">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">AI Recommendation</p>
                <p className="text-sm font-bold text-slate-800 mb-3">{recommendation.reasoning}</p>
                <button 
                  onClick={handleSelect}
                  className="w-full py-3 bg-white border border-blue-200 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                >
                  Locate & Select Space
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-200 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group relative"
        >
          <Sparkles size={28} />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-4 border-white animate-pulse" />
          <div className="absolute right-20 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Need a recommendation?
          </div>
        </button>
      )}
    </div>
  );
};

export default AIAssistant;