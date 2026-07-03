import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Employee } from '../types';

export function subscribeEmployees(callback: (employees: Employee[]) => void): () => void {
  return onSnapshot(
    collection(db, 'employees'),
    (snap) => {
      const employees = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Employee));
      callback(employees.sort((a, b) => a.name.localeCompare(b.name)));
    },
    (err) => console.error('subscribeEmployees error', err),
  );
}

export async function saveEmployee(employee: Employee): Promise<void> {
  await setDoc(doc(db, 'employees', employee.id), employee, { merge: true });
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await deleteDoc(doc(db, 'employees', employeeId));
}
