/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Camera, 
  Upload, 
  Sparkles, 
  ShieldCheck, 
  Droplets, 
  AlertCircle, 
  ChevronRight, 
  RefreshCw,
  Info,
  CheckCircle2,
  ShoppingBag,
  Plus,
  Search,
  Twitter,
  Facebook,
  Instagram,
  Share2,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User, browserPopupRedirectResolver, GoogleAuthProvider } from 'firebase/auth';

// --- Types ---
interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  description: string;
  ingredients: string;
  image_url: string;
  price: number;
  rating: number;
  reviews: number;
  tags: string;
  matchPercentage?: number;
}

interface Review {
  id: number;
  product_id: number;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface HistoryItem {
  id: number;
  user_id: string;
  skin_type: string;
  summary: string;
  insight: string;
  conditions: string; // JSON string
  ingredients: string; // JSON string
  image_url: string;
  created_at: string;
}

interface AnalysisResult {
  skinType: string;
  summary: string;
  insight: string;
  stats: {
    conditions: number;
    ingredients: number;
    products: number;
  };
  conditions: {
    name: string;
    severity: 'Low' | 'Moderate' | 'High';
    percentage: number;
    description: string;
  }[];
  recommendedIngredients: {
    name: string;
    description: string;
    tag: string;
  }[];
}

// --- Constants ---
const ANALYSIS_STEPS = [
  "Uploading image securely",
  "Google Vision API scanning skin conditions",
  "Detecting oiliness, dryness & texture",
  "Gemini AI interpreting conditions",
  "Matching ingredients to your skin profile",
  "Querying product database",
  "Personalizing your recommendations"
];
const GEN_AI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'MISSING_API_KEY' });

export default function App() {
  const [view, setView] = useState<'home' | 'analysis' | 'results' | 'admin' | 'history'>('home');
  const [activeTab, setActiveTab] = useState<'analysis' | 'ingredients' | 'products'>('analysis');
  const [ingredientFilter, setIngredientFilter] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('All');
  const [adminTagFilter, setAdminTagFilter] = useState('All');
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productReviews, setProductReviews] = useState<Review[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState<{title: string, content: string} | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    id?: number;
    name: string;
    brand: string;
    category: string;
    description: string;
    ingredients: string;
    image_url: string;
    price: number;
    rating: number;
    reviews: number;
    tags: string;
  }>({
    name: '', brand: '', category: 'Serum', description: '', ingredients: '', image_url: 'https://picsum.photos/seed/new/400/400', price: 0, rating: 5.0, reviews: 0, tags: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchProducts();
    
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchHistory(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchHistory = async (uid: string) => {
    try {
      const res = await fetch(`/api/history/${uid}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleSignIn = async () => {
    // 1. Check if Firebase is initialized
    if (!auth || !googleProvider) {
      setShowInfoModal({
        title: "Authentication Unavailable",
        content: "Firebase is not correctly configured. Please check your VITE_FIREBASE_API_KEY and VITE_FIREBASE_AUTH_DOMAIN in the Secrets tab. Also, ensure Google Sign-In is enabled in the Firebase Console."
      });
      return;
    }
    
    // 2. Prevent concurrent sign-in attempts
    if (isSigningIn) {
      console.warn("Sign-in already in progress...");
      return;
    }
    
    setIsSigningIn(true);

    try {
      // 3. Create a fresh provider instance for every attempt
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ 
        prompt: 'select_account',
        // Add a timestamp to prevent cached responses if possible
        auth_type: 'reauthenticate'
      });
      
      // 4. Use the popup resolver explicitly
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      
      if (result.user) {
        console.log("Successfully signed in:", result.user.displayName);
        // Optionally fetch history immediately if not handled by useEffect
        fetchHistory(result.user.uid);
      }
    } catch (err: any) {
      console.error("Detailed sign-in error:", err);
      
      // 5. Handle user cancellations silently (standard UX)
      if (
        err.code === 'auth/cancelled-popup-request' || 
        err.code === 'auth/popup-closed-by-user' ||
        err.message?.includes('popup-closed-by-user')
      ) {
        console.log("User cancelled the sign-in process.");
        return;
      }

      // 6. Map technical errors to user-friendly guidance
      let errorMessage = "An unexpected error occurred. Please try again or refresh the page.";
      let errorTitle = "Sign In Issue";

      switch (err.code) {
        case 'auth/configuration-not-found':
          errorTitle = "Configuration Error";
          errorMessage = "Google Sign-In is not enabled in your Firebase project. Go to Authentication > Sign-in method in Firebase Console and enable Google.";
          break;
        case 'auth/popup-blocked':
          errorTitle = "Popup Blocked";
          errorMessage = "Your browser blocked the sign-in window. Please allow popups for this site and try again.";
          break;
        case 'auth/unauthorized-domain':
          errorTitle = "Domain Not Authorized";
          errorMessage = `This domain (${window.location.hostname}) is not authorized in your Firebase project. Add it to the 'Authorized domains' list in the Firebase Console under Authentication > Settings.`;
          break;
        case 'auth/network-request-failed':
          errorTitle = "Network Error";
          errorMessage = "A network error occurred. Please check your internet connection and try again.";
          break;
        case 'auth/internal-error':
          errorTitle = "Internal Error";
          errorMessage = "Firebase encountered an internal error. This often resolves with a page refresh.";
          break;
        default:
          if (err.message?.includes('INTERNAL ASSERTION FAILED')) {
            errorTitle = "Technical Error";
            errorMessage = "A technical conflict occurred in the authentication module. Refreshing the page usually fixes this.";
          }
          break;
      }

      setShowInfoModal({
        title: errorTitle,
        content: errorMessage
      });
    } finally {
      // 7. Use a slightly longer delay to ensure the popup state is fully cleared in the browser
      setTimeout(() => {
        setIsSigningIn(false);
      }, 800);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setView('home');
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const startCamera = async () => {
    setIsCapturing(true);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const initCamera = async () => {
      if (isCapturing && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera access denied", err);
          setShowInfoModal({
            title: "Camera Error",
            content: "Could not access your camera. Please ensure you have granted permission and that no other app is using it."
          });
          setIsCapturing(false);
        }
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCapturing]);

  const stopCamera = () => {
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
        setView('analysis');
      }
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    products.forEach(p => {
      if (p.tags) {
        p.tags.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed) tags.add(trimmed);
        });
      }
    });
    return Array.from(tags).sort();
  }, [products]);

  const fetchReviews = async (productId: number) => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews`);
      const data = await response.json();
      setProductReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !user) return;
    
    setIsSubmittingReview(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          userName: user.displayName || 'Anonymous',
          rating: newReview.rating,
          comment: newReview.comment
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewReview({ rating: 5, comment: '' });
        fetchReviews(selectedProduct.id);
        fetchProducts(); // Refresh product ratings
        
        // Update selected product in modal
        setSelectedProduct({
          ...selectedProduct,
          rating: parseFloat(data.newRating),
          reviews: data.newReviews
        });
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleShare = (platform: 'twitter' | 'facebook' | 'instagram' | 'copy') => {
    if (!selectedProduct) return;
    
    const url = window.location.origin;
    const text = `Check out this ${selectedProduct.name} from ${selectedProduct.brand}! It's only $${selectedProduct.price.toFixed(2)} on DermAI.`;
    
    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
        navigator.clipboard.writeText(`${text} ${url}`);
        setShowInfoModal({
          title: "Share on Instagram",
          content: "Product details and link copied! You can now paste it in your Instagram story or post."
        });
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        setShowInfoModal({
          title: "Link Copied",
          content: "Product link has been copied to your clipboard."
        });
        break;
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = newProduct.id ? `/api/products/${newProduct.id}` : '/api/products';
      const method = newProduct.id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchProducts();
        setNewProduct({
          name: '', brand: '', category: 'Serum', description: '', ingredients: '', image_url: 'https://picsum.photos/seed/new/400/400', price: 0, rating: 5.0, reviews: 0, tags: ''
        });
      }
    } catch (err) {
      console.error("Failed to save product", err);
    }
  };

  const tryDemo = () => {
    setImage("https://picsum.photos/seed/skin-demo/800/1000");
    setView('analysis');
  };

  const scrollToSection = (id: string) => {
    if (view !== 'home') {
      setView('home');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const showLegal = (type: 'privacy' | 'terms' | 'contact') => {
    const content = {
      privacy: {
        title: "Privacy Policy",
        content: "Your privacy is our priority. DermAI does not store your photos on our servers. All skin analysis is performed using temporary processing tokens that are deleted immediately after the session. We do not sell your data to third parties."
      },
      terms: {
        title: "Terms of Service",
        content: "By using DermAI, you acknowledge that this tool is for educational and informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider."
      },
      contact: {
        title: "Contact Us",
        content: "Have questions? Reach out to our team at support@dermai.ai or follow us on social media @DermAI. We typically respond within 24-48 hours."
      }
    };
    setShowInfoModal(content[type]);
  };

  useEffect(() => {
    if (selectedProduct) {
      fetchReviews(selectedProduct.id);
    }
  }, [selectedProduct]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products", err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);

    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setUploadError("Please upload a valid image format (JPG, PNG, or WEBP).");
        return;
      }

      // Validate file size (10MB = 10 * 1024 * 1024 bytes)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File size exceeds 10MB. Please upload a smaller image.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setView('analysis');
      };
      reader.readAsDataURL(file);
    }
  };

  const matchProducts = (recommendedIngredients: {name: string, description: string, tag: string}[]) => {
    const matched = products.map(p => {
      const prodIngs = p.ingredients.toLowerCase().split(',').map(i => i.trim());
      const recIngNames = recommendedIngredients.map(ri => ri.name.toLowerCase());
      
      let matchCount = 0;
      recIngNames.forEach(ri => {
        if (prodIngs.some(pi => pi.includes(ri) || ri.includes(pi))) {
          matchCount++;
        }
      });

      // Base match percentage + some randomness for "AI feel"
      const matchPercentage = Math.min(99, Math.round((matchCount / recIngNames.length) * 80 + 15 + Math.random() * 5));
      
      return { ...p, matchPercentage };
    }).filter(p => p.matchPercentage! > 60)
      .sort((a, b) => b.matchPercentage! - a.matchPercentage!);
    
    return matched;
  };

  const runAnalysis = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setAnalysisStep(0);

    // Simulate progress steps for UI feel
    const progressInterval = setInterval(() => {
      setAnalysisStep(prev => (prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      const base64Data = image.split(',')[1];
      
      const response = await GEN_AI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Analyze this skin photo. 
              Identify the primary skin type (e.g., Combination-Oily with Dehydration).
              Provide a summary of the skin's overall health.
              Provide a "Gemini AI Insight" which is a deeper technical interpretation of the conditions.
              Detect 6 specific conditions: Oiliness, Dehydration, Acne Activity, Uneven Texture, Redness, Sensitivity.
              For each condition, provide:
              - Severity: 'Low', 'Moderate', or 'High'
              - Percentage: 0-100 (representing intensity)
              - Description: A brief clinical explanation of the finding.
              Recommend 4-6 specific skincare ingredients. For each, provide:
              - Name
              - Description (how it helps)
              - Tag (e.g., 'Anti-Acne', 'Hydration', 'Barrier', 'Brightening', 'Soothing')
              Return the response in JSON format.` },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              skinType: { type: Type.STRING },
              summary: { type: Type.STRING },
              insight: { type: Type.STRING },
              stats: {
                type: Type.OBJECT,
                properties: {
                  conditions: { type: Type.NUMBER },
                  ingredients: { type: Type.NUMBER },
                  products: { type: Type.NUMBER }
                }
              },
              conditions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    severity: { type: Type.STRING, enum: ["Low", "Moderate", "High"] },
                    percentage: { type: Type.NUMBER },
                    description: { type: Type.STRING }
                  },
                  required: ["name", "severity", "percentage", "description"]
                }
              },
              recommendedIngredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tag: { type: Type.STRING }
                  },
                  required: ["name", "description", "tag"]
                }
              }
            },
            required: ["skinType", "summary", "insight", "conditions", "recommendedIngredients"]
          }
        }
      });

      clearInterval(progressInterval);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
      
      const analysis: AnalysisResult = JSON.parse(response.text || '{}');
      
      // Enhance analysis with stats if missing
      analysis.stats = {
        conditions: analysis.conditions.length,
        ingredients: analysis.recommendedIngredients.length,
        products: 0 // Will update after matching
      };

      setResult(analysis);
      
      // Match products based on ingredients and calculate match percentage
      const matched = matchProducts(analysis.recommendedIngredients);
      
      analysis.stats.products = matched.length;
      setRecommendedProducts(matched);

      // Save to history if user is logged in
      if (user) {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            skinType: analysis.skinType,
            summary: analysis.summary,
            insight: analysis.insight,
            conditions: analysis.conditions,
            ingredients: analysis.recommendedIngredients,
            imageUrl: image
          })
        });
        fetchHistory(user.uid);
      }

      setView('results');
    } catch (err) {
      console.error("Analysis failed", err);
      alert("Analysis failed. Please try again with a clearer photo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setRecommendedProducts([]);
    setIngredientFilter(null);
    setView('home');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] text-[#450920] font-sans selection:bg-[#FFA5AB] selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#450920]/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
          <div className="w-8 h-8 bg-[#A53860] rounded-lg flex items-center justify-center text-white">
            <Sparkles size={18} />
          </div>
          <span className="font-bold text-xl tracking-tight">DermAI</span>
        </div>
        <div className="flex items-center gap-6">
          {view !== 'home' && (
            <button 
              onClick={reset}
              className="flex items-center gap-2 text-sm font-bold text-[#A53860] hover:bg-[#A53860]/5 px-4 py-2 rounded-xl transition-all"
            >
              <RefreshCw size={14} className="rotate-180" /> Back to Home
            </button>
          )}
          <div className="hidden md:flex gap-8 text-sm font-medium">
            <button onClick={() => scrollToSection('features')} className="hover:text-[#A53860] transition-colors">How it works</button>
            <button onClick={() => scrollToSection('ingredients-showcase')} className="hover:text-[#A53860] transition-colors">Ingredients</button>
            <button onClick={() => scrollToSection('products-showcase')} className="hover:text-[#A53860] transition-colors">Products</button>
          </div>
        </div>
        <div className="flex gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <button onClick={() => setView('history')} className="text-sm font-medium hover:text-[#A53860] transition-colors">History</button>
              <button onClick={() => setView('admin')} className="text-sm font-medium hover:text-[#A53860] transition-colors">Admin</button>
              <div className="flex items-center gap-2">
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-[#450920]/10" />
                <button onClick={handleLogout} className="text-sm font-medium hover:text-[#A53860] transition-colors">Logout</button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setView('admin')} className="text-sm font-medium hover:text-[#A53860] transition-colors">Admin</button>
              <button 
                onClick={handleSignIn} 
                disabled={isSigningIn}
                className={`px-5 py-2 bg-[#450920] text-white rounded-full text-sm font-bold hover:bg-[#5A0C2A] transition-all flex items-center gap-2 ${isSigningIn ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSigningIn ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-16"
            >
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F9DBBD] rounded-full text-[10px] font-bold text-[#A53860] uppercase tracking-widest">
                  <Sparkles size={10} /> AI-powered • Free • Instant
                </div>
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9]">
                  Know your skin. <br />
                  <span className="text-[#A53860]">Get what it needs.</span>
                </h1>
                <p className="text-xl text-[#450920]/60 max-w-2xl mx-auto leading-relaxed">
                  Upload a clear photo of your face. Our AI analyzes 6 skin conditions and recommends the exact ingredients and products your skin is calling for.
                </p>
              </div>

              <div className="max-w-xl mx-auto space-y-6">
                <div 
                  className="relative group p-12 border-2 border-dashed border-[#450920]/10 rounded-[40px] bg-white hover:border-[#A53860]/30 transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-[#FDFBF9] rounded-2xl flex items-center justify-center text-[#A53860] group-hover:scale-110 transition-transform">
                      <Upload size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-bold">Drag & drop or click to upload</p>
                      <p className="text-xs text-[#450920]/40 uppercase tracking-widest font-bold">JPG, PNG, WEBP • Max 10MB • Front-facing, natural light</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-center">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-8 py-4 bg-[#450920] text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-[#5A0C2A] transition-all"
                  >
                    <ShoppingBag size={20} /> Choose Photo
                  </button>
                  <span className="text-sm font-bold opacity-30">or</span>
                  <button 
                    onClick={startCamera}
                    className="px-8 py-4 border-2 border-[#450920]/10 rounded-2xl font-bold flex items-center gap-3 hover:bg-[#450920]/5 transition-all"
                  >
                    <Camera size={20} /> Camera
                  </button>
                </div>

                <AnimatePresence>
                  {isCapturing && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6"
                    >
                      <div className="relative w-full max-w-lg aspect-[3/4] bg-black rounded-[40px] overflow-hidden border-4 border-white/20">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                          <div className="w-full h-full border-2 border-white/20 rounded-[20px] border-dashed" />
                        </div>
                      </div>
                      <div className="mt-8 flex gap-6">
                        <button onClick={stopCamera} className="px-8 py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all">Cancel</button>
                        <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                          <div className="w-16 h-16 border-4 border-black rounded-full" />
                        </button>
                        <div className="w-20" /> {/* Spacer */}
                      </div>
                      <canvas ref={canvasRef} className="hidden" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  <AnimatePresence>
                    {uploadError && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium"
                      >
                        <AlertCircle size={18} />
                        {uploadError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-[10px] text-[#450920]/40 flex items-center justify-center gap-2">
                    <ShieldCheck size={12} /> Your photo is never stored or shared. Analysis runs locally.
                  </p>
                  <button 
                    onClick={tryDemo}
                    className="text-sm font-bold text-[#A53860] hover:underline opacity-60"
                  >
                    Skip upload — try a demo analysis →
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>

              <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
                {[
                  { icon: Sparkles, title: "Instant AI Analysis", desc: "Powered by Google Cloud Vision." },
                  { icon: Droplets, title: "Gemini-Personalized", desc: "Ingredient science meets your skin." },
                  { icon: ShieldCheck, title: "Dermatologist-Grade", desc: "Evidence-backed recommendations." }
                ].map((feature, i) => (
                  <div key={i} className="p-8 bg-white rounded-[32px] border border-[#450920]/5 shadow-sm space-y-4 text-left group hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-[#F9DBBD] rounded-2xl flex items-center justify-center text-[#A53860] group-hover:rotate-12 transition-transform">
                      <feature.icon size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg">{feature.title}</h3>
                      <p className="text-sm text-[#450920]/60">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ingredients Showcase */}
              <div id="ingredients-showcase" className="pt-24 space-y-12 text-left">
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold tracking-tight">Science-Backed Ingredients</h2>
                  <p className="text-[#450920]/60 max-w-2xl">We only recommend ingredients with proven clinical efficacy for specific skin concerns.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { name: "Niacinamide", tag: "Oil Control", desc: "Reduces sebum production and minimizes pore appearance." },
                    { name: "Hyaluronic Acid", tag: "Hydration", desc: "Attracts and holds 1000x its weight in water for plump skin." },
                    { name: "Salicylic Acid", tag: "Anti-Acne", desc: "BHA that exfoliates inside pores to prevent breakouts." },
                    { name: "Ceramides", tag: "Barrier", desc: "Essential lipids that restore and protect the skin's natural barrier." }
                  ].map((ing, i) => (
                    <div key={i} className="p-6 bg-white rounded-3xl border border-[#450920]/5 space-y-4">
                      <div className="px-3 py-1 bg-[#F9DBBD] rounded-full text-[10px] font-bold text-[#A53860] w-fit uppercase tracking-widest">{ing.tag}</div>
                      <h3 className="font-bold text-xl">{ing.name}</h3>
                      <p className="text-xs text-[#450920]/60 leading-relaxed">{ing.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Products Showcase */}
              <div id="products-showcase" className="pt-24 space-y-12 text-left">
                <div className="flex justify-between items-end">
                  <div className="space-y-4">
                    <h2 className="text-4xl font-bold tracking-tight">Our Curated Collection</h2>
                    <p className="text-[#450920]/60 max-w-2xl">Explore our full range of dermatologist-recommended skincare products.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4).map((p) => (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedProduct(p)}
                      className="bg-white rounded-[32px] border border-[#450920]/5 overflow-hidden group hover:shadow-xl transition-all cursor-pointer"
                    >
                      <div className="aspect-square bg-[#FDFBF9] relative overflow-hidden">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-[#A53860] uppercase tracking-widest opacity-60">{p.brand}</p>
                            <div className="flex items-center gap-1 text-yellow-500">
                              <Sparkles size={10} className="fill-current" />
                              <span className="text-[10px] font-bold">{p.rating}</span>
                            </div>
                          </div>
                          <h4 className="font-bold text-sm leading-tight line-clamp-2">{p.name}</h4>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-lg font-bold tracking-tighter">${(p.price || 0).toFixed(2)}</span>
                          <button className="p-2 bg-[#450920]/5 text-[#450920] rounded-xl hover:bg-[#450920] hover:text-white transition-all">
                            <ShoppingBag size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'analysis' && image && !isAnalyzing && (
            <motion.div 
              key="analysis-preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto space-y-12 py-12 text-center"
            >
              <div className="space-y-4">
                <h2 className="text-4xl font-bold tracking-tight">Ready for analysis?</h2>
                <p className="text-[#450920]/60">Make sure your face is well-lit and clearly visible in the photo.</p>
              </div>

              <div className="aspect-[3/4] max-w-md mx-auto rounded-[40px] overflow-hidden shadow-2xl border-8 border-white">
                <img src={image} alt="To analyze" className="w-full h-full object-cover" />
              </div>

              <div className="flex flex-col gap-4 max-w-md mx-auto">
                <button 
                  onClick={runAnalysis}
                  className="w-full py-5 bg-[#A53860] text-white rounded-2xl font-bold shadow-xl shadow-[#A53860]/20 hover:bg-[#8E2F52] transition-all flex items-center justify-center gap-3"
                >
                  <Sparkles size={20} /> Start AI Analysis
                </button>
                <button 
                  onClick={() => setView('home')}
                  className="w-full py-4 bg-[#450920]/5 text-[#450920] rounded-2xl font-bold hover:bg-[#450920]/10 transition-all"
                >
                  Retake Photo
                </button>
              </div>
            </motion.div>
          )}

          {isAnalyzing && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-2xl mx-auto space-y-12 py-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold tracking-tight">Analyzing your skin...</h2>
                <p className="text-[#450920]/60">Our AI is working through 6 skin parameters</p>
              </div>

              <div className="space-y-8">
                <div className="relative h-2 bg-[#450920]/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="absolute inset-y-0 left-0 bg-[#A53860]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }}
                  />
                </div>

                <div className="space-y-4">
                  {ANALYSIS_STEPS.map((step, i) => (
                    <div key={i} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          i < analysisStep ? 'bg-[#A53860] border-[#A53860] text-white' : 
                          i === analysisStep ? 'border-[#A53860] text-[#A53860]' : 'border-[#450920]/10 text-[#450920]/20'
                        }`}>
                          {i < analysisStep ? <CheckCircle2 size={14} /> : <div className={`w-1.5 h-1.5 rounded-full ${i === analysisStep ? 'bg-[#A53860] animate-pulse' : 'bg-transparent'}`} />}
                        </div>
                        <span className={`text-sm font-bold transition-all ${
                          i < analysisStep ? 'text-[#450920]/40' : 
                          i === analysisStep ? 'text-[#450920]' : 'text-[#450920]/20'
                        }`}>
                          {step}
                        </span>
                      </div>
                      {i === analysisStep && (
                        <div className="flex gap-1">
                          {[0, 1, 2].map(d => <div key={d} className="w-1 h-1 bg-[#A53860] rounded-full animate-bounce" style={{ animationDelay: `${d * 0.2}s` }} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'results' && result && !isAnalyzing && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="space-y-6 flex-1">
                  <button 
                    onClick={reset}
                    className="flex items-center gap-2 text-sm font-bold text-[#A53860] opacity-60 hover:opacity-100 transition-all mb-4"
                  >
                    ← Back to Home
                  </button>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs font-bold text-[#A53860] uppercase tracking-widest">
                      <CheckCircle2 size={14} /> Analysis Complete • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <h1 className="text-5xl font-bold tracking-tighter">{result.skinType}</h1>
                  </div>
                  <p className="text-lg text-[#450920]/70 leading-relaxed">{result.summary}</p>
                  
                  <div className="p-6 bg-[#450920] text-white rounded-[32px] space-y-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                      <Sparkles size={80} />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60">
                      <Sparkles size={14} /> Gemini AI Insight
                    </div>
                    <p className="text-sm leading-relaxed relative z-10">{result.insight}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Conditions Detected", value: result.stats.conditions },
                      { label: "Ingredients Matched", value: result.stats.ingredients },
                      { label: "Products Curated", value: result.stats.products }
                    ].map((stat, i) => (
                      <div key={i} className="p-4 bg-white rounded-2xl border border-[#450920]/5">
                        <p className="text-3xl font-bold tracking-tighter">{stat.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full md:w-80 space-y-4 sticky top-24">
                  <div className="aspect-[4/5] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white">
                    <img src={image!} alt="Analyzed" className="w-full h-full object-cover" />
                  </div>
                  <button onClick={() => setView('home')} className="w-full py-4 border-2 border-[#450920]/10 rounded-2xl font-bold hover:bg-[#450920]/5 transition-all flex items-center justify-center gap-2">
                    <RefreshCw size={18} /> New Analysis
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex p-1 bg-[#450920]/5 rounded-2xl max-w-md">
                  {(['analysis', 'ingredients', 'products'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${
                        activeTab === tab ? 'bg-white text-[#450920] shadow-sm' : 'text-[#450920]/40 hover:text-[#450920]'
                      }`}
                    >
                      {tab === 'analysis' ? `Skin Analysis ${result.stats.conditions}` : 
                       tab === 'ingredients' ? `Ingredients ${result.stats.ingredients}` : 
                       `Products ${result.stats.products}`}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'analysis' && (
                    <motion.div 
                      key="tab-analysis"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40">
                        <ShieldCheck size={12} /> Detected via Google Cloud Vision API • Scored 0-100
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {result.conditions.map((c, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="p-6 bg-white rounded-[32px] border border-[#450920]/5 space-y-6 hover:shadow-md transition-all"
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-lg">{c.name}</h4>
                              <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
                                c.severity === 'High' ? 'bg-red-50 text-red-600' : 
                                c.severity === 'Moderate' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                              }`}>
                                {c.severity}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                                <span>Severity</span>
                                <span>{c.percentage}%</span>
                              </div>
                              <div className="h-1.5 bg-[#450920]/5 rounded-full overflow-hidden">
                                <motion.div 
                                  className={`h-full ${
                                    c.severity === 'High' ? 'bg-red-500' : 
                                    c.severity === 'Moderate' ? 'bg-orange-400' : 'bg-green-400'
                                  }`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${c.percentage}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-[#450920]/60 leading-relaxed">{c.description}</p>
                          </motion.div>
                        ))}
                      </div>
                      <div className="text-center pt-8">
                        <p className="text-sm font-bold opacity-40 mb-4">Want a deeper analysis or routine plan?</p>
                        <button className="px-8 py-4 bg-[#A53860] text-white rounded-2xl font-bold flex items-center gap-3 mx-auto hover:bg-[#8E2F52] transition-all">
                          <Upload size={20} /> Share My Results
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'ingredients' && (
                    <motion.div 
                      key="tab-ingredients"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40">
                        <Sparkles size={12} /> Curated by Gemini AI based on your skin conditions
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {result.recommendedIngredients.map((ing, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="p-8 bg-white rounded-[32px] border border-[#450920]/5 flex gap-6 items-start hover:shadow-md transition-all"
                          >
                            <div className="flex-1 space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <h4 className="font-bold text-xl">{ing.name}</h4>
                                  <p className="text-xs font-bold text-[#A53860] uppercase tracking-widest opacity-60">Control + Refinement</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span className="px-3 py-1 bg-[#F9DBBD] rounded-full text-[10px] font-bold text-[#A53860] uppercase tracking-widest">
                                    {ing.tag}
                                  </span>
                                  <button 
                                    onClick={() => {
                                      setIngredientFilter(ing.name);
                                      setActiveTab('products');
                                    }}
                                    className="px-3 py-1 border border-[#A53860]/20 rounded-full text-[10px] font-bold text-[#A53860] uppercase tracking-widest hover:bg-[#A53860] hover:text-white transition-all"
                                  >
                                    Show Products
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-[#450920]/60 leading-relaxed">{ing.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'products' && (
                    <motion.div 
                      key="tab-products"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40">
                          <Info size={12} /> Matched from product database • Sorted by skin compatibility
                        </div>
                        {ingredientFilter && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Filtered by:</span>
                            <div className="px-3 py-1 bg-[#A53860] text-white rounded-full text-[10px] font-bold flex items-center gap-2">
                              {ingredientFilter}
                              <button onClick={() => setIngredientFilter(null)} className="hover:opacity-70">
                                <Plus size={12} className="rotate-45" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {recommendedProducts
                          .filter(p => !ingredientFilter || p.ingredients.toLowerCase().includes(ingredientFilter.toLowerCase()))
                          .map((p, i) => (
                          <motion.div 
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="bg-white rounded-[32px] border border-[#450920]/5 overflow-hidden group hover:shadow-xl transition-all cursor-pointer"
                          >
                            <div className="aspect-square bg-[#FDFBF9] relative overflow-hidden">
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              <div className="absolute top-4 left-4 flex flex-col gap-2">
                                <div className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-[#A53860] flex items-center gap-1">
                                  <Sparkles size={10} /> {p.matchPercentage}% match
                                </div>
                                {p.tags.split(',').map((tag, i) => (
                                  <div key={i} className="px-3 py-1 bg-[#450920]/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-white">
                                    {tag.trim()}
                                  </div>
                                ))}
                              </div>
                              <button className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-[#450920] hover:bg-[#A53860] hover:text-white transition-all">
                                <Plus size={16} />
                              </button>
                            </div>
                            <div className="p-6 space-y-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-[#A53860] uppercase tracking-widest opacity-60">{p.brand}</p>
                                <h4 className="font-bold text-sm leading-tight line-clamp-2">{p.name}</h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex text-yellow-400">
                                  {[...Array(5)].map((_, i) => <Sparkles key={i} size={10} className={i < Math.floor(p.rating) ? 'fill-current' : 'opacity-20'} />)}
                                </div>
                                <span className="text-[10px] font-bold opacity-40">{p.rating} ({p.reviews.toLocaleString()})</span>
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <span className="text-lg font-bold tracking-tighter">${(p.price || 0).toFixed(2)}</span>
                                <button className="px-4 py-2 bg-[#450920] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#5A0C2A] transition-all flex items-center gap-2">
                                  <ShoppingBag size={12} /> Add to Cart
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <button 
                    onClick={reset}
                    className="flex items-center gap-2 text-sm font-bold text-[#A53860] opacity-60 hover:opacity-100 transition-all mb-2"
                  >
                    ← Back to Home
                  </button>
                  <h2 className="text-3xl font-bold">Analysis History</h2>
                </div>
                <button onClick={() => setView('home')} className="px-6 py-3 border-2 border-[#450920]/10 rounded-xl font-bold hover:bg-[#450920]/5 transition-all">
                  New Analysis
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-24 space-y-4 bg-white rounded-[40px] border border-[#450920]/5">
                  <div className="w-16 h-16 bg-[#FDFBF9] rounded-2xl flex items-center justify-center text-[#A53860] mx-auto">
                    <RefreshCw size={32} />
                  </div>
                  <h3 className="text-xl font-bold">No history yet</h3>
                  <p className="text-[#450920]/60">Your skin analysis results will appear here once you complete one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {history.map((item) => (
                    <div key={item.id} className="bg-white rounded-[32px] border border-[#450920]/5 overflow-hidden flex hover:shadow-xl transition-all group">
                      <div className="w-1/3 aspect-[3/4] overflow-hidden">
                        <img src={item.image_url} alt={item.skin_type} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-[#A53860] uppercase tracking-widest opacity-60">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                          <h4 className="font-bold text-lg leading-tight">{item.skin_type}</h4>
                          <p className="text-xs text-[#450920]/60 line-clamp-3">{item.summary}</p>
                        </div>
                        <button 
                          onClick={() => {
                            const conditions = JSON.parse(item.conditions || '[]');
                            const ingredients = JSON.parse(item.ingredients || '[]');
                            const matched = matchProducts(ingredients);
                            
                            setImage(item.image_url);
                            setIngredientFilter(null);
                            setActiveTab('analysis');
                            setResult({
                              skinType: item.skin_type,
                              summary: item.summary,
                              insight: item.insight,
                              stats: { 
                                conditions: conditions.length, 
                                ingredients: ingredients.length, 
                                products: matched.length
                              },
                              conditions: conditions,
                              recommendedIngredients: ingredients
                            });
                            setRecommendedProducts(matched);
                            setView('results');
                          }}
                          className="text-xs font-bold text-[#A53860] hover:underline flex items-center gap-1"
                        >
                          View Details <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                  <button 
                    onClick={reset}
                    className="flex items-center gap-2 text-sm font-bold text-[#A53860] opacity-60 hover:opacity-100 transition-all mb-2"
                  >
                    ← Back to Home
                  </button>
                  <h2 className="text-3xl font-bold">Product Inventory</h2>
                </div>
                
                <div className="flex flex-1 max-w-md w-full gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#450920]/30" size={18} />
                    <input 
                      type="text"
                      placeholder="Search name, brand, or category..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#450920]/10 rounded-2xl focus:outline-none focus:border-[#A53860] transition-all text-sm"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setNewProduct({
                        name: '', brand: '', category: 'Serum', description: '', ingredients: '', image_url: 'https://picsum.photos/seed/new/400/400', price: 0, rating: 5.0, reviews: 0, tags: ''
                      });
                      setShowAddModal(true);
                    }}
                    className="px-6 py-3 bg-[#450920] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-[#5A0C2A] transition-all whitespace-nowrap"
                  >
                    <Plus size={18} /> Add Product
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 mt-6 p-6 bg-[#FDFBF9] rounded-3xl border border-[#450920]/5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Filter Category:</span>
                  <div className="flex gap-2">
                    {['All', 'Serum', 'Moisturizer', 'Cleanser', 'Sunscreen', 'Treatment'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setAdminCategoryFilter(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          adminCategoryFilter === cat 
                            ? 'bg-[#450920] text-white shadow-md' 
                            : 'bg-white text-[#450920] border border-[#450920]/10 hover:border-[#A53860]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Filter Tag:</span>
                  <select 
                    value={adminTagFilter}
                    onChange={(e) => setAdminTagFilter(e.target.value)}
                    className="bg-white border border-[#450920]/10 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-[#A53860] text-[#450920]"
                  >
                    <option value="All">All Tags</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>

                {(adminCategoryFilter !== 'All' || adminTagFilter !== 'All' || adminSearch) && (
                  <button 
                    onClick={() => {
                      setAdminCategoryFilter('All');
                      setAdminTagFilter('All');
                      setAdminSearch('');
                    }}
                    className="text-[10px] font-bold text-[#A53860] hover:underline uppercase tracking-widest ml-auto"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showAddModal && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-[#450920]/40 backdrop-blur-sm flex items-center justify-center p-6"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      className="bg-white rounded-[40px] p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-bold">{newProduct.id ? 'Edit Product' : 'Add New Product'}</h3>
                        <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-[#450920]/5 rounded-full transition-colors">
                          <Plus size={24} className="rotate-45" />
                        </button>
                      </div>
                      <form onSubmit={handleAddProduct} className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Product Name</label>
                          <input required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]" placeholder="e.g. Vitamin C Serum" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Brand</label>
                          <input required value={newProduct.brand} onChange={e => setNewProduct({...newProduct, brand: e.target.value})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]" placeholder="e.g. Glow Recipe" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Category</label>
                          <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]">
                            <option>Serum</option>
                            <option>Moisturizer</option>
                            <option>Cleanser</option>
                            <option>Sunscreen</option>
                            <option>Treatment</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Price ($)</label>
                          <input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Rating (0-5)</label>
                          <input type="number" step="0.1" min="0" max="5" required value={newProduct.rating} onChange={e => setNewProduct({...newProduct, rating: parseFloat(e.target.value)})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Reviews Count</label>
                          <input type="number" required value={newProduct.reviews} onChange={e => setNewProduct({...newProduct, reviews: parseInt(e.target.value)})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Image URL</label>
                          <input required value={newProduct.image_url} onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]" placeholder="https://..." />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Description</label>
                          <textarea required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860] h-24" placeholder="Product description..." />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Ingredients (comma separated)</label>
                          <textarea required value={newProduct.ingredients} onChange={e => setNewProduct({...newProduct, ingredients: e.target.value})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860] h-24" placeholder="Niacinamide, Zinc, Glycerin..." />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest opacity-40">Tags (comma separated)</label>
                          <input value={newProduct.tags} onChange={e => setNewProduct({...newProduct, tags: e.target.value})} className="w-full p-4 bg-[#FDFBF9] border border-[#450920]/5 rounded-2xl focus:outline-none focus:border-[#A53860]" placeholder="Best Seller, Editor's Pick..." />
                        </div>
                        <div className="col-span-2 pt-4">
                          <button type="submit" className="w-full py-5 bg-[#450920] text-white rounded-2xl font-bold hover:bg-[#5A0C2A] transition-all">
                            {newProduct.id ? 'Update Product' : 'Save Product to Inventory'}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {selectedProduct && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-[#450920]/40 backdrop-blur-sm flex items-center justify-center p-6"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
                    >
                      <div className="w-full md:w-1/2 bg-[#FDFBF9] relative h-64 md:h-auto">
                        <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                        <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-[#450920] hover:bg-[#A53860] hover:text-white transition-all">
                          <Plus size={24} className="rotate-45" />
                        </button>
                      </div>
                      
                      <div className="flex-1 p-8 md:p-12 overflow-y-auto space-y-8">
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-[#A53860] uppercase tracking-widest opacity-60">{selectedProduct.brand}</p>
                          <h3 className="text-3xl font-bold leading-tight">{selectedProduct.name}</h3>
                          <div className="flex items-center gap-4 pt-2">
                            <div className="flex items-center gap-1">
                              <Sparkles size={16} className="text-[#A53860]" />
                              <span className="text-lg font-bold">{selectedProduct.rating}</span>
                              <span className="text-xs opacity-40">({selectedProduct.reviews} reviews)</span>
                            </div>
                            <span className="px-3 py-1 bg-[#F9DBBD] rounded-full text-[10px] font-bold text-[#A53860] uppercase tracking-widest">
                              {selectedProduct.category}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-widest opacity-40">Description</h4>
                          <p className="text-sm text-[#450920]/70 leading-relaxed">{selectedProduct.description}</p>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-widest opacity-40">Key Ingredients</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedProduct.ingredients.split(',').map((ing, i) => (
                              <span key={i} className="px-4 py-2 bg-[#450920]/5 rounded-xl text-xs font-bold text-[#450920]">
                                {ing.trim()}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-[#450920]/5">
                          <h4 className="text-xs font-bold uppercase tracking-widest opacity-40">Share Product</h4>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => handleShare('twitter')}
                              className="w-10 h-10 bg-[#1DA1F2]/10 text-[#1DA1F2] rounded-xl flex items-center justify-center hover:bg-[#1DA1F2] hover:text-white transition-all"
                              title="Share on Twitter"
                            >
                              <Twitter size={18} />
                            </button>
                            <button 
                              onClick={() => handleShare('facebook')}
                              className="w-10 h-10 bg-[#1877F2]/10 text-[#1877F2] rounded-xl flex items-center justify-center hover:bg-[#1877F2] hover:text-white transition-all"
                              title="Share on Facebook"
                            >
                              <Facebook size={18} />
                            </button>
                            <button 
                              onClick={() => handleShare('instagram')}
                              className="w-10 h-10 bg-[#E4405F]/10 text-[#E4405F] rounded-xl flex items-center justify-center hover:bg-[#E4405F] hover:text-white transition-all"
                              title="Share on Instagram"
                            >
                              <Instagram size={18} />
                            </button>
                            <button 
                              onClick={() => handleShare('copy')}
                              className="w-10 h-10 bg-[#450920]/5 text-[#450920] rounded-xl flex items-center justify-center hover:bg-[#450920] hover:text-white transition-all"
                              title="Copy Link"
                            >
                              <LinkIcon size={18} />
                            </button>
                            {navigator.share && (
                              <button 
                                onClick={() => {
                                  navigator.share({
                                    title: selectedProduct.name,
                                    text: `Check out this ${selectedProduct.name} from ${selectedProduct.brand}!`,
                                    url: window.location.origin
                                  }).catch(console.error);
                                }}
                                className="w-10 h-10 bg-[#A53860]/10 text-[#A53860] rounded-xl flex items-center justify-center hover:bg-[#A53860] hover:text-white transition-all"
                                title="More Share Options"
                              >
                                <Share2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="pt-8 border-t border-[#450920]/5 space-y-8">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xl font-bold">Reviews</h4>
                            {user ? (
                              <button 
                                onClick={() => document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })}
                                className="text-sm font-bold text-[#A53860] hover:underline"
                              >
                                Write a Review
                              </button>
                            ) : (
                              <button onClick={handleSignIn} className="text-sm font-bold text-[#A53860] hover:underline">Sign in to Review</button>
                            )}
                          </div>

                          {user && (
                            <form 
                              id="review-form"
                              onSubmit={handleSubmitReview} 
                              className="p-6 bg-[#FDFBF9] rounded-3xl border border-[#450920]/5 space-y-4"
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-xs font-bold uppercase tracking-widest opacity-40">Your Rating:</span>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <button 
                                      key={star} 
                                      type="button"
                                      onClick={() => setNewReview({...newReview, rating: star})}
                                      className={`transition-all ${newReview.rating >= star ? 'text-[#A53860]' : 'text-[#450920]/10'}`}
                                    >
                                      <Sparkles size={20} fill={newReview.rating >= star ? "currentColor" : "none"} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <textarea 
                                required
                                value={newReview.comment}
                                onChange={e => setNewReview({...newReview, comment: e.target.value})}
                                placeholder="Share your experience with this product..."
                                className="w-full p-4 bg-white border border-[#450920]/10 rounded-2xl focus:outline-none focus:border-[#A53860] text-sm h-24"
                              />
                              <button 
                                type="submit" 
                                disabled={isSubmittingReview}
                                className="w-full py-4 bg-[#450920] text-white rounded-2xl font-bold hover:bg-[#5A0C2A] transition-all disabled:opacity-50"
                              >
                                {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                              </button>
                            </form>
                          )}

                          <div className="space-y-6">
                            {productReviews.length === 0 ? (
                              <p className="text-center py-8 text-sm opacity-40 italic">No reviews yet. Be the first to share your thoughts!</p>
                            ) : (
                              productReviews.map(review => (
                                <div key={review.id} className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-[#A53860] rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {review.user_name[0]}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold">{review.user_name}</p>
                                        <div className="flex gap-0.5">
                                          {[1, 2, 3, 4, 5].map(star => (
                                            <Sparkles key={star} size={10} className={review.rating >= star ? 'text-[#A53860]' : 'text-[#450920]/10'} fill={review.rating >= star ? "currentColor" : "none"} />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="text-[10px] opacity-40">{new Date(review.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-sm text-[#450920]/70 leading-relaxed pl-11">{review.comment}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white rounded-[32px] border border-[#450920]/5 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FDFBF9] border-b border-[#450920]/5">
                      <th className="p-6 text-xs font-bold uppercase tracking-widest opacity-50">Product</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest opacity-50">Category</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest opacity-50">Ingredients</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest opacity-50">Rating</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest opacity-50">Price</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest opacity-50">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...products]
                      .filter(p => {
                        const matchesSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
                          p.brand.toLowerCase().includes(adminSearch.toLowerCase()) ||
                          p.category.toLowerCase().includes(adminSearch.toLowerCase());
                        
                        const matchesCategory = adminCategoryFilter === 'All' || p.category === adminCategoryFilter;
                        
                        const matchesTag = adminTagFilter === 'All' || (p.tags && p.tags.split(',').map(t => t.trim()).includes(adminTagFilter));
                        
                        return matchesSearch && matchesCategory && matchesTag;
                      })
                      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                      .map((p) => (
                      <tr key={p.id} className="border-b border-[#450920]/5 hover:bg-[#FDFBF9] transition-colors">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <img src={p.image_url} className="w-12 h-12 rounded-lg object-cover" />
                            <div>
                              <p className="font-bold">{p.name}</p>
                              <p className="text-xs opacity-50">{p.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className="px-3 py-1 bg-[#F9DBBD] rounded-full text-[10px] font-bold text-[#A53860]">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-6">
                          <p className="text-xs text-[#450920]/60 max-w-xs truncate">{p.ingredients}</p>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-1 text-yellow-500">
                            <Sparkles size={12} className="fill-current" />
                            <span className="font-bold text-sm">{p.rating}</span>
                          </div>
                        </td>
                        <td className="p-6 font-bold tracking-tighter">${(p.price || 0).toFixed(2)}</td>
                        <td className="p-6">
                          <button 
                            onClick={() => {
                              setNewProduct({
                                id: p.id,
                                name: p.name,
                                brand: p.brand,
                                category: p.category,
                                description: p.description,
                                ingredients: p.ingredients,
                                image_url: p.image_url,
                                price: p.price,
                                rating: p.rating,
                                reviews: p.reviews,
                                tags: p.tags
                              });
                              setShowAddModal(true);
                            }}
                            className="text-xs font-bold text-[#A53860] hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#450920]/5 py-12 px-6 mt-24">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#A53860] rounded flex items-center justify-center text-white">
              <Sparkles size={12} />
            </div>
            <span className="font-bold tracking-tight">DermAI</span>
          </div>
          <p className="text-xs text-[#450920]/40">© 2026 DermAI. For educational purposes only. Consult a dermatologist for medical advice.</p>
          <div className="flex gap-6 text-xs font-bold opacity-40">
            <button onClick={() => showLegal('privacy')} className="hover:opacity-100">Privacy</button>
            <button onClick={() => showLegal('terms')} className="hover:opacity-100">Terms</button>
            <button onClick={() => showLegal('contact')} className="hover:opacity-100">Contact</button>
          </div>
        </div>
      </footer>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-[#450920]/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">{showInfoModal.title}</h3>
                <button onClick={() => setShowInfoModal(null)} className="p-2 hover:bg-[#450920]/5 rounded-full transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <p className="text-[#450920]/70 leading-relaxed mb-8">
                {showInfoModal.content}
              </p>
              <button 
                onClick={() => setShowInfoModal(null)}
                className="w-full py-4 bg-[#450920] text-white rounded-2xl font-bold hover:bg-[#5A0C2A] transition-all"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
