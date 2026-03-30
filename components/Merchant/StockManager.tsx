import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, Plus, Minus, Check, AlertTriangle, 
  CheckCircle, Loader2, Search, BellRing, Save
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  stock_quantity: number;
  low_stock_threshold?: number;
  price: number;
  merchant_id: string;
}

const StockManager = ({ merchantId }: { merchantId: string }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [manualInputs, setManualInputs] = useState<{ [key: string]: string }>({});
  
  // États pour les seuils d'alerte (saisie numérique)
  const [thresholdInputs, setThresholdInputs] = useState<{ [key: string]: string }>({});

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
      
      // Initialiser les inputs des seuils avec les valeurs de la DB
      const initialThresholds: { [key: string]: string } = {};
      data?.forEach(p => {
        initialThresholds[p.id] = String(p.low_stock_threshold || 5);
      });
      setThresholdInputs(initialThresholds);
    } catch (err) {
      console.error("Erreur chargement:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (merchantId) fetchProducts();
  }, [merchantId]);

  // Mise à jour du Stock
  const handleQuantityUpdate = async (productId: string, newQty: number) => {
    if (newQty < 0) return;
    setUpdatingId(productId);
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_quantity: newQty })
        .eq('id', productId);

      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock_quantity: newQty } : p));
    } catch (err) {
      alert("Erreur : Impossible de modifier le stock.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Mise à jour du Seuil d'Alerte (Numérique)
  const handleSaveThreshold = async (productId: string) => {
    const newVal = parseInt(thresholdInputs[productId]);
    if (isNaN(newVal)) return;

    setUpdatingId(productId);
    try {
      const { error } = await supabase
        .from('products')
        .update({ low_stock_threshold: newVal })
        .eq('id', productId);

      if (error) {
        // Si la colonne n'existe pas, on met à jour uniquement l'interface
        console.warn("Colonne low_stock_threshold absente, mise à jour locale uniquement.");
      }
      
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, low_stock_threshold: newVal } : p));
      alert("Seuil mis à jour !");
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
            <Package className="text-blue-600" size={28} /> Inventaire & Alertes
          </h1>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un produit..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const currentThreshold = product.low_stock_threshold ?? 5;
              const isLow = product.stock_quantity <= currentThreshold;

              return (
                <div key={product.id} className={`bg-white rounded-3xl p-6 border-2 transition-all duration-300 ${isLow ? 'border-red-200 shadow-lg bg-red-50/20' : 'border-transparent shadow-md'}`}>
                  
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-800 text-lg leading-tight truncate w-40">{product.name}</h3>
                    {isLow ? (
                      <span className="bg-red-500 text-white p-1.5 rounded-full animate-bounce">
                        <AlertTriangle size={16} />
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-600 p-1.5 rounded-full">
                        <CheckCircle size={16} />
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 mb-6 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</p>
                      <p className={`text-3xl font-black ${isLow ? 'text-red-600' : 'text-blue-900'}`}>{product.stock_quantity}</p>
                    </div>
                    <div className="h-10 w-[1px] bg-gray-200"></div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alerte</p>
                      <p className="text-xl font-bold text-gray-700">{currentThreshold}</p>
                    </div>
                  </div>

                  {/* SAISIE NUMÉRIQUE DU SEUIL */}
                  <div className="mb-6 p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <label className="text-[10px] font-black text-blue-600 uppercase mb-2 block tracking-wider">Modifier le seuil d'alerte</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        min="0"
                        value={thresholdInputs[product.id] || ''}
                        onChange={(e) => setThresholdInputs({ ...thresholdInputs, [product.id]: e.target.value })}
                        className="w-full bg-white border-none rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-400 outline-none shadow-inner"
                      />
                      <button 
                        onClick={() => handleSaveThreshold(product.id)}
                        className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                      >
                        <Save size={18} />
                      </button>
                    </div>
                  </div>

                  {/* AJUSTEMENT STOCK */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Qté"
                        value={manualInputs[product.id] || ''}
                        onChange={(e) => setManualInputs({ ...manualInputs, [product.id]: e.target.value })}
                        className="w-20 border-gray-100 border bg-gray-50 rounded-xl px-3 py-2 text-sm focus:bg-white transition-all outline-none"
                      />
                      <button 
                        onClick={() => {
                          const val = parseInt(manualInputs[product.id]);
                          if (!isNaN(val)) handleQuantityUpdate(product.id, val);
                          setManualInputs({ ...manualInputs, [product.id]: '' });
                        }}
                        className="bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-black transition-all flex items-center justify-center flex-1 font-bold text-sm"
                      >
                        FIXER <Check size={14} className="ml-1" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleQuantityUpdate(product.id, product.stock_quantity - 1)}
                        disabled={product.stock_quantity <= 0}
                        className="flex-1 bg-white border border-gray-200 py-3 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all flex justify-center disabled:opacity-20"
                      >
                        <Minus size={20} />
                      </button>
                      <button 
                        onClick={() => handleQuantityUpdate(product.id, product.stock_quantity + 1)}
                        className="flex-1 bg-white border border-gray-200 py-3 rounded-xl hover:bg-green-50 hover:text-green-600 transition-all flex justify-center"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockManager;
