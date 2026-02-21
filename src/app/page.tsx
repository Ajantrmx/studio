
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Radio, MapPin, Eye, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-12">
      <header className="text-center space-y-4 max-w-2xl">
        <div className="flex items-center justify-center space-x-2 text-primary">
          <Shield className="w-12 h-12" />
          <h1 className="text-4xl font-bold tracking-tight font-headline">Güvenli İz</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Görme engelli bireyler ve sevdikleri için tasarlanmış, güvenilir ve gerçek zamanlı konum takip sistemi.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Sender Mode Card */}
        <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50">
          <CardHeader className="pb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <Radio className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-headline">Verici Modu</CardTitle>
            <CardDescription className="text-base">
              Konumunuzu paylaşarak sevdiklerinizin sizi takip etmesini sağlayın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sender" className="w-full">
              <Button className="w-full h-14 text-lg font-semibold group" variant="default">
                Oturum Başlat
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </CardContent>
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Radio className="w-24 h-24" />
          </div>
        </Card>

        {/* Receiver Mode Card */}
        <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-accent/50">
          <CardHeader className="pb-4">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
              <Eye className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-headline">Alıcı Modu</CardTitle>
            <CardDescription className="text-base">
              Size paylaşılan takip koduyla bir yakınınızın konumunu izleyin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/receiver" className="w-full">
              <Button className="w-full h-14 text-lg font-semibold group bg-accent hover:bg-accent/90 text-accent-foreground border-none">
                Takibi Başlat
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </CardContent>
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Eye className="w-24 h-24" />
          </div>
        </Card>
      </div>

      <footer className="text-center text-sm text-muted-foreground pt-8">
        <p>© 2024 Güvenli İz - Teknofest Projesi</p>
      </footer>
    </div>
  );
}
