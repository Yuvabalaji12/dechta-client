import { ArrowLeft, Search, MapPin, Navigation, Map, Shield, Phone, MessageCircle, Star, Clock, CheckCircle2, Ticket, Play, Info, X, ChevronRight, BrickWall, SprayCan, PaintBucket, Snowflake, Hammer, Zap, HardHat, Flame, User, Mic, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { serviceData } from '../data/products';

export default function HireWorkerPage({ onBack }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef([]);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);

    const [status, setStatus] = useState('8 professionals found nearby');
    const [searchQuery, setSearchQuery] = useState('');
    const [workDescription, setWorkDescription] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [bookedDetails, setBookedDetails] = useState(null);
    const [activeCategory, setActiveCategory] = useState('all');

    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerIntervalRef.current);
        }
    };

    const deleteRecording = () => {
        setAudioUrl(null);
        setRecordingTime(0);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getIconForCategory = (key) => {
        const icons = {
            'cleaning': <SprayCan className="w-5 h-5" />,
            'paint': <PaintBucket className="w-5 h-5" />,
            'ac': <Snowflake className="w-5 h-5" />,
            'carpenter': <Hammer className="w-5 h-5" />,
            'electrician': <Zap className="w-5 h-5" />,
            'construction': <HardHat className="w-5 h-5" />,
            'mason': <BrickWall className="w-5 h-5" />,
            'fabricator': <Flame className="w-5 h-5" />
        };
        return icons[key] || <User className="w-5 h-5" />;
    };

    const confirmWorkerBooking = (category, proName) => {
        const bId = Math.floor(1000 + Math.random() * 9000);
        let taskDesc = workDescription.trim();
        
        if (audioUrl) {
            taskDesc = taskDesc ? `${taskDesc} (Voice note attached)` : "Voice note attached";
        } else if (!taskDesc) {
            taskDesc = `General ${category} Work`;
        }
        
        setBookedDetails({
            id: bId,
            proName: proName,
            category: category,
            task: taskDesc,
            hasVoice: !!audioUrl
        });
        
        setShowSuccessModal(true);
        setWorkDescription('');
        setAudioUrl(null);
    };

    const addRandomWorkers = useCallback(async (category = 'all') => {
        if (!mapInstance.current) return;
        
        try {
            const L = (await import('leaflet')).default;
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];
            
            const count = 8;
            const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981'];
            const center = [13.0827, 80.2707];

            for (let i = 0; i < count; i++) {
                const lat = center[0] + (Math.random() - 0.5) * 0.04;
                const lng = center[1] + (Math.random() - 0.5) * 0.04;
                const color = colors[Math.floor(Math.random() * 4)];
                
                const icon = L.divIcon({
                    html: `<div style="background:${color}; width:30px; height:30px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 6px rgba(0,0,0,0.3);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                           </div>`,
                    className: 'worker-marker',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                const displayCategory = category === 'all' ? 'Professional' : category.charAt(0).toUpperCase() + category.slice(1);
                const proName = `Pro #${i + 1}`;

                const marker = L.marker([lat, lng], { icon }).addTo(mapInstance.current);
                
                const popupContent = document.createElement('div');
                popupContent.className = 'text-center p-2 min-w-[130px]';
                popupContent.innerHTML = `
                    <div class="font-black text-sm mb-1 text-gray-900">${displayCategory} ${proName}</div>
                    <div class="text-xs text-gray-500 mb-3 flex items-center justify-center gap-1 font-medium">
                        <svg class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 
                        2 mins away
                    </div>
                `;
                const bookBtn = document.createElement('button');
                bookBtn.className = 'bg-yellow-400 text-black text-xs font-bold px-4 py-2.5 rounded-lg w-full hover:scale-105 transition-transform shadow-md';
                bookBtn.innerText = 'Book Now';
                bookBtn.onclick = () => confirmWorkerBooking(displayCategory, proName);
                popupContent.appendChild(bookBtn);

                marker.bindPopup(popupContent);
                markersRef.current.push(marker);
            }
        } catch (err) {
            console.error("Marker rendering failed:", err);
        }
    }, [workDescription]);

    const initMap = useCallback(async () => {
        if (typeof window === 'undefined' || !mapRef.current) return;
        try {
            const L = (await import('leaflet')).default;
            await import('leaflet/dist/leaflet.css');
            
            if (mapInstance.current) {
                mapInstance.current.remove();
            }

            const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([13.0827, 80.2707], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
            
            const userPulseDiv = document.createElement('div');
            userPulseDiv.className = 'w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse';
            
            const userIcon = L.divIcon({ 
                className: 'user-pulse', 
                html: userPulseDiv.outerHTML,
                iconSize: [20, 20], 
                iconAnchor: [10, 10] 
            });
            L.marker([13.0827, 80.2707], { icon: userIcon }).addTo(map);
            mapInstance.current = map;
            addRandomWorkers();
        } catch (error) {
            console.error("Map initialization failed:", error);
        }
    }, [addRandomWorkers]);

    useEffect(() => {
        initMap();
        return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
    }, []);

    const filterMap = (category) => {
        setActiveCategory(category);
        setStatus(`Finding ${category} pros...`);
        
        setTimeout(() => {
            addRandomWorkers(category);
            setStatus(`8 ${category} pros found`);
        }, 800);
    };

    const filteredKeys = Object.keys(serviceData).filter(k => {
        if (!searchQuery) return true;
        return (serviceData[k].title || k).toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <main className="font-sans min-h-screen bg-gray-50 dark:bg-slate-950">
            <div className="hidden lg:block h-32"></div>

            <div className="lg:max-w-7xl lg:mx-auto lg:px-4 lg:pb-12 h-[calc(100vh-8.5rem)] lg:h-[700px]">
                <div className="relative flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-slate-900 lg:rounded-[2.5rem] lg:shadow-2xl lg:border lg:border-gray-100 lg:dark:border-slate-800">
                    
                    <div className="w-full md:w-[380px] h-[55%] md:h-full bg-white dark:bg-slate-900 flex flex-col order-2 md:order-1 border-t md:border-t-0 md:border-r border-gray-100 dark:border-slate-800 z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.05)] md:shadow-none">
                        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white leading-tight">
                                <span className="w-8 h-8 md:w-10 md:h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-black shadow-sm">
                                    <Map className="w-4 h-4 md:w-5 md:h-5" />
                                </span>
                                Find Professionals
                            </h3>
                            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>

                        <div className="p-4 md:p-6 space-y-3 shrink-0">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search workers (e.g. Mason, Loadman)..." 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2.5 md:py-3 text-sm font-bold focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white transition-all shadow-inner" 
                                />
                            </div>
                                                        <div className="relative flex flex-col gap-2">
                                <div className="relative group flex items-center gap-2">
                                    <input type="text" 
                                        placeholder={isRecording ? "Recording audio..." : "Describe the work (e.g. Need to lift heavy appliances)..."} 
                                        value={workDescription}
                                        onChange={e => setWorkDescription(e.target.value)}
                                        disabled={isRecording}
                                        className={`flex-1 bg-white dark:bg-slate-900 border ${isRecording ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 dark:border-slate-700'} rounded-xl px-4 py-2.5 md:py-3 text-sm font-medium focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white transition-all shadow-sm`} 
                                    />
                                    
                                    {!audioUrl ? (
                                        <button 
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`p-2.5 md:p-3 rounded-xl transition-all shadow-md flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'}`}
                                            title={isRecording ? "Stop Recording" : "Record Voice Note"}
                                        >
                                            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 rounded-xl px-3 py-2 flex-1 animate-in slide-in-from-right-4 duration-300">
                                            <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
                                            <button 
                                                onClick={togglePlayback}
                                                className="w-8 h-8 flex items-center justify-center bg-cyan-500 text-white rounded-lg shadow-sm hover:scale-105 transition-transform"
                                            >
                                                {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current translate-x-0.5" />}
                                            </button>
                                            <span className="text-[10px] font-black text-cyan-700 dark:text-cyan-400 uppercase tracking-widest flex-1">Voice note attached</span>
                                            <button 
                                                onClick={deleteRecording}
                                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                {isRecording && (
                                    <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20 animate-in fade-in duration-300">
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1 h-3 items-center">
                                                {[1,2,3,4,5].map(i => (
                                                    <div key={i} className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: `${Math.random() * 100 + 20}%`, animationDelay: `${i * 0.1}s` }} />
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-black text-red-600 dark:text-red-400 tracking-[0.2em] uppercase">Recording...</span>
                                        </div>
                                        <span className="text-xs font-black text-red-600 dark:text-red-400 font-mono tracking-widest">{formatTime(recordingTime)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 md:overflow-y-auto px-4 md:px-6 pb-28 md:pb-4 grid grid-cols-2 md:grid-cols-1 gap-3 md:custom-scrollbar">
                            {filteredKeys.length > 0 ? filteredKeys.map(key => (
                                <div 
                                    key={key} 
                                    onClick={() => filterMap(key)} 
                                    className={`flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-3 p-3 rounded-xl cursor-pointer transition-all border ${activeCategory === key ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'hover:bg-gray-50 dark:hover:bg-slate-800 border-transparent hover:border-gray-200 dark:hover:border-slate-700'} group`}
                                >
                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all ${activeCategory === key ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:shadow-sm'}`}>
                                        {getIconForCategory(key)}
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <h4 className={`font-bold text-[11px] md:text-sm dark:text-white capitalize ${activeCategory === key ? 'text-blue-700' : ''}`}>{serviceData[key].title || key}</h4>
                                        <div className="hidden md:flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-bold">Available</span>
                                            <span className="text-xs text-gray-400">• {Math.floor(Math.random() * 8) + 2} nearby</span>
                                        </div>
                                    </div>
                                    <div className={`hidden md:flex w-8 h-8 rounded-full flex items-center justify-center transition-all ${activeCategory === key ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-slate-800 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black'}`}>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-10">
                                    <p className="text-gray-400 text-sm font-bold">No matching professionals found</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-slate-800 text-[10px] font-black text-center text-gray-400 uppercase tracking-widest bg-gray-50/50 dark:bg-slate-900/50 shrink-0">
                            <p>{status}</p>
                        </div>
                    </div>

                    <div className="flex-1 relative h-[45%] md:h-full bg-slate-100 overflow-hidden order-1 md:order-2">
                        <div ref={mapRef} className="w-full h-full z-10" />
                        
                        <div className="absolute bottom-6 md:bottom-10 right-4 md:right-10 flex flex-col gap-3 z-20">
                            <button className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-slate-900 rounded-xl md:rounded-2xl shadow-xl flex items-center justify-center border border-gray-100 dark:border-slate-800 hover:scale-110 active:scale-95 transition-all">
                                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                            </button>
                            <button onClick={() => mapInstance.current?.flyTo([13.0827, 80.2707], 15)} className="w-10 h-10 md:w-12 md:h-12 bg-black dark:bg-white text-white dark:text-black rounded-xl md:rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                                <Navigation className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        </div>

                        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white/20 flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-black dark:text-white uppercase tracking-widest whitespace-nowrap">Live Professionals Map</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showSuccessModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSuccessModal(false)}></div>
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] text-center max-w-sm w-full mx-4 shadow-2xl relative overflow-hidden animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-black mb-2 relative z-10 dark:text-white tracking-tight uppercase">Worker Assigned!</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 relative z-10 text-sm font-medium leading-relaxed">
                            <span className="font-bold text-black dark:text-white">{bookedDetails?.proName}</span> is heading to your location for: <br/>
                            <span className="italic">"{bookedDetails?.task}"</span>
                        </p>
                        <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl mb-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Booking ID</p>
                            <p className="font-black text-xl dark:text-white">#QC{bookedDetails?.id}</p>
                        </div>
                        <button 
                            onClick={() => setShowSuccessModal(false)} 
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
            
            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(0,0,0,0.1);
                        border-radius: 10px;
                    }
                    .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(255,255,255,0.1);
                    }
                    .leaflet-popup-content-wrapper {
                        border-radius: 1.5rem;
                        padding: 0;
                        overflow: hidden;
                    }
                    .leaflet-popup-content {
                        margin: 0;
                        width: auto !important;
                    }
                    .leaflet-popup-tip-container {
                        display: none;
                    }
                `}
            </style>
        </main>
    );
}
