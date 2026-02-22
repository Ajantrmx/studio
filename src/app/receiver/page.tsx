
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Eye, ArrowLeft, Navigation, AlertTriangle, User, RefreshCw, Loader2 } from "lucide-react";
import { TrackingData } from "@/lib/tracking";
import { aiAnomalyAlertForReceiver, AnomalyAlertOutput } from "@/ai/flows/ai-anomaly-alert-for-receiver";
import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Badge } from "@/components/ui/badge";
import { useFirebase, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { doc } from "firebase/firestore";

export default function ReceiverPage() {
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const [inputCode, setInputCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [anomaly, setAnomaly] = useState<AnomalyAlertOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  // Ensure user is signed in anonymously to interact with Firestore
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Firestore Real-time listener
  const sessionDocRef = useMemoFirebase(() => {
    if (!firestore || !activeCode) return null;
    return doc(firestore, "trackerSessions", activeCode);
  }, [firestore, activeCode]);

  const { data: sessionData, isLoading: isSessionLoading, error: sessionError } = useDoc<any>(sessionDocRef);

  const handleConnect = useCallback(() => {
    if (inputCode.length < 6) return;
    setIsSearching(true);
    setActiveCode(inputCode.toUpperCase());
    
    // We'll let the useDoc hook handle the actual data fetching
    // Reset searching after a short delay or when data arrives
    setTimeout(() => setIsSearching(false), 1000);
  }, [inputCode]);

  // Handle errors or missing sessions
  useEffect(() => {
    if (activeCode && !isSessionLoading) {
      if (sessionError) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Takip oturumuna erişilemedi.",
        });
        setActiveCode(null);
      } else if (sessionData && !sessionData.isActive) {
        toast({
          variant: "destructive",
          title: "Oturum Sonlandı",
          description: "Bu takip kodu artık aktif değil.",
        });
        setActiveCode(null);
      } else if (!sessionData && activeCode.length === 6 && !isSearching) {
         toast({
          variant: "destructive",
          title: "Hata",
          description: "Geçersiz takip kodu.",
        });
        setActiveCode(null);
      }
    }
  }, [sessionData, isSessionLoading, sessionError, activeCode, isSearching, toast]);

  // AI Anomaly Detection
  const runAIAnalysis = useCallback(async (data: any) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const result = await aiAnomalyAlertForReceiver({
        senderCurrentLocation: { 
          lat: data.lastKnownLatitude, 
          lon: data.lastKnownLongitude, 
          timestamp: Date.now() 
        },
        senderLocationHistory: data.history || [],
        inactivityThresholdMinutes: 5,
        safeZoneThresholdMeters: 15,
        senderName: "Yakınınız"
      });
      setAnomaly(result);
    } catch (err) {
      console.error("AI Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  useEffect(() => {
    if (sessionData && sessionData.isActive) {
      runAIAnalysis(sessionData);
    }
  }, [sessionData, runAIAnalysis]);

  const mapImage = PlaceHolderImages.find(img => img.id === "map-background");

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="w-4 h-4 mr-1" /> Geri Dön
          </Link>
          <div className="flex items-center space-x-2">
            <Eye className="w-6 h-6 text-accent" />
            <h1 className="text-xl font-bold font-headline">Takip Paneli</h1>
          </div>
          <div className="w-20"></div> {/* Spacer */}
        </header>

        {!sessionData || !sessionData.isActive ? (
          <div className="flex flex-col items-center justify-center pt-12">
            <Card className="w-full max-w-md shadow-lg border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-headline">Takip Kodu Girin</CardTitle>
                <CardDescription>Size paylaşılan 6 haneli kodu girerek izlemeyi başlatın.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input 
                    placeholder="Örn: AB12CD" 
                    className="h-16 text-2xl text-center uppercase tracking-widest font-bold border-2 focus-visible:ring-accent"
                    maxLength={6}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  />
                </div>
                <Button 
                  onClick={handleConnect} 
                  disabled={isSearching || inputCode.length < 6 || isUserLoading}
                  className="w-full h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                >
                  {isSearching || isSessionLoading ? <RefreshCw className="animate-spin" /> : "Bağlan"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Area */}
            <Card className="lg:col-span-2 h-[500px] md:h-[600px] relative overflow-hidden border-2 shadow-xl">
              <div className="absolute inset-0 z-0">
                {mapImage && (
                  <Image 
                    src={mapImage.imageUrl} 
                    alt="Map" 
                    fill 
                    className="object-cover opacity-80 grayscale-[0.2]"
                    data-ai-hint={mapImage.imageHint}
                  />
                )}
                <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>
              </div>
              
              {/* Simulated Map Marker */}
              <div 
                className="absolute z-10 transition-all duration-1000 ease-in-out"
                style={{
                  top: '45%',
                  left: '55%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="relative">
                  <div className="absolute -inset-4 bg-primary/20 rounded-full animate-ping"></div>
                  <div className="relative bg-white p-1 rounded-full shadow-lg border-2 border-primary">
                    <div className="bg-primary text-white p-2 rounded-full">
                      <User className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold shadow-sm border">
                    CANLI KONUM
                  </div>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 z-20 space-y-2">
                <Badge variant="secondary" className="bg-white/90 backdrop-blur flex items-center space-x-1 px-3 py-1 text-xs">
                  <Navigation className="w-3 h-3 text-primary" />
                  <span>{sessionData.lastKnownLatitude?.toFixed(5)}, {sessionData.lastKnownLongitude?.toFixed(5)}</span>
                </Badge>
              </div>

              <div className="absolute top-4 right-4 z-20">
                 <Button size="icon" variant="secondary" className="bg-white/90 shadow-md" onClick={() => setActiveCode(null)}>
                    <RefreshCw className={`w-4 h-4 ${isSessionLoading ? 'animate-spin' : ''}`} />
                 </Button>
              </div>
            </Card>

            {/* Sidebar / Info */}
            <div className="space-y-6">
              <Card className="shadow-md border-t-4 border-t-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Oturum Bilgileri</span>
                    <Badge variant="outline" className="text-primary border-primary">{sessionData.trackingCode}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-muted-foreground">Bağlantı Aktif</span>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                    Son güncelleme: {new Date(sessionData.lastUpdated || Date.now()).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>

              {/* AI Anomaly Card */}
              <Card className={`shadow-md transition-colors duration-500 ${anomaly?.anomalyDetected ? 'border-destructive bg-destructive/5' : 'border-accent bg-accent/5'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Shield className={`w-5 h-5 ${anomaly?.anomalyDetected ? 'text-destructive' : 'text-accent'}`} />
                    <span>AI Güvenlik Analizi</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isAnalyzing && !anomaly ? (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground italic">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Veriler analiz ediliyor...</span>
                    </div>
                  ) : anomaly ? (
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        {anomaly.anomalyDetected ? (
                           <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        ) : (
                           <Eye className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        )}
                        <p className={`text-sm font-medium ${anomaly.anomalyDetected ? 'text-destructive' : 'text-accent-foreground'}`}>
                          {anomaly.alertMessage}
                        </p>
                      </div>
                      {anomaly.anomalyDetected && (
                        <Button variant="destructive" className="w-full mt-2" size="sm">
                          Hızlı Arama Yap
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Analiz başlatılıyor...</p>
                  )}
                </CardContent>
              </Card>

              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground hover:text-destructive" 
                onClick={() => setActiveCode(null)}
              >
                Takibi Sonlandır
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Shield(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}
