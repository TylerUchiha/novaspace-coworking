import React, { useState } from 'react';
import { ChevronLeft, Image as ImageIcon, Building2, MapPin, Clock, Upload } from 'lucide-react';
import { Vendor } from '../types';
import { useImageCropUpload } from './ImageCropPortal';

interface CreateSpacePageProps {
  onBack: () => void;
  onCreate: (vendor: Vendor) => void;
}

const CreateSpacePage: React.FC<CreateSpacePageProps> = ({ onBack, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [locationCount, setLocationCount] = useState<number | ''>('');
  const [access, setAccess] = useState('');

  const logoCrop = useImageCropUpload({
    aspect: 16 / 9,
    onCrop: async (file) => {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description) return;

    const newVendor: Vendor = {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      description,
      logo: logo || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200',
      color: 'blue', // Default color
      locationCount: Number(locationCount) || 1,
      access: access || 'Full 24/7'
    };

    onCreate(newVendor);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Inter'] flex flex-col">
      <header className="bg-white border-b border-slate-200 px-8 py-6 flex items-center gap-6 sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-900"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create New Space</h1>
          <p className="text-sm font-bold text-slate-400">Add a new workspace to the network</p>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-8">
          
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                <Building2 size={14} /> Title
              </label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NovaSpace Global" 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-bold text-slate-900" 
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                <ImageIcon size={14} /> Image
              </label>
              
              <div 
                onClick={() => logoCrop.openPicker()}
                className={`w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative ${logo ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
              >
                <input {...logoCrop.inputProps} />
                
                {logo ? (
                  <>
                    <img src={logo} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-white font-bold flex items-center gap-2">
                        <Upload size={18} /> Change Image
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Upload size={20} />
                    </div>
                    <p className="font-bold text-slate-600 mb-1">Click to upload image</p>
                    <p className="text-xs text-slate-400 font-medium">PNG, JPG up to 5MB</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                Subtitle (Description)
              </label>
              <textarea 
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the workspace..." 
                rows={3}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium text-slate-900 resize-none" 
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                  <MapPin size={14} /> Locations (Cities count)
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={locationCount}
                  onChange={(e) => setLocationCount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 5" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-bold text-slate-900" 
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                  <Clock size={14} /> Opening Times
                </label>
                <input 
                  type="text" 
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  placeholder="e.g. Full 24/7" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-bold text-slate-900" 
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
            <button 
              type="button"
              onClick={onBack}
              className="px-8 py-4 rounded-2xl font-black text-sm text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              Create Space
            </button>
          </div>
        </form>
      </main>
      {logoCrop.cropPortal}
    </div>
  );
};

export default CreateSpacePage;
