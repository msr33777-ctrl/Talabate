
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  SetOptions,
  DocumentReference,
  UpdateData,
  WithFieldValue,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Recursively cleans any object/array intended for Firestore,
 * completely stripping out keys whose values are `undefined`,
 * which Firestore strictly forbids in setDoc and updateDoc.
 */
export function cleanFirestorePayload<T>(value: T): T {
  if (value === undefined) {
    return undefined as any;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  // Preserve Firestore FieldValue instances (e.g. arrayUnion, serverTimestamp, deleteField)
  if (
    '_methodName' in (value as any) ||
    Boolean((value as any).constructor?.name?.includes('FieldValue'))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return (value as any[])
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestorePayload(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      cleaned[key] = cleanFirestorePayload(val);
    }
  }
  return cleaned as T;
}

export async function safeSetDoc<T = any>(
  docRef: DocumentReference<any>,
  data: WithFieldValue<T> | Partial<T> | any,
  options?: SetOptions
) {
  const cleaned = cleanFirestorePayload(data);
  try {
    if (options) {
      return await fbSetDoc(docRef, cleaned, options);
    }
    return await fbSetDoc(docRef, cleaned);
  } catch (error: any) {
    console.warn('[TALABI] safeSetDoc write notice (continuing with local state):', error?.message || error);
    if (error?.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.WRITE, docRef.path);
    }
    return undefined as any;
  }
}

export async function safeUpdateDoc<T = any>(
  docRef: DocumentReference<any>,
  data: UpdateData<T> | any
) {
  const cleaned = cleanFirestorePayload(data);
  try {
    return await fbUpdateDoc(docRef, cleaned);
  } catch (error: any) {
    console.warn('[TALABI] safeUpdateDoc write notice (continuing with local state):', error?.message || error);
    if (error?.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.UPDATE, docRef.path);
    }
    return undefined as any;
  }
}

export {
  signInWithPopup,
  fbSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
};
export type { ConfirmationResult };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };

  if (
    errCode === 'permission-denied' ||
    errMessage.toLowerCase().includes('insufficient permissions') ||
    errMessage.toLowerCase().includes('missing or insufficient')
  ) {
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('the client is offline') ||
      msg.includes('token-service-api-has-not-been-used') ||
      msg.includes('Fetching auth token failed') ||
      msg.includes('unavailable')
    ) {
      console.warn('[TALABI] Firestore client offline or token service propagating:', msg);
      return false;
    }
    return false;
  }
}
