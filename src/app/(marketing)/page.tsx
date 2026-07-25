import Link from "next/link";
import React from "react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 font-sans selection:bg-teal-500/30">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/20 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-emerald-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full border-b border-white/5 bg-slate-950/50 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-lg shadow-teal-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Ros<span className="text-teal-400">lanner</span>
            </span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-teal-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-teal-400 transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-teal-400 transition-colors">Pricing</a>
          </nav>
          <div className="flex gap-4 items-center">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-xl shadow-white/10 hover:bg-slate-100 hover:scale-105 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center pt-24 pb-20 text-center px-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-sm font-medium text-teal-300 mb-8 backdrop-blur-md animate-fade-in">
          <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-ping"></span>
          Roslanner 2.0 is now live
        </div>
        
        <h1 className="max-w-4xl text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-[1.1]">
          Intelligent Scheduling for <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-300 to-indigo-400">
            Modern Medical Wards
          </span>
        </h1>
        
        <p className="max-w-2xl text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed">
          Stop wrestling with spreadsheets. Roslanner&apos;s constraint-based engine balances staff well-being with strict patient care coverage, generating perfect rosters in seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md mx-auto">
          <Link 
            href="/signup"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-1 transition-all"
          >
            Start Planning Now
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <a href="#how-it-works" className="w-full sm:w-auto flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 px-8 py-4 text-base font-medium text-white backdrop-blur-md hover:bg-slate-800 transition-all">
            See how it works
          </a>
        </div>

        {/* Dashboard Preview / Mockup */}
        <div className="mt-16 relative w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-900/50 p-2 sm:p-4 backdrop-blur-xl shadow-2xl shadow-teal-900/20 group hover:shadow-teal-500/30 transition-all duration-700">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none rounded-2xl"></div>
          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
              </div>
            </div>
            {/* Mockup App Interface */}
            <div className="flex min-h-[400px]">
              {/* Sidebar */}
              <div className="w-48 border-r border-slate-800/50 p-4 hidden md:block">
                <div className="space-y-3">
                  <div className="h-2 w-1/2 bg-slate-800 rounded"></div>
                  <div className="h-8 w-full bg-teal-500/10 rounded border border-teal-500/20"></div>
                  <div className="h-8 w-full bg-slate-800/50 rounded"></div>
                  <div className="h-8 w-full bg-slate-800/50 rounded"></div>
                </div>
              </div>
              {/* Main Content */}
              <div className="flex-1 p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-slate-700 rounded"></div>
                    <div className="h-2 w-24 bg-slate-800 rounded"></div>
                  </div>
                  <div className="h-8 w-24 bg-teal-500/20 rounded-full border border-teal-500/30"></div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {/* Mock Roster Grid */}
                  {Array.from({ length: 35 }).map((_, i) => {
                    const isMorning = i % 3 === 0;
                    const isNight = i % 5 === 0;
                    const isAfternoon = i % 2 === 0;
                    return (
                      <div 
                        key={i} 
                        className={`h-12 rounded flex items-center justify-center border transition-all ${
                          isNight ? "bg-indigo-500/20 border-indigo-500/30" :
                          isMorning ? "bg-amber-500/20 border-amber-500/30" :
                          isAfternoon ? "bg-sky-500/20 border-sky-500/30" : "bg-slate-800/30 border-slate-800/50"
                        }`}
                      >
                        <div className={`w-3 h-1 rounded-full ${isNight ? "bg-indigo-400" : isMorning ? "bg-amber-400" : isAfternoon ? "bg-sky-400" : "bg-slate-700"}`}></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stats Section */}
      <section className="relative z-10 border-y border-white/5 bg-slate-900/30 backdrop-blur-sm w-full">
        <div className="w-full max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <h4 className="text-3xl font-bold text-white">100+</h4>
              <p className="text-sm text-slate-400">Hospitals utilizing Roslanner</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-3xl font-bold text-white">98%</h4>
              <p className="text-sm text-slate-400">Reduction in planning time</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-3xl font-bold text-teal-400">0</h4>
              <p className="text-sm text-slate-400">Hard constraint violations</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-3xl font-bold text-white">10k+</h4>
              <p className="text-sm text-slate-400">Shifts optimized monthly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 px-6 w-full">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-sm font-semibold text-teal-400 tracking-wide uppercase mb-3">Enterprise Features</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need to manage complex medical schedules.</h3>
            <p className="text-slate-400 text-lg">Roslanner takes the cognitive load off nursing managers, ensuring legal compliance and staff satisfaction simultaneously.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Advanced Constraint Engine",
                desc: "Automatically respect minimum rest periods, maximum consecutive working days, and precise role-based coverage rules.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )
              },
              {
                title: "One-Click AI Generation",
                desc: "Say goodbye to spreadsheets. Generate mathematically optimal monthly rosters in seconds with our bespoke scheduling algorithm.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )
              },
              {
                title: "Fairness Analytics",
                desc: "Ensure equitable distribution of grueling night shifts and precious weekend days off across all your staff members.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                )
              },
              {
                title: "Leave Management",
                desc: "Staff leave requests are deeply integrated. Approved leave forms a hard boundary the solver will never cross.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )
              },
              {
                title: "Real-time Interaction",
                desc: "Make manual tweaks to the generated roster and immediately see if your changes break compliance or fairness scores.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                )
              },
              {
                title: "Data Export",
                desc: "Publish your finalized rosters or export them directly to CSV for seamless integration with external HR systems.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                )
              }
            ].map((f, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-900/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-teal-400 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-teal-500/20 transition-all shadow-inner">
                  {f.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="relative z-10 py-24 px-6 bg-slate-900/30 border-y border-white/5 w-full">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How it works</h2>
            <p className="text-slate-400 text-lg">Three simple steps to the perfect hospital roster.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-1/4 left-1/6 w-2/3 h-0.5 bg-gradient-to-r from-teal-500/0 via-teal-500/50 to-teal-500/0 z-0"></div>
            
            {[
              {
                step: "01",
                title: "Define Wards & Staff",
                desc: "Set up your medical wards, assign staff members with their specific roles (e.g. Registered Nurse, Consultant), and log approved leave."
              },
              {
                step: "02",
                title: "Set Coverage Rules",
                desc: "Specify exact staffing requirements for Morning, Afternoon, and Night shifts. Configure maximum consecutive working days and rest periods."
              },
              {
                step: "03",
                title: "Generate & Publish",
                desc: "Let our engine compute thousands of possibilities to find the fairest, most compliant roster. Tweak manually if needed, then publish!"
              }
            ].map((step, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-950 border-2 border-teal-500/50 flex items-center justify-center text-xl font-bold text-teal-400 mb-6 shadow-lg shadow-teal-900/50">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-24 px-6 w-full">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-400 text-lg">Start planning immediately. No credit card required.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 md:p-10 backdrop-blur-sm">
              <h3 className="text-2xl font-semibold text-white mb-2">Starter</h3>
              <p className="text-slate-400 mb-6 text-sm">Perfect for single wards and small clinics.</p>
              <div className="mb-8">
                <span className="text-5xl font-bold text-white">$0</span>
                <span className="text-slate-500">/ forever</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm text-slate-300">
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Up to 2 Wards</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Up to 50 Staff Members</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Basic Constraint Engine</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Community Support</li>
              </ul>
              <Link href="/signup" className="block w-full py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-center text-white font-medium transition-colors">
                Get Started
              </Link>
            </div>
            
            {/* Pro Tier */}
            <div className="rounded-3xl border border-teal-500/50 bg-gradient-to-b from-teal-900/20 to-slate-900/50 p-8 md:p-10 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
              <h3 className="text-2xl font-semibold text-teal-400 mb-2">Enterprise</h3>
              <p className="text-slate-400 mb-6 text-sm">For hospitals with complex scaling needs.</p>
              <div className="mb-8">
                <span className="text-5xl font-bold text-white">$299</span>
                <span className="text-slate-500">/ month</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm text-slate-300">
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Unlimited Wards & Staff</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Advanced Fairness Analytics</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Custom Constraint Rules</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> 24/7 Priority Support</li>
              </ul>
              <Link href="/signup" className="block w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-center text-slate-950 font-bold transition-colors shadow-lg shadow-teal-500/20">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-6 border-t border-white/5 w-full">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-teal-900/20 pointer-events-none w-full"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to revolutionize your ward?</h2>
          <p className="text-xl text-slate-400 mb-10">Join the thousands of healthcare professionals who trust Roslanner to optimize their scheduling.</p>
          <Link 
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-slate-950 hover:scale-105 transition-all shadow-xl shadow-white/10"
          >
            Create Your First Roster
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-950 py-12 px-6 w-full">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-teal-500 to-emerald-400 text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-300 tracking-tight">Roslanner</span>
          </div>
          <div className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Roslanner Inc. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
