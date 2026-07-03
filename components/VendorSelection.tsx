
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Vendor, LocationData, UserProfile } from '../types';
import { Building2, ArrowRight, MapPin, Search, XCircle, ChevronLeft, Plus, Inbox, Check, FilterX, Bot, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getNovaBotResponse, getNovaBotErrorMessage } from '../services/geminiService';
import { useRemoteConfig } from './RemoteConfigProvider';
import { UserAvatar } from './UserAvatar';

interface VendorSelectionProps {
  vendors: Vendor[];
  locations: LocationData[];
  onSelect: (vendor: Vendor) => void;
  onBack: () => void;
  userRole: string;
  onCreateSpace?: () => void;
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
  onShowSupport?: () => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
  allTags: string[];
  allCities: string[];
  userName?: string;
  userProfile?: UserProfile;
}

const getProfessionGreeting = (name?: string, profession?: string): string => {
  const firstName = name ? name.split(' ')[0] : '';
  const normProf = (profession || '').toLowerCase().trim();
  
  if (normProf.includes('doctor') || normProf.includes('dr.') || normProf.includes('physician') || normProf.includes('dentist')) {
    return firstName ? `Hey Dr. ${firstName}` : 'Hey doc';
  }
  if (normProf.includes('teacher') || normProf.includes('professor') || normProf.includes('educator')) {
    return firstName ? `Hey Professor ${firstName}` : 'Hey teach';
  }
  if (normProf.includes('engineer') || normProf.includes('architect')) {
    return firstName ? `Hey Engineer ${firstName}` : 'Hey builder';
  }
  if (normProf.includes('developer') || normProf.includes('coder') || normProf.includes('programmer') || normProf.includes('software')) {
    return firstName ? `Hey Coder ${firstName}` : 'Hey dev';
  }
  if (normProf.includes('designer') || normProf.includes('artist') || normProf.includes('creative')) {
    return firstName ? `Hey Designer ${firstName}` : 'Hey creative';
  }
  if (normProf.includes('chef') || normProf.includes('cook') || normProf.includes('baker')) {
    return firstName ? `Hey Chef ${firstName}` : 'Hey chef';
  }
  
  return firstName ? `Hey ${firstName}` : 'Hey there';
};

const VendorSelection: React.FC<VendorSelectionProps> = ({ 
  vendors, 
  locations,
  onSelect, 
  onBack, 
  userRole, 
  onCreateSpace,
  onShowPrivacy,
  onShowTerms,
  onShowSupport,
  selectedTags,
  setSelectedTags,
  selectedCities,
  setSelectedCities,
  allTags,
  allCities,
  userName,
  userProfile
}) => {
  const isStaff = userRole === 'employee' || userRole === 'owner';
  const { featureNovaBotEnabled } = useRemoteConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVendor, setExpandedVendor] = useState<Vendor | null>(null);

  // Chatbot states
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [chatbotFilteredIds, setChatbotFilteredIds] = useState<string[] | null>(null);
  const [showBotTooltip, setShowBotTooltip] = useState(true);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize bot welcome message
  useEffect(() => {
    if (chatMessages.length === 0) {
      const greeting = getProfessionGreeting(userName, userProfile?.profession);
      setChatMessages([
        {
          role: 'model',
          text: `${greeting}! 👋 My mission is to help you figure out where to work today. Tell me what you're looking for, and I'll find the perfect spot!`
        }
      ]);
    }
  }, [userName, userProfile]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isBotTyping, isBotOpen]);

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput('');
    setShowBotTooltip(false);

    // Append user message
    const updatedMessages = [...chatMessages, { role: 'user' as const, text: userText }];
    setChatMessages(updatedMessages);
    setIsBotTyping(true);

    try {
      const response = await getNovaBotResponse(
        userText,
        locations,
        chatMessages,
        allTags,
        allCities,
        userName,
        userProfile?.profession
      );
      setIsBotTyping(false);
      setChatMessages(prev => [...prev, { role: 'model', text: response.reply }]);
      if (response.matchingLocationIds && Array.isArray(response.matchingLocationIds)) {
        setChatbotFilteredIds(response.matchingLocationIds);
      }
      
      const nextTags = response.filterAction === 'replace' ? [] : [...selectedTags];
      const nextCities = response.filterAction === 'replace' ? [] : [...selectedCities];

      if (response.matchingTags && Array.isArray(response.matchingTags)) {
        setSelectedTags(Array.from(new Set([...nextTags, ...response.matchingTags])));
      } else if (response.filterAction === 'replace') {
        setSelectedTags([]);
      }

      if (response.matchingCities && Array.isArray(response.matchingCities)) {
        setSelectedCities(Array.from(new Set([...nextCities, ...response.matchingCities])));
      } else if (response.filterAction === 'replace') {
        setSelectedCities([]);
      }
    } catch (error) {
      console.error("Chatbot Error:", error);
      setIsBotTyping(false);
      setChatMessages(prev => [...prev, { role: 'model', text: getNovaBotErrorMessage(error) }]);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]);
  };

  const toggleCity = (city: string) => {
    setSelectedCities(selectedCities.includes(city) ? selectedCities.filter(c => c !== city) : [...selectedCities, city]);
  };

  const filteredVendors = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let result = vendors;
    
    if (query) {
      result = result.filter(vendor => 
        vendor.name.toLowerCase().includes(query) || 
        vendor.description.toLowerCase().includes(query)
      );
    }

    if (selectedTags.length > 0) {
      result = result.filter(vendor => {
        const vendorLocations = locations.filter(loc => loc.vendorId === vendor.id);
        const vendorTags = new Set<string>(vendor.tags || []);
        vendorLocations.forEach(loc => loc.tags?.forEach(t => vendorTags.add(t)));
        return selectedTags.every(tag => vendorTags.has(tag));
      });
    }

    if (selectedCities.length > 0) {
      result = result.filter(vendor => {
        const vendorLocations = locations.filter(loc => loc.vendorId === vendor.id);
        return vendorLocations.some(loc => loc.city && selectedCities.includes(loc.city));
      });
    }

    if (chatbotFilteredIds !== null) {
      result = result.filter(vendor => {
        const vendorLocations = locations.filter(loc => loc.vendorId === vendor.id);
        return vendorLocations.some(loc => chatbotFilteredIds.includes(loc.id));
      });
    }
    
    // Deduplicate by ID to prevent React key warnings if state has duplicates
    const uniqueVendors: typeof result = [];
    const seen = new Set<string>();
    for (const v of result) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        uniqueVendors.push(v);
      }
    }
    
    return uniqueVendors;
  }, [searchQuery, vendors, selectedTags, selectedCities, locations, chatbotFilteredIds]);

  return (
    <div className="min-h-screen bg-slate-50 flex font-['Inter'] p-8 gap-8">
      {/* Sidebar Filter - User Portal Only */}
      {userRole === 'customer' && (
        <aside className="flex flex-col shrink-0 z-20 gap-6">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-7 h-fit w-fit animate-in slide-in-from-left-8 duration-700">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Filter by Tags</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {allTags.length > 0 ? (
                allTags.map(tag => (
                  <label key={tag} className="flex items-center gap-3 group cursor-pointer whitespace-nowrap">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => toggleTag(tag)}
                        className="peer appearance-none w-5 h-5 border-2 border-slate-200 rounded-md checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                      />
                      <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" size={12} strokeWidth={4} />
                    </div>
                    <span className={`text-sm font-bold transition-colors ${selectedTags.includes(tag) ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
                      {tag}
                    </span>
                  </label>
                ))
              ) : (
                <span className="text-xs font-bold text-slate-400 italic col-span-2">No tags available</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-7 h-fit w-fit animate-in slide-in-from-left-8 duration-700 delay-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Quick Cities</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {allCities.length > 0 ? (
                allCities.map(city => (
                  <label key={city} className="flex items-center gap-3 group cursor-pointer whitespace-nowrap">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox"
                        checked={selectedCities.includes(city)}
                        onChange={() => toggleCity(city)}
                        className="peer appearance-none w-5 h-5 border-2 border-slate-200 rounded-md checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                      />
                      <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" size={12} strokeWidth={4} />
                    </div>
                    <span className={`text-sm font-bold transition-colors ${selectedCities.includes(city) ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
                      {city}
                    </span>
                  </label>
                ))
              ) : (
                <span className="text-xs font-bold text-slate-400 italic col-span-2">No cities available</span>
              )}
            </div>
          </div>

          {(selectedTags.length > 0 || selectedCities.length > 0 || chatbotFilteredIds !== null) && (
            <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 p-4 animate-in fade-in slide-in-from-left-4 duration-500">
              <button 
                onClick={() => {
                  setSelectedTags([]);
                  setSelectedCities([]);
                  setChatbotFilteredIds(null);
                }}
                className="w-full text-left px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all flex items-center gap-3"
              >
                <FilterX size={16} />
                Clear All Filters
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white rounded-[4rem] shadow-2xl border border-slate-100 p-8 lg:p-16 animate-in fade-in duration-700">
        <div className="max-w-6xl mx-auto">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 hover:text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mb-12 transition-colors group text-slate-400"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="flex-1">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
                Where would you like to <span className="text-blue-600 italic">Work</span> today?
              </h2>
              <p className="text-lg text-slate-500 font-medium mt-4 max-w-xl">
                Choose one of our premium partner networks to access their specific property layouts and member services.
              </p>
              
              <div className="mt-8 relative group max-w-md">
                <Search className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-blue-600' : 'text-slate-400 group-focus-within:text-blue-600'}`} size={20} />
                <input 
                  type="text" 
                  placeholder="Search networks..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-12 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 shadow-sm font-bold text-slate-900 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                    title="Clear search"
                  >
                    <XCircle size={18} />
                  </button>
                )}
              </div>
            </div>
          </header>

          {filteredVendors.length > 0 ? (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-10">
              <AnimatePresence mode="popLayout">
                {filteredVendors.map((vendor) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ duration: 0.3 }}
                    key={vendor.id}
                    onClick={() => onSelect(vendor)}
                    className="group bg-white rounded-[3rem] border border-slate-100 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full"
                  >
                    <div className="h-56 relative overflow-hidden">
                      <img 
                        src={vendor.logo} 
                        alt={vendor.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    </div>

                    <div className="p-10 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{vendor.name}</h3>
                        <div className={`p-2 rounded-xl bg-blue-50 text-blue-600`}>
                          <Building2 size={20} />
                        </div>
                      </div>
                      
                      <p className="text-slate-500 font-medium leading-relaxed mb-6 line-clamp-2">
                        {vendor.description}
                      </p>

                      {/* Tags Display */}
                      <div className="flex flex-wrap gap-1.5 mb-8">
                        {(vendor.tags || []).slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            {tag}
                          </span>
                        ))}
                        {(vendor.tags || []).length > 3 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setExpandedVendor(vendor); }}
                            className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-md text-[8px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-100 transition-colors"
                          >
                            +{(vendor.tags || []).length - 3} More
                          </button>
                        )}
                        {(!vendor.tags || vendor.tags.length === 0) && (
                          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">No brand tags</span>
                        )}
                      </div>

                      <div className="mt-auto">
                        <div className="flex items-center gap-8 mb-8">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Locations</p>
                            <div className="flex items-center gap-2 text-slate-900 font-black">
                              <MapPin size={14} className="text-blue-500" />
                              {vendor.locationCount} Cities
                            </div>
                          </div>
                          <div className="h-10 w-[1px] bg-slate-100" />
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Access</p>
                            <div className="flex items-center gap-2 text-slate-900 font-black">
                              {vendor.access || 'Full 24/7'}
                            </div>
                          </div>
                        </div>

                        <button className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-blue-600 transition-colors">
                          Enter Workspace
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {!searchQuery && selectedTags.length === 0 && userRole !== 'customer' && (
                <motion.div layout onClick={onCreateSpace} className="border-4 border-dashed border-blue-200 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center group hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer">
                   <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mb-6 text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Plus size={32} />
                   </div>
                   <p className="text-xl font-black text-blue-900">Create New Space</p>
                   <p className="text-sm font-bold text-blue-600/60 mt-2">Add a new workspace location to the network.</p>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-500">
              <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 flex items-center justify-center mb-8 text-slate-200">
                <Inbox size={48} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-3">No matching workspaces found</h3>
              <p className="text-slate-500 font-medium max-w-sm mb-8">
                We couldn't find any locations matching your current filters.
              </p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTags([]);
                }}
                className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-blue-600 transition-colors shadow-xl"
              >
                Clear Search
              </button>
            </div>
          )}

          <footer className="mt-20 pt-10 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">© 2025 NOVASPACE WORLDWIDE ECOSYSTEM</p>
             <div className="flex items-center gap-8">
                <button onClick={onShowPrivacy} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">Privacy</button>
                <button onClick={onShowTerms} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">Terms</button>
                <button onClick={onShowSupport} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">Support</button>
             </div>
          </footer>
        </div>
      </div>

      {/* Expanded Vendor Modal */}
      <AnimatePresence>
        {expandedVendor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setExpandedVendor(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setExpandedVendor(null)}
                className="absolute top-6 right-6 z-10 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 hover:bg-white transition-colors"
              >
                <XCircle size={20} />
              </button>
              
              <div className="h-72 relative overflow-hidden shrink-0">
                <img 
                  src={expandedVendor.logo} 
                  alt={expandedVendor.name} 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>

              <div className="p-10 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{expandedVendor.name}</h3>
                  <div className={`p-3 rounded-2xl bg-blue-50 text-blue-600`}>
                    <Building2 size={24} />
                  </div>
                </div>
                
                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                  {expandedVendor.description}
                </p>

                {/* All Tags Display */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {(expandedVendor.tags || []).map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto">
                  <div className="flex items-center gap-8 mb-8">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Locations</p>
                      <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
                        <MapPin size={16} className="text-blue-500" />
                        {expandedVendor.locationCount} Cities
                      </div>
                    </div>
                    <div className="h-12 w-[1px] bg-slate-100" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Access</p>
                      <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
                        {expandedVendor.access || 'Full 24/7'}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      onSelect(expandedVendor);
                      setExpandedVendor(null);
                    }}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-blue-600 transition-colors group"
                  >
                    Enter Workspace
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nova Bot Chat Widget */}
      {!isStaff && featureNovaBotEnabled && (
        <div className="fixed bottom-8 right-8 z-[110] flex flex-col items-end font-['Inter']">
          <AnimatePresence>
            {isBotOpen ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-[24rem] h-[32rem] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden flex flex-col mb-4"
              >
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                      <Bot size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm tracking-tight leading-none">Nova Bot</h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Workspace Guide</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsBotOpen(false)} 
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                {/* Message List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                  {chatMessages.map((msg, index) => {
                    const isModel = msg.role === 'model';
                    return (
                      <div 
                        key={index} 
                        className={`flex gap-3 ${isModel ? 'justify-start' : 'justify-end'} items-end animate-in fade-in slide-in-from-bottom-2 duration-300`}
                      >
                        {isModel && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm border border-blue-100">
                            <Bot size={16} />
                          </div>
                        )}
                        
                        <div className={`flex flex-col gap-1 max-w-[75%]`}>
                          <span className={`text-[9px] font-black text-slate-400 uppercase tracking-widest ${isModel ? 'ml-1' : 'mr-1 text-right'}`}>
                            {isModel ? 'Nova Bot' : (userName || 'You')}
                          </span>
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isModel 
                              ? 'bg-white border border-slate-100 text-slate-800 rounded-tl-none' 
                              : 'bg-blue-600 text-white rounded-tr-none'
                          }`}>
                            {msg.text}
                          </div>
                        </div>

                        {!isModel && (
                          <UserAvatar 
                            pfp={userProfile?.pfp} 
                            name={userProfile?.name || userName} 
                            profession={userProfile?.profession} 
                            size="sm" 
                            className="shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Bouncy Typing Indicator */}
                  {isBotTyping && (
                    <div className="flex gap-3 justify-start items-end">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm border border-blue-100">
                        <Bot size={16} />
                      </div>
                      <div className="flex flex-col gap-1 max-w-[70%]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Bot</span>
                        <div className="bg-white border border-slate-100 text-slate-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                          <div className="flex items-center gap-1.5 py-1.5 px-1">
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendChatMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                  <input 
                    type="text"
                    placeholder="Ask Nova Bot..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isBotTyping}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium text-sm text-slate-800 placeholder:text-slate-300 shadow-inner disabled:opacity-50"
                  />
                  <button 
                    type="submit"
                    disabled={isBotTyping || !chatInput.trim()}
                    className="w-11 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 shadow-md"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </motion.div>
            ) : (
              <div className="relative flex flex-col items-end">
                {/* Bouncing Chat Bubble Tooltip */}
                {showBotTooltip && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute bottom-20 right-0 bg-slate-900 text-white font-black text-xs py-3.5 px-5 rounded-[1.5rem] rounded-br-none shadow-[0_10px_30px_rgba(15,23,42,0.2)] w-64 text-center cursor-pointer flex flex-col gap-1 hover:bg-slate-800 transition-all z-40 select-none animate-bounce"
                    onClick={() => {
                      setIsBotOpen(true);
                      setShowBotTooltip(false);
                    }}
                  >
                    <p className="leading-relaxed">Talk to me to figure out where you wanna work today! 🤖</p>
                    <span className="text-[9px] text-blue-400 uppercase tracking-widest font-bold">Powered by Nova Bot</span>
                  </motion.div>
                )}

                {/* Floating Bot Button */}
                <button 
                  onClick={() => {
                    setIsBotOpen(true);
                    setShowBotTooltip(false);
                  }}
                  className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/20 hover:scale-110 hover:shadow-blue-500/40 active:scale-95 transition-all group relative duration-300"
                >
                  <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping group-hover:animate-none opacity-75" />
                  <Bot size={28} className="relative transition-transform duration-300 group-hover:rotate-12" />
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default VendorSelection;
