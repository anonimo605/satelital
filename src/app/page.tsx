
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Satellite } from 'lucide-react';
import { Toaster } from "@/components/ui/toaster"


type View = 'login' | 'register';

function AuthPageContent() {
  const [view, setView] = useState<View>('login');
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  useEffect(() => {
    if (refCode) {
      setView('register');
    }
  }, [refCode]);

  return (
    <>
      <Toaster />
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md overflow-hidden rounded-2xl border-0 shadow-2xl">
          <CardHeader className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Satellite className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl font-bold text-foreground">
              Satelital
            </CardTitle>
            <CardDescription className="pt-1 text-muted-foreground">
              Tu compañero cripto seguro y sin interrupciones.
            </CardDescription>
          </CardHeader>

          <CardContent className="bg-card p-8 pb-4">
             {view === 'login' ? (
                <LoginForm onSwitchRequest={() => setView('register')} />
              ) : (
                <RegisterForm onSwitchRequest={() => setView('login')} initialReferralCode={refCode || undefined} />
              )}
          </CardContent>
        </Card>
        <footer className="py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Billetera Satelital. Todos los derechos reservados.
        </footer>
      </main>
    </>
  );
}


export default function Home() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthPageContent />
        </Suspense>
    );
}
