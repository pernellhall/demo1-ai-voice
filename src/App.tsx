import React, { useState } from 'react';
import { DemoState, Lead } from './types';
import { VoiceAgent } from './components/VoiceAgent';
import { Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';

export default function App() {
  const [state, setState] = useState<DemoState>({
    step: 'capture',
    lead: null,
    scrapedKnowledge: '',
    iframeBlocked: false,
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', url: '' });
  const [bgLoaded, setBgLoaded] = useState(false);

  const handleStartDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
       // 2. SCRAPE BUSINESS KNOWLEDGE
       console.log('--- NEW DEMO LEAD ---', formData);
       const response = await axios.post('/api/scrape', { url: formData.url });
       let scrapedText = response.data.scrapedKnowledge;

       // 3. FALLBACK CATCH FOR EMPTY SITES (React/SPA sites that block scraping)
       if (!scrapedText || scrapedText.length < 50) {
           scrapedText = `[SYSTEM NOTE: The prospect's website text couldn't be fully read. Assume they are a successful, busy business in their respective industry. Validate their time is valuable, acknowledge that they likely have missed phone calls or a scattered pipeline, and transition directly into the pitch for the Automated Sales System.]`;
       }

       // Start the demo!
       setState({
         step: 'demo',
         lead: formData,
         scrapedKnowledge: scrapedText,
         iframeBlocked: false
       });
    } catch (err) {
       console.error("Failed to start demo", err);
       alert("Error generating the demo. Ensure the URL is valid.");
    } finally {
       setLoading(false);
    }
  };

  const endDemo = () => {
    setState({
      step: 'capture',
      lead: null,
      scrapedKnowledge: '',
      iframeBlocked: false,
    });
    setFormData({ name: '', phone: '', url: '' });
    setBgLoaded(false);
  };

  // Extract a clean business name from URL
  const domainName = state.lead?.url ? state.lead.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : 'your company';
  const rawUrl = state.lead?.url.startsWith('http') ? state.lead.url : `https://${state.lead?.url}`;

  const systemInstruction = `You are a high-ticket AI Sales Agent demonstrating your capabilities to the owner of "${domainName}".

CRITICAL DISTINCTION:
1. You are pitching an AI Voice Automation Service (Your product) TO the owner of "${domainName}" (The prospect). 
2. You are NOT an employee of "${domainName}" and "${domainName}" does NOT sell AI services. 
3. You use the scraped knowledge about "${domainName}" ONLY to prove that you understand their business and to explain how you (the AI) can help sell THEIR specific products or book THEIR specific services.

YOUR PERSONA & BEHAVIOR:
- You are a "Founder-Led" closer. Confident, empathetic, and direct.
- You convert their pain (missed calls, overworked, inconsistent pipeline) into the solution (hiring you, the AI agent, to answer calls 24/7).
- Price is positioned as an "Automation Investment" that pays for itself with one or two captured missed leads.
- Key Mentions required before closing: "Your AI automated system goes live in 48 hours. You work 1-on-1 directly with the founder and have access to the developer who designs, builds, and implements your App. This includes 30 days of VIP support followed by standard monthly support."

CRITICAL STARTING INSTRUCTION: 
When the connection opens, greet them EXACTLY like this (warmly):
"Hi ${state.lead?.name || 'there'}! I'm an AI automation agent. I've been reviewing your website, ${domainName}, and I'm calling to demonstrate how a system like me can capture your missed calls and grow your pipeline. How are you doing today?"

--- SCRAPED KNOWLEDGE BASE (Use this to understand what the prospect's business does) ---
${state.scrapedKnowledge}
--- END SCRAPED KNOWLEDGE BASE ---

CRITICAL CLOSING INSTRUCTION: If they ask to end the demo, OR if the user is completely silent and pauses for a long time (about 45 seconds), you MUST end the conversation by saying EXACTLY this:
"Bye. This completes your virtual agent demo. Feedback helps us improve my performance, so please let us know how I did. Thank you!"
Do not ask any follow up questions after the closing statement.

Keep your answers extremely concise, natural, and conversational, suitable for voice output.`;

  return (
    <div className="w-full min-h-[100dvh] relative bg-zinc-950 font-sans overflow-hidden">
      
      {state.step === 'capture' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center min-h-[100dvh]">
          {/* Main Site Background Image */}
          <img 
            src="https://picsum.photos/seed/agency/1920/1080?blur=4" 
            alt="Background" 
            className="absolute inset-0 w-full h-[100dvh] object-cover opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-black/60 to-black/90" />
          
          <div className="relative z-20 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl mx-4">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight text-center">Experience AI.</h1>
            <p className="text-white/70 mb-8 mt-4 font-medium text-center text-sm">Enter your details and watch your website instantly transform into an interactive AI voice agent</p>

            <form onSubmit={handleStartDemo} className="flex flex-col gap-5">
               <div className="flex flex-col gap-1.5">
                 <label className="text-white/80 text-xs tracking-wider uppercase font-bold ml-1">Name</label>
                 <input 
                   required 
                   value={formData.name} 
                   onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                   className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" 
                   placeholder="John Doe" 
                 />
               </div>
               <div className="flex flex-col gap-1.5">
                 <label className="text-white/80 text-xs tracking-wider uppercase font-bold ml-1">Phone Number</label>
                 <input 
                   required 
                   type="tel"
                   value={formData.phone} 
                   onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                   className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" 
                   placeholder="+1 (555) 000-0000" 
                 />
               </div>
               <div className="flex flex-col gap-1.5">
                 <label className="text-white/80 text-xs tracking-wider uppercase font-bold ml-1">Website URL</label>
                 <input 
                   required 
                   type="url"
                   value={formData.url} 
                   onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                   className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" 
                   placeholder="https://yourcompany.com" 
                 />
               </div>

               <button 
                 disabled={loading}
                 className="mt-4 bg-white hover:bg-gray-100 text-black font-bold py-4 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
               >
                 {loading ? <Loader2 className="animate-spin w-5 h-5 text-blue-600" /> : 'Launch Demo'}
                 {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
               </button>
               <div className="mt-4 text-center">
                  <p className="text-[10px] text-white/20 font-mono uppercase tracking-[0.2em]">Build Version: 2.0.0</p>
               </div>
            </form>
          </div>
        </div>
      )}

      {state.step === 'demo' && (
        <div className="absolute inset-0 z-10 min-h-[100dvh] bg-white">
           
           <iframe 
             src={rawUrl}
             title="Prospect Website"
             className="absolute inset-0 w-full h-[100dvh] border-0 z-0"
             sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
           />
           
           {/* Dark gradient overlay at the bottom so the voice agent UI is always visible over the site */}
           <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/80 to-transparent z-0 pointer-events-none" />

           {/* AI Voice Agent Overlay */}
           <VoiceAgent 
             systemInstruction={systemInstruction}
             onEndDemo={endDemo}
           />
        </div>
      )}

    </div>
  );
}
