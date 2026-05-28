"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-[90vh] bg-[#031018] flex flex-col items-center justify-center relative overflow-hidden px-6 pt-20">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes swim {
          0% { transform: translateY(0px) translateX(-10px) rotate(-2deg); }
          50% { transform: translateY(-20px) translateX(10px) rotate(2deg); }
          100% { transform: translateY(0px) translateX(-10px) rotate(-2deg); }
        }
        @keyframes bubbles {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(-20vh) scale(1.5); opacity: 0; }
        }
        .animate-trout {
          animation: swim 6s ease-in-out infinite;
        }
        .bubble {
          position: absolute;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(114, 221, 253, 0.2) 60%, transparent 80%);
          border-radius: 50%;
          border: 1px solid rgba(114, 221, 253, 0.3);
          box-shadow: 0 0 10px rgba(114, 221, 253, 0.2), inset 0 0 5px rgba(255, 255, 255, 0.5);
          animation: bubbles 8s linear infinite;
        }
      `}} />

      {/* Bubbles Background */}
      {mounted && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {[...Array(15)].map((_, i) => (
            <div 
              key={i} 
              className="bubble"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 40 + 10}px`,
                height: `${Math.random() * 40 + 10}px`,
                animationDuration: `${Math.random() * 5 + 5}s`,
                animationDelay: `${Math.random() * 5}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
        
        {/* Animated Trout Image */}
        <div className="relative w-[300px] md:w-[450px] aspect-[16/8] mb-4 md:mb-8 animate-trout filter drop-shadow-[0_20px_30px_rgba(114,221,253,0.15)]">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6az_W5rdEt8WkOzLnn861EIuB2tv1E9ZBuYuxXAnLFmG7ZsCCb0WyuI___JpO7YjI9Vf_XYBLXYanCVvdJyrbf-CarB6-5xxisc34AV5zB1gV5AElNc-POwd_DAA12ADx0vUX87WKN2GVXZapRsMugASCSZsBjri-8d9uI957NqfLv1Hau8-DgJfLrNJoRtSKwJo6uFM1V-GDVCSznDSww8vBl8jD_s-iPkmhUcOhQ6ekndTbbBSJCBon4pCpkvihVwAcuF4JCTVc"
            alt="Lost Rainbow Trout"
            className="w-full h-full object-contain mix-blend-screen transition-all duration-700 pointer-events-none"
            style={{ 
              WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 50%, black 40%, transparent 100%)",
              maskImage: "radial-gradient(ellipse 65% 55% at 50% 50%, black 40%, transparent 100%)"
            }}
          />
          {/* Subtle glow behind trout */}
          <div className="absolute inset-0 bg-[#72ddfd]/20 blur-[60px] -z-10 rounded-full" />
        </div>

        <h1 className="font-headline text-8xl md:text-9xl font-black text-on-surface tracking-tighter mb-2 opacity-90" style={{ textShadow: "0 0 40px rgba(114,221,253,0.3)" }}>
          404
        </h1>
        
        <h2 className="font-headline text-2xl md:text-4xl font-bold text-primary mb-6">
          Swimming in the wrong current.
        </h2>
        
        <p className="font-body text-on-surface-variant text-lg md:text-xl mb-10 max-w-lg leading-relaxed">
          The page you're looking for has drifted downstream or doesn't exist in our waters.
        </p>
        
        <Link 
          href="/"
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-primary-container text-on-primary-container rounded-xl font-headline font-bold tracking-widest uppercase transition-all duration-300 hover:brightness-110 hover:shadow-[0_0_30px_rgba(114,221,253,0.4)] hover:-translate-y-1"
        >
          <span className="material-symbols-outlined transform group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          Swim Upstream
        </Link>
      </div>
    </div>
  );
}
