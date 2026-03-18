"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from '@/utils/supabase/client'
import { saveSession } from '@/lib/auth-helpers'

// Composant Button style "Supabase"
function Button({ children, onClick, disabled, type = 'button', variant = 'primary' }: any) {
  const variants = {
    primary: "bg-white text-black hover:bg-gray-200",
    secondary: "bg-[#1c1c1c] text-white border border-[#333] hover:border-[#444]",
    test: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full font-medium py-2.5 px-4 rounded-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 ${variants[variant as keyof typeof variants]}`}
    >
      {children}
    </button>
  )
}

export default function DiagnospherePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // États pour le formulaire de login
  const [loading, setLoading] = useState(false)
  const [userType, setUserType] = useState('merchant')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [merchantId, setMerchantId] = useState('DiagnoSphere')
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    prenom: "",
    nom: "",
    email: "",
    etablissement: "",
    message: ""
  });

  useEffect(() => {
    const checkSession = async () => {
      const user = localStorage.getItem("user");
      setIsLoggedIn(!!user);
    };
    checkSession();

    // Scroll reveal observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add("visible"), i * 80);
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach((r) => observer.observe(r));

    // Smooth nav active state
    const handleScroll = () => {
      const sections = document.querySelectorAll("section[id]");
      const links = document.querySelectorAll(".nav-links a");
      let current = "";
      sections.forEach((s) => {
        if (window.scrollY >= (s as HTMLElement).offsetTop - 120) current = s.id;
      });
      links.forEach((l) => {
        (l as HTMLElement).style.color = l.getAttribute("href") === "#" + current ? "var(--teal)" : "";
      });
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Merci pour votre message ! Nous vous répondrons dans les plus brefs délais.");
    setFormData({ prenom: "", nom: "", email: "", etablissement: "", message: "" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let user = null
      if (userType === 'merchant') {
        user = await db.loginMerchant(loginId, password)
        if (user) {
          saveSession(user, 'merchant', user.id)
          localStorage.setItem("user", JSON.stringify({ email: loginId, type: 'merchant' }));
          setIsLoggedIn(true)
          router.push('/fournisseur/dashboard')
        } else {
          setError('Identifiants fournisseur incorrects')
        }
      } else {
        // Connexion client avec merchantId fixé sur "DIAGNOSPHÈRE"
        user = await db.loginClient(loginId, password, merchantId)
        if (user) {
          saveSession(user, 'client', user.merchant_id)
          localStorage.setItem("user", JSON.stringify({ email: loginId, type: 'client' }));
          setIsLoggedIn(true)
          router.push('/client/dashboard')
        } else {
          setError('Identifiants invalides')
        }
      }
    } catch (err) {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("user");
    setIsLoggedIn(false);
  };

  return (
    <>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DIAGNOSPHÈRE · innovation pathologique</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
      </head>

      <style>{`
        :root {
          --deep: #030712;
          --navy: #0f172a;
          --accent: #3b82f6;
          --teal: #06b6d4;
          --gold: #f59e0b;
          --white: #f8fafc;
          --muted: #94a3b8;
          --emerald: #10b981;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--deep);
          color: var(--white);
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
        }

        /* Premium Mesh Gradient Animation */
        .mesh-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
          background-color: var(--deep);
          background-image: 
            radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0, transparent 50%), 
            radial-gradient(at 50% 0%, rgba(6, 182, 212, 0.1) 0, transparent 50%), 
            radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.1) 0, transparent 50%),
            radial-gradient(at 50% 50%, rgba(15, 23, 42, 1) 0, transparent 100%);
          filter: blur(80px);
          animation: meshPulse 20s ease-in-out infinite alternate;
        }

        @keyframes meshPulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }

        /* Background noise modifier */
        .noise-overlay {
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.3;
        }

        /* Animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        .reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: all 1s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .divider {
          width: 80px;
          height: 2px;
          background: linear-gradient(90deg, var(--teal), transparent);
          margin: 2rem 0;
          border-radius: 99px;
        }

        /* Imposing Login card (Glassmorphism + Irisated Border) */
        .login-card {
          position: relative;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 3rem;
          height: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .login-card:hover {
          transform: translateY(-8px) scale(1.02);
          border-color: rgba(6, 182, 212, 0.3);
        }

        .login-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          background: linear-gradient(45deg, transparent, rgba(6, 182, 212, 0.2), transparent);
          border-radius: 24px;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.4s;
        }
        .login-card:hover::before { opacity: 1; }

        .login-title {
          font-family: "Cormorant Garamond", serif;
          font-size: 2.2rem;
          font-weight: 400;
          color: var(--white);
          margin-bottom: 0.75rem;
          letter-spacing: -0.02em;
        }

        .login-subtitle {
          color: var(--muted);
          font-size: 0.95rem;
          margin-bottom: 2rem;
          font-weight: 400;
        }

        .login-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1rem 1.25rem;
          color: var(--white);
          font-size: 1rem;
          outline: none;
          transition: all 0.3s;
          margin-bottom: 1.25rem;
          border-radius: 12px;
        }

        .login-input:focus {
          border-color: var(--teal);
          background: rgba(0, 0, 0, 0.5);
          box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.1);
        }

        .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          padding: 1rem;
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .login-button {
          width: 100%;
          padding: 1rem;
          background: var(--white);
          color: var(--deep);
          font-size: 0.9rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          margin-bottom: 1rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .login-button:hover:not(:disabled) {
          background: var(--teal);
          color: var(--white);
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(6, 182, 212, 0.4);
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .user-profile {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 32px;
          padding: 3rem;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .user-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--teal), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          font-size: 3rem;
          color: var(--white);
          box-shadow: 0 10px 15px -3px rgba(6, 182, 212, 0.3);
        }

        .user-email {
          color: var(--white);
          font-size: 1.25rem;
          font-weight: 500;
          margin-bottom: 2rem;
          opacity: 0.9;
        }

        .logout-button {
          padding: 1rem 2rem;
          background: transparent;
          border: 2px solid var(--gold);
          color: var(--gold);
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
          border-radius: 12px;
        }

        .logout-button:hover {
          background: var(--gold);
          color: var(--deep);
          transform: scale(1.05);
        }

        .account-type-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          margin-bottom: 2rem;
        }

        .account-type-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.85rem;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 700;
          transition: all 0.4s;
          cursor: pointer;
          border: none;
          background: transparent;
          color: var(--muted);
        }

        .account-type-btn.active {
          color: white;
        }

        .account-type-btn.active .btn-indicator {
          background: var(--emerald);
          box-shadow: 0 0 15px var(--emerald);
        }

        .account-type-btn .btn-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transition: all 0.3s;
        }

        .account-type-btn.active .btn-bg {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          pointer-events: none;
        }
      `}</style>

      <div className="min-h-screen">
        {/* Advanced Premium Background */}
        <div className="mesh-bg" />
        <div className="noise-overlay" />

        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 lg:px-16 py-4 bg-[rgba(10,15,30,0.85)] backdrop-blur-md border-b border-[rgba(46,134,222,0.12)]">
          <a href="#" className="font-['Cormorant_Garamond',serif] text-xl sm:text-2xl font-semibold tracking-[0.15em] text-white no-underline">
            DIAGNO<span className="text-[#00b4d8]">SPHÈRE</span>
          </a>

          <ul className="hidden md:flex gap-6 lg:gap-10 list-none nav-links">
            <li><a href="#about" className="text-[0.7rem] lg:text-xs tracking-[0.12em] uppercase text-[#8a9bc0] no-underline hover:text-[#00b4d8] transition-colors">À propos</a></li>
            <li><a href="#expertise" className="text-[0.7rem] lg:text-xs tracking-[0.12em] uppercase text-[#8a9bc0] no-underline hover:text-[#00b4d8] transition-colors">Expertise</a></li>
            <li><a href="#engagement" className="text-[0.7rem] lg:text-xs tracking-[0.12em] uppercase text-[#8a9bc0] no-underline hover:text-[#00b4d8] transition-colors">Engagement</a></li>
            <li><a href="#contact" className="text-[0.7rem] lg:text-xs tracking-[0.12em] uppercase text-[#8a9bc0] no-underline hover:text-[#00b4d8] transition-colors">Contact</a></li>
          </ul>
        </nav>

        {/* Hero Section */}
        <section className="relative min-h-screen flex flex-col justify-center px-4 sm:px-8 lg:px-16 pt-32 pb-16 overflow-hidden" id="home">
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_30%,rgba(0,180,216,0.08)_0%,transparent_60%),radial-gradient(ellipse_40%_60%_at_10%_70%,rgba(46,134,222,0.1)_0%,transparent_60%),radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(13,26,53,0.9)_0%,#0a0f1e_100%)]"></div>

          {/* DNA Decoration */}
          <div className="absolute right-[8%] top-1/2 -translate-y-1/2 opacity-12 z-1 hidden lg:block">
            <svg viewBox="0 0 200 500" width="320" height="520" fill="none">
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00b4d8" />
                  <stop offset="100%" stopColor="#2e86de" />
                </linearGradient>
              </defs>
              <path d="M40,10 Q160,60 40,110 Q160,160 40,210 Q160,260 40,310 Q160,360 40,410 Q160,460 40,490" stroke="url(#g1)" strokeWidth="2.5" fill="none" />
              <path d="M160,10 Q40,60 160,110 Q40,160 160,210 Q40,260 160,310 Q40,360 160,410 Q40,460 160,490" stroke="url(#g1)" strokeWidth="2.5" fill="none" />
              {[35, 135, 235, 335, 435].map((y, i) => (
                <React.Fragment key={i}>
                  <line x1="100" y1={y} x2="100" y2={y + 50} stroke="#00b4d8" strokeWidth="1.2" opacity="0.6" />
                  <circle cx="100" cy={y} r="4" fill="#00b4d8" opacity="0.6" />
                  <circle cx="100" cy={y + 50} r="4" fill="#2e86de" opacity="0.6" />
                </React.Fragment>
              ))}
            </svg>
          </div>

          <div className="relative z-2 max-w-[720px]">
            <p className="text-[0.65rem] sm:text-xs tracking-[0.3em] uppercase text-[#00b4d8] mb-6 opacity-0 animate-[fadeUp_0.8s_0.2s_ease_forwards]">
              Entreprise Algérienne · Oran · Algérie
            </p>
            <h1 className="font-['Cormorant_Garamond',serif] text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light leading-[1.08] tracking-[-0.01em] mb-6 opacity-0 animate-[fadeUp_0.9s_0.4s_ease_forwards]">
              <em className="italic text-[#00b4d8] not-italic">L'innovation</em>
              <br />
              au service du
              <br />
              diagnostic pathologique
            </h1>
            <p className="font-['Cormorant_Garamond',serif] text-lg sm:text-xl italic text-[#c9a84c] tracking-[0.04em] mb-8 opacity-0 animate-[fadeUp_0.9s_0.55s_ease_forwards]">
              Dispositifs médicaux pour le diagnostic in vitro en anatomie pathologique
            </p>
            <p className="text-sm sm:text-base leading-relaxed text-[rgba(232,237,247,0.7)] max-w-[560px] mb-12 opacity-0 animate-[fadeUp_0.9s_0.7s_ease_forwards]">
              DIAGNOSPHÈRE est spécialisée dans l'importation, l'homologation et la distribution de dispositifs médicaux IVD,
              fondée par un pathologiste dédié à l'excellence diagnostique en Algérie.
            </p>
            <div className="flex flex-wrap gap-4 sm:gap-5 opacity-0 animate-[fadeUp_0.9s_0.85s_ease_forwards]">
              <a
                href="#expertise"
                className="px-5 sm:px-7 py-2.5 sm:py-3 bg-[#00b4d8] text-[#0a0f1e] text-xs sm:text-sm font-medium tracking-[0.15em] uppercase no-underline transition-all hover:bg-white hover:-translate-y-0.5"
                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
              >
                Découvrir nos produits
              </a>
              <a
                href="#contact"
                className="px-5 sm:px-7 py-2.5 sm:py-3 bg-transparent text-[#e8edf7] text-xs sm:text-sm font-medium tracking-[0.15em] uppercase border border-[rgba(232,237,247,0.25)] no-underline transition-all hover:border-[#00b4d8] hover:text-[#00b4d8]"
              >
                Nous contacter
              </a>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="relative z-2 grid grid-cols-1 md:grid-cols-3 gap-px bg-[rgba(46,134,222,0.15)] border-t border-[rgba(46,134,222,0.15)] mt-16 lg:mt-20 opacity-0 animate-[fadeUp_0.9s_1s_ease_forwards]">
            {[
              { number: "10M", label: "Capital social de départ", unit: "DZD" },
              { number: "IVD", label: "Diagnostic in vitro certifié" },
              { number: "100%", label: "Chaîne du froid garantie" },
            ].map((stat, idx) => (
              <div key={idx} className="p-4 sm:p-5 lg:p-7 bg-[rgba(13,26,53,0.6)] backdrop-blur">
                <div className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl lg:text-4xl font-light text-[#00b4d8]">
                  {stat.number} {stat.unit && <span className="text-sm sm:text-base">{stat.unit}</span>}
                </div>
                <div className="text-[0.6rem] sm:text-xs tracking-[0.12em] uppercase text-[#8a9bc0] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* About Section avec Login intégré */}
        <section id="about" className="relative z-1 px-4 sm:px-8 lg:px-16 py-16 lg:py-24 bg-gradient-to-br from-[rgba(13,26,53,0.8)] to-[rgba(10,15,30,0.95)] border-t border-[rgba(46,134,222,0.1)]">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            <div className="reveal">
              <p className="text-[0.6rem] sm:text-xs tracking-[0.35em] uppercase text-[#00b4d8] mb-3">À propos</p>
              <h2 className="font-['Cormorant_Garamond',serif] text-3xl sm:text-4xl lg:text-5xl font-light leading-tight mb-6">
                DIAGNOSPHÈRE,
                <br />
                <em className="italic text-[#c9a84c] not-italic">qui sommes-nous ?</em>
              </h2>
              <div className="divider"></div>
              <div className="space-y-4 text-sm sm:text-base text-[rgba(232,237,247,0.72] leading-relaxed">
                <p>
                  <strong className="text-white font-medium">SARL DIAGNOSPHÈRE</strong> est une entreprise algérienne
                  récemment fondée par un pathologiste expérimenté, dotée d'un capital social de départ de{" "}
                  <strong className="text-white font-medium">10 000 000 DZD</strong>. Elle est entièrement dédiée à
                  l'innovation dans le domaine du diagnostic médical.
                </p>
                <p>
                  Notre mission : fournir des solutions diagnostiques fiables et précises, tout en assurant une
                  disponibilité régulière et permanente des réactifs dans le strict respect de la chaîne du froid.
                </p>
                <p>
                  Nous sommes fiers de collaborer avec des{" "}
                  <strong className="text-white font-medium">fabricants internationaux reconnus</strong> pour leur
                  excellence dans la production d'anticorps spécifiques adaptés aux besoins de l'anatomopathologie.
                </p>
              </div>
            </div>

            <div className="reveal">
              {/* Carte de connexion intégrée */}
              {isLoggedIn ? (
                <div className="user-profile">
                  <div className="user-avatar">
                    <i className="fas fa-user-md"></i>
                  </div>
                  <h3 className="login-title">Bienvenue</h3>
                  <p className="user-email">{JSON.parse(localStorage.getItem("user") || "{}")?.email || "Utilisateur"}</p>
                  <button onClick={handleLogout} className="logout-button">
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="login-card">
                  <div className="diagnosphere-logo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#3ecf8e" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="diagnosphere-title">DIAGNOSPHÈRE</span>
                  </div>
                  
                  <p className="login-subtitle">Connectez-vous à votre espace de gestion</p>

                  <form onSubmit={handleLogin}>
                    {error && (
                      <div className="login-error">
                        <i className="fas fa-exclamation-circle mr-2"></i>
                        {error}
                      </div>
                    )}

                    {/* Sélecteur de type de compte */}
                    <div className="account-type-selector">
                      <button
                        type="button"
                        onClick={() => setUserType('merchant')}
                        className={`account-type-btn ${userType === 'merchant' ? 'active' : ''}`}
                      >
                        <span className="btn-indicator" />
                        <span>DIAGNOSPHÈRE</span>
                        {userType === 'merchant' && <span className="btn-bg" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setUserType('client')}
                        className={`account-type-btn ${userType === 'client' ? 'active' : ''}`}
                      >
                        <span className="btn-indicator" />
                        <span>Médecin</span>
                        {userType === 'client' && <span className="btn-bg" />}
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Identifiant"
                      className="login-input"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      required
                      disabled={loading}
                    />

                    <input
                      type="password"
                      placeholder="Mot de passe"
                      className="login-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />

                    <input type="hidden" value={merchantId} />

                    <button 
                      type="submit" 
                      className="login-button"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Connexion...
                        </>
                      ) : (
                        "Se connecter"
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Expertise Section */}
        <section id="expertise" className="px-4 sm:px-8 lg:px-16 py-16 lg:py-24 bg-[#0a0f1e]">
          <div className="max-w-[1200px] mx-auto">
            <div className="mb-12 lg:mb-16 reveal">
              <p className="text-[0.6rem] sm:text-xs tracking-[0.35em] uppercase text-[#00b4d8] mb-3">Notre expertise</p>
              <h2 className="font-['Cormorant_Garamond',serif] text-3xl sm:text-4xl lg:text-5xl font-light leading-tight">
                Des solutions de <em className="italic text-[#c9a84c] not-italic">pointe</em>
                <br />
                pour l'anatomopathologie
              </h2>
              <div className="divider"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {[
                {
                  icon: <circle cx="24" cy="24" r="18" />,
                  title: "Anticorps Spécifiques",
                  desc: "Gamme étendue d'anticorps primaires et secondaires produits par des fabricants internationaux de référence, adaptés aux protocoles d'immunohistochimie les plus exigeants.",
                },
                {
                  icon: <rect x="8" y="4" width="32" height="40" rx="2" />,
                  title: "Réactifs & Kits IVD",
                  desc: "Large variété de matériels et réactifs essentiels pour l'identification et l'analyse des tissus associés à des pathologies complexes.",
                },
                {
                  icon: <path d="M8 36 L8 20 Q8 8 20 8 L28 8 Q40 8 40 20 L40 36" />,
                  title: "Chaîne du Froid",
                  desc: "Système logistique certifié garantissant le maintien de la chaîne du froid de manière stricte et permanente, assurant l'intégrité de chaque produit.",
                },
                {
                  icon: <circle cx="24" cy="16" r="10" />,
                  title: "Homologation & Conformité",
                  desc: "Expertise complète dans les procédures d'homologation des dispositifs médicaux sur le marché algérien, dans le respect total des réglementations.",
                },
                {
                  icon: <path d="M6 24 L18 36 L42 12" />,
                  title: "Contrôle Qualité",
                  desc: "Chaque produit importé est soumis à un contrôle qualité rigoureux. Nos standards répondent aux normes les plus strictes.",
                },
                {
                  icon: <circle cx="16" cy="20" r="8" />,
                  title: "Partenariats Internationaux",
                  desc: "Collaboration étroite avec des fabricants internationaux reconnus pour leur excellence, nous permettant d'offrir les technologies les plus avancées.",
                },
              ].map((card, idx) => (
                <div
                  key={idx}
                  className="relative p-6 sm:p-8 lg:p-10 bg-[rgba(13,26,53,0.7)] border border-[rgba(46,134,222,0.12)] overflow-hidden hover:bg-[rgba(26,58,110,0.35)] hover:-translate-y-1 transition-all group reveal"
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00b4d8] to-[#2e86de] scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 mb-4 sm:mb-6 text-[#00b4d8]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                    {card.icon}
                  </svg>
                  <h3 className="font-['Cormorant_Garamond',serif] text-lg sm:text-xl font-normal mb-2 sm:mb-3 text-white">{card.title}</h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#8a9bc0]">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Engagement Section */}
        <section id="engagement" className="px-4 sm:px-8 lg:px-16 py-16 lg:py-24 bg-gradient-to-br from-[rgba(13,26,53,0.9)] to-[rgba(10,15,30,0.98)] border-y border-[rgba(46,134,222,0.1)]">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            <div className="reveal">
              <p className="text-[0.6rem] sm:text-xs tracking-[0.35em] uppercase text-[#00b4d8] mb-3">Notre engagement</p>
              <h2 className="font-['Cormorant_Garamond',serif] text-3xl sm:text-4xl lg:text-5xl font-light leading-tight mb-6">
                Qualité, fiabilité
                <br />
                et <em className="italic text-[#c9a84c] not-italic">précision</em>
              </h2>
              <div className="divider"></div>

              <div className="space-y-4 sm:space-y-5 mt-6 sm:mt-8">
                {[
                  { num: "01", title: "Excellence Diagnostique", desc: "Des solutions qui répondent aux enjeux critiques de l'anatomopathologie moderne, sélectionnées par des experts du domaine." },
                  { num: "02", title: "Disponibilité Permanente", desc: "Assurer une disponibilité régulière et permanente des réactifs pour ne jamais interrompre votre flux de travail diagnostique." },
                  { num: "03", title: "Intégrité des Produits", desc: "Respect strict de la chaîne du froid de l'importation jusqu'à la livraison finale dans vos laboratoires." },
                  { num: "04", title: "Support Technique", desc: "Accompagnement expert et support technique spécialisé en anatomopathologie pour optimiser vos résultats diagnostiques." },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3 sm:gap-4">
                    <div className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-light text-[rgba(0,180,216,0.25)] min-w-[2rem]">
                      {item.num}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-medium tracking-[0.05em] text-white mb-1">{item.title}</h4>
                      <p className="text-xs sm:text-sm text-[#8a9bc0] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal">
              <div className="p-6 sm:p-8 lg:p-10 bg-[rgba(0,180,216,0.06)] border border-[rgba(0,180,216,0.15)] relative">
                <div className="font-['Cormorant_Garamond',serif] text-7xl sm:text-8xl text-[rgba(0,180,216,0.15)] absolute -top-3 left-4 leading-none">
                  &ldquo;
                </div>
                <p className="font-['Cormorant_Garamond',serif] text-base sm:text-lg lg:text-xl italic leading-relaxed text-[#e8edf7] relative z-1">
                  Chez Diagnosphère, nous plaçons la qualité, la fiabilité et la précision au cœur de notre démarche.
                  Chaque produit que nous importons est rigoureusement sélectionné et testé pour garantir sa performance
                  et sa spécificité.
                </p>
                <cite className="block mt-4 sm:mt-6 text-[0.65rem] sm:text-xs tracking-[0.1em] uppercase text-[#00b4d8] not-italic">
                  Abdeljalil Ahmed ADDA — Gérant, DIAGNOSPHÈRE
                </cite>
              </div>

              <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-[rgba(0,180,216,0.05)] border border-[rgba(0,180,216,0.12)]">
                <p className="text-[0.65rem] sm:text-xs tracking-[0.1em] uppercase text-[#00b4d8] mb-3 sm:mb-4">Nos fabricants partenaires</p>
                <p className="text-xs sm:text-sm text-[#8a9bc0] leading-relaxed">
                  Nous collaborons avec des fabricants internationaux reconnus pour leur excellence dans la production
                  d'anticorps spécifiques et de réactifs de haute qualité adaptés aux besoins de l'anatomopathologie
                  contemporaine.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="px-4 sm:px-8 lg:px-16 py-16 lg:py-24 bg-[#0a0f1e]">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            <div className="reveal">
              <p className="text-[0.6rem] sm:text-xs tracking-[0.35em] uppercase text-[#00b4d8] mb-3">Contact</p>
              <h2 className="font-['Cormorant_Garamond',serif] text-3xl sm:text-4xl lg:text-5xl font-light leading-tight mb-6">
                Entrons en
                <br />
                <em className="italic text-[#c9a84c] not-italic">contact</em>
              </h2>
              <div className="divider"></div>

              <div className="space-y-4 sm:space-y-5 mt-6 sm:mt-8">
                {/* Address */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border border-[rgba(0,180,216,0.3)] flex items-center justify-center flex-shrink-0 text-[#00b4d8]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0] mb-1">Adresse</h5>
                    <p className="text-xs sm:text-sm text-[#e8edf7] leading-relaxed">
                      Plan de découpage Moustakbel 1, N° 155
                      <br />
                      Bir El Djir, Oran – Algérie
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border border-[rgba(0,180,216,0.3)] flex items-center justify-center flex-shrink-0 text-[#00b4d8]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.14 12 19.79 19.79 0 0 1 1.07 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0] mb-1">Téléphone</h5>
                    <a href="tel:+213549542059" className="text-xs sm:text-sm text-[#e8edf7] no-underline hover:text-[#00b4d8] block">
                      +213 (0) 549 54 20 59
                    </a>
                    <a href="tel:+213770211271" className="text-xs sm:text-sm text-[#e8edf7] no-underline hover:text-[#00b4d8] block">
                      +213 (0) 770 21 12 71
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border border-[rgba(0,180,216,0.3)] flex items-center justify-center flex-shrink-0 text-[#00b4d8]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0] mb-1">Email</h5>
                    <a href="mailto:contact@diagnosphere-dz.com" className="text-xs sm:text-sm text-[#e8edf7] no-underline hover:text-[#00b4d8]">
                      contact@diagnosphere-dz.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="reveal">
              <p className="text-xs sm:text-sm text-[#8a9bc0] mb-3 mt-8 lg:mt-12">Envoyez-nous un message</p>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <label className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0]">Prénom</label>
                    <input
                      type="text"
                      name="prenom"
                      value={formData.prenom}
                      onChange={handleInputChange}
                      placeholder="Votre prénom"
                      className="w-full bg-[rgba(13,26,53,0.7)] border border-[rgba(46,134,222,0.2)] px-3 sm:px-4 py-2 sm:py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00b4d8]"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0]">Nom</label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      placeholder="Votre nom"
                      className="w-full bg-[rgba(13,26,53,0.7)] border border-[rgba(46,134,222,0.2)] px-3 sm:px-4 py-2 sm:py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00b4d8]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0]">Email professionnel</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@exemple.com"
                    className="w-full bg-[rgba(13,26,53,0.7)] border border-[rgba(46,134,222,0.2)] px-3 sm:px-4 py-2 sm:py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00b4d8]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0]">Établissement / Laboratoire</label>
                  <input
                    type="text"
                    name="etablissement"
                    value={formData.etablissement}
                    onChange={handleInputChange}
                    placeholder="Nom de votre structure"
                    className="w-full bg-[rgba(13,26,53,0.7)] border border-[rgba(46,134,222,0.2)] px-3 sm:px-4 py-2 sm:py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00b4d8]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[0.6rem] sm:text-xs tracking-[0.15em] uppercase text-[#8a9bc0]">Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Décrivez votre besoin ou posez votre question…"
                    rows={4}
                    className="w-full bg-[rgba(13,26,53,0.7)] border border-[rgba(46,134,222,0.2)] px-3 sm:px-4 py-2 sm:py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-[#00b4d8] resize-vertical"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 sm:px-7 py-2.5 sm:py-3 bg-[#00b4d8] text-[#0a0f1e] text-xs sm:text-sm font-medium tracking-[0.15em] uppercase transition-all hover:bg-white hover:-translate-y-0.5"
                  style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}
                >
                  Envoyer le message
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-[rgba(5,8,16,0.98)] border-t border-[rgba(46,134,222,0.1)] px-4 sm:px-8 lg:px-16 py-6 sm:py-8">
          <div className="w-full mb-6">
            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(0,180,216,0.4)] to-transparent"></div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
            <div className="font-['Cormorant_Garamond',serif] text-base sm:text-lg tracking-[0.15em] text-white">
              DIAGNO<span className="text-[#00b4d8]">SPHÈRE</span>
            </div>
            <p className="text-xs sm:text-sm text-[#8a9bc0]">
              © 2025 SARL DIAGNOSPHÈRE · Bir El Djir, Oran, Algérie · Tous droits réservés
            </p>
            <p className="text-xs sm:text-sm text-[rgba(138,155,192,0.5)]">Fondée par un pathologiste</p>
          </div>
        </footer>

        {/* Signature */}
        <div className="text-center py-4 text-[#8a9bc0] text-xs border-t border-[rgba(46,134,222,0.1)]">
          <i className="fas fa-quote-right text-[#c9a84c] mr-2"></i>
          Abdeljalil Ahmed ADDA, gérant : « fiabilité, précision, innovation »
        </div>
      </div>
    </>
  );
}