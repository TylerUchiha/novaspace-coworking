import React, { useState, useEffect, useCallback } from 'react';
import { Category, MenuItem } from '../types';
import { Plus, Edit, Trash2, Save, Image as ImageIcon } from 'lucide-react';
import { uploadMenuImage } from '../services/storageUpload';
import { useImageCropUpload } from './ImageCropPortal';

export interface MenuEditorProps {
  scope: 'vendor' | 'location' | 'room';
  scopeId: string;
  locationId?: string;
  title: string;
  subtitle: string;
  categories: Category[];
  menu: MenuItem[];
  onUpdate: (patch: Partial<{ categories: Category[]; menu: MenuItem[] }>) => void;
}

const MenuEditor: React.FC<MenuEditorProps> = ({
  scope,
  scopeId,
  locationId,
  title,
  subtitle,
  categories,
  menu,
  onUpdate,
}) => {
  const [activeCategory, setActiveCategory] = useState<Category | null>(
    categories.length > 0 ? categories[0] : null,
  );
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState(0);
  const [itemDesc, setItemDesc] = useState('');
  const [itemImg, setItemImg] = useState('');

  const uploadCroppedMenuImage = useCallback(async (file: File) => {
    try {
      const itemId = editingItem?.id || `item-${Date.now()}`;
      const uploadScope = scope === 'room' ? 'location' : scope;
      const uploadId = scope === 'room' ? (locationId || scopeId) : scopeId;
      const url = await uploadMenuImage(uploadScope, uploadId, itemId, file);
      setItemImg(url);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => setItemImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, [editingItem?.id, scope, scopeId, locationId]);

  const menuImageCrop = useImageCropUpload({
    aspect: 4 / 3,
    onCrop: uploadCroppedMenuImage,
  });

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const patch = (updater: (prev: { categories: Category[]; menu: MenuItem[] }) => Partial<{
    categories: Category[];
    menu: MenuItem[];
  }>) => {
    onUpdate(updater({ categories, menu }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) menuImageCrop.queueFile(file);
  };

  const handleSaveCategory = () => {
    if (!catName.trim()) {
      setIsAddingCategory(false);
      return;
    }
    const newCat = { id: `cat-${Date.now()}`, name: catName.trim() };
    patch((prev) => ({ categories: [...prev.categories, newCat] }));
    setActiveCategory(newCat);
    setIsAddingCategory(false);
    setCatName('');
  };

  const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    patch((prev) => {
      const categoryName = prev.categories.find((c) => c.id === id)?.name;
      return {
        categories: prev.categories.filter((c) => c.id !== id),
        menu: prev.menu.filter((m) => m.category !== categoryName),
      };
    });
    if (activeCategory?.id === id) {
      setActiveCategory(categories.find((c) => c.id !== id) || null);
    }
  };

  const handleSaveItem = () => {
    if (!itemName.trim() || !activeCategory) return;
    const defaultImg =
      'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=400';
    patch((prev) => {
      if (editingItem) {
        return {
          menu: prev.menu.map((m) =>
            m.id === editingItem.id
              ? {
                  ...m,
                  name: itemName.trim(),
                  price: itemPrice,
                  description: itemDesc,
                  category: activeCategory.name,
                  image: itemImg || defaultImg,
                }
              : m,
          ),
        };
      }
      return {
        menu: [
          ...prev.menu,
          {
            id: `item-${Date.now()}`,
            name: itemName.trim(),
            price: itemPrice,
            description: itemDesc,
            category: activeCategory.name,
            image: itemImg || defaultImg,
          },
        ],
      };
    });
    setEditingItem(null);
    setIsAddingItem(false);
    setItemName('');
    setItemPrice(0);
    setItemDesc('');
    setItemImg('');
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    patch((prev) => ({ menu: prev.menu.filter((m) => m.id !== id) }));
  };

  const currentCategoryItems = menu.filter((m) => activeCategory && m.category === activeCategory.name);

  return (
    <div className="flex-1 bg-slate-50/30 overflow-hidden font-['Inter'] flex flex-col">
      <header className="p-10 pb-6 shrink-0 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-[0.2em] rounded-md">
                {title}
              </span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Menu Configuration</h2>
            <p className="text-slate-500 font-medium italic">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-72 border-r border-slate-200 bg-white p-6 flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Categories</h3>
            <button
              onClick={() => setIsAddingCategory(true)}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          {isAddingCategory && (
            <div className="flex gap-2 mb-2">
              <input
                autoFocus
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory()}
                placeholder="Category name"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
              />
              <button onClick={handleSaveCategory} className="p-2 bg-emerald-600 text-white rounded-xl">
                <Save size={14} />
              </button>
            </div>
          )}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-black text-sm transition-all ${
                activeCategory?.id === cat.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {cat.name}
              <Trash2
                size={14}
                className="opacity-40 hover:opacity-100 hover:text-rose-400"
                onClick={(e) => handleDeleteCategory(cat.id, e)}
              />
            </button>
          ))}
        </aside>

        <main className="flex-1 p-10 overflow-y-auto">
          {activeCategory ? (
            <>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900">{activeCategory.name}</h3>
                <button
                  onClick={() => {
                    setIsAddingItem(true);
                    setEditingItem(null);
                    setItemName('');
                    setItemPrice(0);
                    setItemDesc('');
                    setItemImg('');
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition-all"
                >
                  <Plus size={16} /> Add Item
                </button>
              </div>

              {(isAddingItem || editingItem) && (
                <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-8 shadow-sm space-y-4">
                  <input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Item name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none"
                  />
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    placeholder="Price (EGP)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none"
                  />
                  <textarea
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    placeholder="Description"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none resize-none h-24"
                  />
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer font-black text-xs uppercase tracking-widest text-slate-500">
                      <ImageIcon size={16} /> Upload Image
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    {itemImg && (
                      <img src={itemImg} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-100" />
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveItem}
                      className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm"
                    >
                      Save Item
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingItem(false);
                        setEditingItem(null);
                      }}
                      className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentCategoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm group"
                  >
                    <img
                      src={item.image}
                      alt=""
                      className="w-full aspect-square object-cover rounded-2xl mb-4"
                    />
                    <h4 className="font-black text-slate-900 mb-1">{item.name}</h4>
                    <p className="text-xs text-slate-400 mb-3 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-emerald-600">{item.price} EGP</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsAddingItem(false);
                            setItemName(item.name);
                            setItemPrice(item.price);
                            setItemDesc(item.description);
                            setItemImg(item.image || '');
                          }}
                          className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-blue-600"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteItem(item.id, e)}
                          className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <p className="text-slate-400 font-bold">Add a category to start building the menu.</p>
            </div>
          )}
        </main>
      </div>
      {menuImageCrop.cropPortal}
    </div>
  );
};

export default MenuEditor;
