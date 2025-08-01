
import { Timestamp } from "firebase/firestore";

export interface WithdrawalInfo {
    nequiAccount: string;
    fullName: string;
    idNumber: string;
}

export interface User {
    id: string;
    displayId: string;
    phoneNumber: string;
    email: string;
    balance: number;
    role: 'user' | 'admin' | 'superadmin';
    ownReferralCode: string;
    withdrawalInfo?: WithdrawalInfo;
    version?: number;
    referredUsers?: string[];
    invitedByReferralCode?: string;
}

export interface Transaction {
    id: string;
    userId: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    date: Date;
}


export interface WithdrawalRequest {
    id:string;
    userId: string;
    userPhone: string;
    amount: number;
    nequiAccount: string;
    fullName: string;
    idNumber: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: Date;
    processedAt?: Date;
}

export interface WithdrawalSettings {
    minWithdrawal: number;
    dailyLimit: number; // Max number of withdrawals per day
    withdrawalFeePercentage: number;
    withdrawalStartTime: number; // Hour of the day (0-23)
    withdrawalEndTime: number; // Hour of the day (0-23)
    allowedWithdrawalDays: number[]; // Array of day numbers (0=Sun, 1=Mon, ...)
}

export interface SupportLinks {
    whatsappContactUrl: string;
    whatsappGroupUrl: string;
}

export interface Satellite {
    id: string;
    name: string;
    price: number;
    dailyYield: number;
    purchaseLimit: number;
    durationDays: number;
    imageUrl: string;
    isTimeLimited: boolean;
    timeLimitHours?: number;
    timeLimitSetAt?: Date;
    createdAt: Date;
}

export interface PurchasedSatellite {
    id: string;
    satelliteId: string;
    name: string;
    purchaseDate: Date;
    lastYieldDate?: Date;
    dailyYield: number;
    durationDays: number;
    price: number;
    status: 'Activo' | 'Completado';
    imageUrl: string;
}

export interface GiftCode {
    id: string;
    code: string;
    amount: number;
    usageLimit: number;
    expiresInMinutes: number;
    createdAt: Date;
    redeemedBy: string[];
}
