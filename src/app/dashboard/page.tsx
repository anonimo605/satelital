
'use client';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LogOut, 
  User as UserIcon, 
  Wallet, 
  Hash, 
  Landmark, 
  Users, 
  Phone,
  LifeBuoy,
  ArrowDownUp,
  CreditCard,
  ShieldCheck,
  Megaphone,
  X,
  MessageSquare,
  UserPlus,
  Satellite,
  Rocket,
  Gift,
  History
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import type { SupportLinks } from '@/lib/types';
import SatellitesSection from '@/components/dashboard/satellites-section';
import PurchasedSatellitesSection from '@/components/dashboard/purchased-satellites-section';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import WithdrawalSection from '@/components/dashboard/withdrawal-section';
import GiftCodeSection from '@/components/dashboard/gift-code-section';
import ReferralSection from '@/components/dashboard/referral-section';


interface UserData {
  phoneNumber: string;
  ownReferralCode: string;
  balance: number;
  role?: string;
}

interface Announcement {
  title: string;
  message: string;
  active: boolean;
}

type ActiveView = 'exchange' | 'buy' | 'satellites' | 'profile' | 'referrals' | 'withdraw' | 'gift-code';
type RechargeStep = 'selection' | 'payment' | 'pending';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [activeView, setActiveView] = useState<ActiveView>('buy');

  // State for recharge
  const [rechargeStep, setRechargeStep] = useState<RechargeStep>('selection');
  const [rechargeAmount, setRechargeAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('https://placehold.co/300x300.png');
  const [lastConfirmedReference, setLastConfirmedReference] = useState('');

  // State for announcement
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // State for support links
  const [supportLinks, setSupportLinks] = useState<SupportLinks | null>(null);
  
  const { toast } = useToast();

   useEffect(() => {
    const fetchConfig = async () => {
        if(!user) return;

        try {
            // Fetch QR Code
            const qrDocRef = doc(db, 'config', 'qrCode');
            const qrDocSnap = await getDoc(qrDocRef);
            if (qrDocSnap.exists() && qrDocSnap.data().url) {
                setQrCodeUrl(qrDocSnap.data().url);
            }

            // Fetch Announcement
            const announcementDocRef = doc(db, 'config', 'announcement');
            const announcementDocSnap = await getDoc(announcementDocRef);
            if (announcementDocSnap.exists()) {
                const annData = announcementDocSnap.data() as Announcement;
                if (annData.active) {
                    setAnnouncement(annData);
                    setShowAnnouncement(true);
                }
            }

            // Fetch Support Links
            const supportLinksDocRef = doc(db, 'config', 'supportLinks');
            const supportLinksDocSnap = await getDoc(supportLinksDocRef);
            if(supportLinksDocSnap.exists()){
                setSupportLinks(supportLinksDocSnap.data() as SupportLinks);
            }

        } catch(error) {
            console.error("Error fetching config:", error);
            toast({
                title: "Error de configuración",
                description: "No se pudieron cargar algunos datos de la aplicación.",
                variant: "destructive",
            });
        }
    };
    
    fetchConfig();
   }, [user, toast]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleRechargeAmountSelection = (amount: number | 'custom') => {
    let finalAmount: number;
    if (amount === 'custom') {
      finalAmount = parseFloat(customAmount);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        toast({ title: 'Monto inválido', description: 'Por favor, ingresa un número válido.', variant: 'destructive' });
        return;
      }
    } else {
      finalAmount = amount;
    }
    setRechargeAmount(finalAmount);
    setPaymentReference('');
    setRechargeStep('payment');
  };

  const handlePaymentConfirmation = async () => {
    if (!user || !rechargeAmount || !paymentReference) {
        toast({ title: 'Error', description: 'Por favor, ingresa el código de referencia del pago.', variant: 'destructive' });
        return;
    }

    try {
        const paymentRequest = {
            userId: user.id,
            userPhoneNumber: user.phoneNumber,
            amount: rechargeAmount,
            referenceNumber: paymentReference,
            status: 'pending',
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'paymentRequests'), paymentRequest);
        setLastConfirmedReference(paymentReference);
        setRechargeStep('pending');
    } catch (error) {
        console.error("Error creating payment request: ", error);
        toast({ title: 'Error', description: 'No se pudo crear la solicitud de pago. Inténtalo de nuevo.', variant: 'destructive' });
    }
  };

  const openLink = (url: string) => {
    if(url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };


  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p>Cargando...</p>
      </main>
    );
  }

  if (!user) {
    return null; 
  }

  const renderContent = () => {
    switch(activeView) {
      case 'exchange':
        return (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Recargar Saldo</CardTitle>
              <CardDescription>Selecciona o ingresa un monto para recargar tu cuenta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {rechargeStep === 'selection' && (
                <div className="space-y-4 animate-in fade-in-50">
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[40000, 80000, 160000, 320000, 500000, 1000000].map((amount) => (
                             <Button key={amount} variant="outline" className="h-16 text-lg" onClick={() => handleRechargeAmountSelection(amount)}>
                                ${amount.toLocaleString('es-CO')}
                            </Button>
                        ))}
                   </div>
                   <div className="flex items-center space-x-2">
                     <Input 
                        type="number" 
                        placeholder="Otro monto"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="h-12"
                     />
                     <Button onClick={() => handleRechargeAmountSelection('custom')} className="h-12">Continuar</Button>
                   </div>
                </div>
              )}
              {rechargeStep === 'payment' && (
                <div className="space-y-6 text-center animate-in fade-in-50">
                    <h3 className="text-xl font-semibold">Monto a Recargar: ${rechargeAmount?.toLocaleString('es-CO')}</h3>
                    <p className="text-muted-foreground">1. Escanea el código QR con tu app de Nequi para pagar.</p>
                    <div className="flex justify-center">
                        <Image src={qrCodeUrl} alt="Código QR de Nequi" width={300} height={300} className="rounded-lg shadow-md" data-ai-hint="qr code"/>
                    </div>
                    <div className="space-y-2 max-w-sm mx-auto">
                        <Label htmlFor="payment-reference">2. Ingresa el código de referencia de pago</Label>
                        <p className="text-xs text-muted-foreground pb-2">Escribe el número de confirmación o referencia que te dio Nequi.</p>
                        <Input
                            id="payment-reference"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Ej: m1234567"
                            className="text-center text-lg h-12"
                        />
                    </div>
                    <div className="flex gap-4 justify-center">
                         <Button variant="outline" onClick={() => setRechargeStep('selection')}>Cancelar</Button>
                         <Button onClick={handlePaymentConfirmation} disabled={!paymentReference}>He realizado el pago</Button>
                    </div>
                </div>
              )}
               {rechargeStep === 'pending' && (
                <div className="space-y-4 text-center p-8 animate-in fade-in-50">
                    <CreditCard className="mx-auto h-12 w-12 text-primary" />
                    <h3 className="text-2xl font-bold">Pago en Verificación</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Hemos recibido tu confirmación. Tu solicitud de recarga por ${rechargeAmount?.toLocaleString('es-CO')} está siendo verificada. Verás el saldo reflejado en tu cuenta una vez sea aprobada.
                    </p>
                    <p className="text-sm font-semibold">Tu código de referencia es: <span className="font-mono">{lastConfirmedReference}</span></p>
                    <Button onClick={() => setRechargeStep('selection')}>Hacer otra recarga</Button>
                </div>
              )}

            </CardContent>
          </Card>
        );
      case 'buy':
        return <SatellitesSection />;
      case 'satellites':
        return <PurchasedSatellitesSection />;
      case 'withdraw':
        return <WithdrawalSection />;
      case 'gift-code':
        return <GiftCodeSection />;
      case 'referrals':
        return <ReferralSection />;
      case 'profile':
        return (
          <Card className="w-full mt-4 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Tu Perfil</CardTitle>
              <CardDescription>
                Aquí puedes ver la información de tu cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <div className="space-y-6">
                  <div className="flex items-center">
                    <Hash className="mr-3 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Tu Código de Referido:</p>
                      <p className="text-lg font-mono tracking-widest bg-muted text-muted-foreground px-2 py-1 rounded-md inline-block">{user.ownReferralCode}</p>
                    </div>
                  </div>
                   <div>
                        <Button className="w-full" onClick={() => router.push('/dashboard/transactions')}>
                            <History className="mr-2 h-4 w-4" />
                            Ver Historial de Saldo
                        </Button>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background pb-24">
      <div className="w-full max-w-4xl p-4 pt-12">
        {showAnnouncement && announcement && (
            <Alert className="mb-4 relative bg-primary/10 border-primary/20 text-foreground">
                <Megaphone className="h-4 w-4" />
                <AlertTitle className="font-bold text-primary">{announcement.title}</AlertTitle>
                <AlertDescription>
                    {announcement.message}
                </AlertDescription>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setShowAnnouncement(false)}>
                   <X className="h-4 w-4" />
                </Button>
            </Alert>
        )}

        {(supportLinks?.whatsappContactUrl || supportLinks?.whatsappGroupUrl) && (
            <Card className="mb-4">
                <CardHeader className="p-4">
                    <CardTitle className="flex items-center text-lg"><LifeBuoy className="mr-2 h-5 w-5"/>¿Necesitas Ayuda?</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-2 px-4 pb-4">
                    {supportLinks.whatsappContactUrl && (
                         <Button className="w-full" size="sm" onClick={() => openLink(supportLinks.whatsappContactUrl)}>
                            <MessageSquare className="mr-2 h-4 w-4"/>
                            Contactar Soporte
                         </Button>
                    )}
                     {supportLinks.whatsappGroupUrl && (
                        <Button className="w-full" size="sm" variant="secondary" onClick={() => openLink(supportLinks.whatsappGroupUrl)}>
                            <UserPlus className="mr-2 h-4 w-4"/>
                            Unirse al Grupo
                        </Button>
                    )}
                </CardContent>
            </Card>
        )}

        <div className="flex items-start justify-between mb-4 w-full gap-4">
            {user && (
                <Card className="flex-grow w-full shadow-sm border-0 bg-primary/5 p-4">
                    <CardHeader className="p-0 pb-1">
                        <CardTitle className="text-sm font-mono tracking-wider bg-muted text-muted-foreground px-3 py-1.5 rounded-full inline-block">
                            ID: {user.displayId}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-0">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Saldo</p>
                                <p className="text-3xl font-bold text-primary">
                                    {(user?.balance ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 sm:mt-0">
                            <Phone className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Número de Celular</p>
                                <p className="text-2xl font-semibold text-foreground">{user.phoneNumber}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
             <Button variant="outline" onClick={handleLogout} className="h-full flex-shrink-0">
                <LogOut className="h-5 w-5 mr-2" />
                Cerrar Sesión
            </Button>
        </div>
        
        {user?.role === 'superadmin' && (
          <div className="mb-4 w-full">
            <Button className="w-full" onClick={() => router.push('/superadmin')}>
              <ShieldCheck className="mr-2 h-5 w-5" />
              Panel de Administrador
            </Button>
          </div>
        )}

        {renderContent()}

      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-t-lg z-50">
          <div className="grid grid-cols-6 items-center max-w-4xl mx-auto p-2">
            
            <Button variant={activeView === 'exchange' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('exchange')}>
                <Landmark className="h-5 w-5" />
                <span className="text-xs mt-1">Recargar</span>
            </Button>

            <Button variant={activeView === 'buy' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('buy')}>
                <Satellite className="h-5 w-5" />
                <span className="text-xs mt-1">Comprar</span>
            </Button>
            
            <Button variant={activeView === 'satellites' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('satellites')}>
                <Rocket className="h-5 w-5" />
                <span className="text-xs mt-1">Mis Satélites</span>
            </Button>

             <Button variant={activeView === 'withdraw' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('withdraw')}>
                <ArrowDownUp className="h-5 w-5" />
                <span className="text-xs mt-1">Retirar</span>
            </Button>
            
            <Button variant={activeView === 'referrals' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('referrals')}>
                <Users className="h-5 w-5" />
                <span className="text-xs mt-1">Referidos</span>
            </Button>
            
            <Button variant={activeView === 'profile' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('profile')}>
                <UserIcon className="h-5 w-5" />
                <span className="text-xs mt-1">Perfil</span>
            </Button>

          </div>
      </footer>
    </main>
  );
}

    