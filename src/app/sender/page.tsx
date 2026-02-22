
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Radio, MapPin, Share2, Loader2, StopCircle, ArrowLeft } from "lucide-react";
import { generateTrackingCode, TrackingData } from "@/lib/tracking";
import Link from "next/link";
import { useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { doc, serverTimestamp } from "firebase/firestore";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function SenderPage() {
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const [isActive, setIsActive] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const { toast } = useToast();

  // Ensure user is signed in anonymously to interact with Firestore
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const startTracking = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Giriş Gerekli",
        description: "Bağlantı kurulurken lütfen bekleyin...",
      });
      return;
    }

    setIsInitializing(true);
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Tarayıcınız konum paylaşımını desteklemiyor.",
      });
      setIsInitializing(false);
      return;
    }

    try {
      const code = generateTrackingCode();
      setTrackingCode(code);
      
      navigator.geolocation.getCurrentPosition((pos) => {
        const initialLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setLocation(initialLoc);
        
        const sessionRef = doc(firestore, "trackerSessions", code);
        const initialData: any = {
          id: code,
          trackingCode: code,
          transmitterUserId: user.uid,
          isActive: true,
          createdAt: new Date().toISOString(),
          lastKnownLatitude: initialLoc.lat,
          lastKnownLongitude: initialLoc.lon,
          lastUpdated: new Date().toISOString(),
          history: [{ ...initialLoc, timestamp: Date.now() }]
        };

        setDocumentNonBlocking(sessionRef, initialData, { merge: true });
        setIsActive(true);
        
        toast({
          title: "Takip Başlatıldı",
          description: `Kodunuz: ${code}. Lütfen bu kodu alıcıyla paylaşın.`,
        });
      }, (err) => {
        toast({
          variant: "destructive",
          title: "Konum Hatası",
          description: "Konum erişimi reddedildi.",
        });
        setIsInitializing(false);
      });
    } catch (err) {
      console.error(err);
      setIsInitializing(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopTracking = () => {
    if (trackingCode) {
      const sessionRef = doc(firestore, "trackerSessions", trackingCode);
      updateDocumentNonBlocking(sessionRef, { isActive: false });
    }
    setIsActive(false);
    setTrackingCode(null);
    setLocation(null);
    toast({
      title: "Takip Durduruldu",
      description: "Oturum başarıyla sonlandırıldı.",
    });
  };

  // Continuous location update
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && trackingCode && user) {
      interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const newLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setLocation(newLoc);
          
          const sessionRef = doc(firestore, "trackerSessions", trackingCode);
          // We can't easily fetch current history here without useDoc, 
          // but for simple updates we just update the core fields.
          // Note: In a production app, we'd use a cloud function or 
          // a more sophisticated way to append to history.
          updateDocumentNonBlocking(sessionRef, {
            lastKnownLatitude: newLoc.lat,
            lastKnownLongitude: newLoc.lon,
            lastUpdated: new Date().toISOString()
          });
        });
      }, 10000); // Update every 10 seconds to save on writes
    }
    return () => clearInterval(interval);
  }, [isActive, trackingCode, user, firestore]);

  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Ana Sayfaya Dön
        </Link>

        {!isActive ? (
          <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                <Radio className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl font-headline">Yayın Başlat</CardTitle>
              <CardDescription>
                Konumunuzu güvenli bir şekilde paylaşmak için aşağıdaki butona basın.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={startTracking} 
                disabled={isInitializing || isUserLoading}
                className="w-full h-16 text-lg font-bold shadow-lg bg-primary hover:bg-primary/90"
              >
                {isInitializing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Paylaşımı Başlat"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Konum verileriniz sadece takip kodu olan kişilerle geçici olarak paylaşılır.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-accent/30 shadow-2xl bg-white overflow-hidden animate-in fade-in zoom-in duration-300">
            <CardHeader className="text-center bg-accent/5 pb-8">
              <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center space-x-2 text-primary font-bold">
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span className="text-xs uppercase tracking-widest">Yayın Yapılıyor</span>
                 </div>
                 <Button variant="ghost" size="sm" onClick={stopTracking} className="text-destructive hover:bg-destructive/10">
                    <StopCircle className="w-4 h-4 mr-1" /> Durdur
                 </Button>
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Takip Kodunuz</CardTitle>
              <div className="mt-2 py-4 px-6 bg-white border-2 border-accent rounded-xl inline-block shadow-inner">
                <span className="text-5xl font-black tracking-[0.2em] text-primary font-headline select-all">
                  {trackingCode}
                </span>
              </div>
              <CardDescription className="mt-4 px-8">
                Bu kodu takip edecek kişiye iletin. Uygulama açık kaldığı sürece konumunuz güncellenecektir.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg">
                <MapPin className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h4 className="font-semibold text-sm">Canlı Konum Verisi</h4>
                  <p className="text-xs text-muted-foreground">
                    {location ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}` : "Konum alınıyor..."}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full h-12 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Güvenli İz Takip Kodu',
                      text: `Beni Güvenli İz uygulaması üzerinden takip edebilirsin. Kodum: ${trackingCode}`,
                      url: window.location.origin
                    }).catch(console.error);
                  } else {
                    navigator.clipboard.writeText(trackingCode || "");
                    toast({ title: "Kopyalandı", description: "Kod panoya kopyalandı." });
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" /> Kodu Paylaş
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
