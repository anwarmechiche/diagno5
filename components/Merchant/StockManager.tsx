import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Plus, Minus, Check, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  stock_quantity: number;
  price: number;
  image_url?: string;
}

const StockManager = ({ merchantId }: { merchantId: string }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  // État pour gérer les valeurs saisies manuellement par produit
  const [manualInputs, setManualInputs] = useState<{ [key: string]: string }>({});

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
    } catch (err) {
      console.error("Erreur lors du chargement des stocks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (merchantId) fetchProducts();
  }, [merchantId]);

  // Fonction pour mettre à jour avec une valeur précise ou un changement
  const handleStockUpdate = async (productId: string, newValue: number) => {
    if (newValue < 0) {
      alert("Le stock ne peut pas être inférieur à zéro.");
      return;
    }

    setUpdatingId(productId);
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_quantity: newValue })
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => 
        prev.map(p => p.id === productId ? { ...p, stock_quantity: newValue } : p)
      );
      
      // Réinitialiser l'input manuel pour ce produit
      setManualInputs(prev => ({ ...prev, [productId]: '' }));
      
    } catch (err) {
      console.error("Erreur de mise à jour:", err);
      alert("Erreur lors de la mise à jour du stock.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Chargement de l'inventaire...</div>;

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="text-blue-600" /> Gestion des Stocks
            </h1>
            <p className="text-gray-500 text-sm">Saisie directe ou ajustement rapide</p>
          </div>
          
          <div className="relative w-full md:w-64">
            <input 
              type="text" 
              placeholder="Rechercher un produit..." 
              className="w-full pl-4 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{product.name}</h3>
                  <p className="text-xs text-gray-400 font-mono italic">
                    REF: {String(product.id).slice(0, 8)}
                  </p>
                </div>
                {product.stock_quantity <= 5 ? (
                  <AlertTriangle className="text-amber-500" size={20} />
                ) : (
                  <CheckCircle className="text-green-500" size={20} />
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between mb-4 border border-gray-100">
                <span className="text-gray-600 text-sm font-medium">En stock :</span>
                <span className={`text-2xl font-bold ${product.stock_quantity <= 0 ? 'text-red-600' : 'text-blue-700'}`}>
                  {product.stock_quantity}
                </span>
              </div>

              {/* SECTION SAISIE DIRECTE */}
              <div className="mb-4">
                <label className="text-[11px] uppercase font-bold text-gray-400 mb-1 block">Saisie manuelle</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    min="0"
                    placeholder="Nouvelle qté..."
                    value={manualInputs[product.id] || ''}
                    onChange={(e) => setManualInputs({ ...manualInputs, [product.id]: e.target.value })}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  />
                  <button 
                    onClick={() => {
                      const val = parseInt(manualInputs[product.id]);
                      if (!isNaN(val)) handleStockUpdate(product.id, val);
                    }}
                    disabled={!manualInputs[product.id] || updatingId === product.id}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Check size={18} />
                  </button>
                </div>
              </div>

              {/* BOUTONS D'AJUSTEMENT RAPIDE */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                <button 
                  onClick={() => handleStockUpdate(product.id, product.stock_quantity - 1)}
                  disabled={updatingId === product.id || product.stock_quantity <= 0}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors flex justify-center"
                >
                  <Minus size={16} />
                </button>
                <button 
                  onClick={() => handleStockUpdate(product.id, product.stock_quantity + 1)}
                  disabled={updatingId === product.id}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-green-50 hover:text-green-600 transition-colors flex justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>

              {product.stock_quantity <= 0 && (
                <p className="text-red-500 text-[10px] mt-3 font-bold uppercase text-center bg-red-50 py-1 rounded">Rupture de stock</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StockManager;